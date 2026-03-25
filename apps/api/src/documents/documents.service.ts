import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';
import { DrxClawService } from '../drx-claw/drx-claw.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SYSTEM_TEMPLATE_SEEDS } from './system-templates.constants';

type TemplateScope = 'system' | 'tenant' | 'all';
type TagScope = 'CONTACT' | 'PROCESS' | 'FINANCE' | 'TASK' | 'TICKET' | 'LIBRARY';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private systemLibrarySynced = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly msGraphService: MicrosoftGraphService,
    private readonly drxClawService: DrxClawService,
  ) {}

  // =========================
  // Document History
  // =========================

  async create(createDocumentDto: CreateDocumentDto, tenantId: string) {
    const requestedProcessId = createDocumentDto.processId || null;
    const requestedTimelineId = createDocumentDto.timelineId || null;

    let resolvedProcessId: string | null = requestedProcessId;
    let timeline: any = null;

    if (requestedTimelineId) {
      timeline = await this.prisma.processTimeline.findFirst({
        where: {
          id: requestedTimelineId,
          process: { tenantId },
        },
        select: { id: true, processId: true, metadata: true },
      });
      if (!timeline) {
        throw new NotFoundException('Timeline not found');
      }
      if (resolvedProcessId && resolvedProcessId !== timeline.processId) {
        throw new BadRequestException('timelineId nÃ£o pertence ao processId informado');
      }
      resolvedProcessId = timeline.processId;
    }

    if (resolvedProcessId) {
      const processExists = await this.prisma.process.findFirst({
        where: { id: resolvedProcessId, tenantId },
        select: { id: true },
      });
      if (!processExists) {
        throw new NotFoundException('Process not found');
      }
    }

    const created = await this.prisma.documentHistory.create({
      data: {
        title: createDocumentDto.title,
        content: createDocumentDto.content,
        templateId: createDocumentDto.templateId,
        tenantId,
        processId: resolvedProcessId,
        timelineId: requestedTimelineId,
        snapshot: createDocumentDto.snapshot,
        status: createDocumentDto.status || 'DRAFT',
      },
    });

    if (timeline) {
      const base = (timeline.metadata && typeof timeline.metadata === 'object') ? timeline.metadata : {};
      const nextMetadata = {
        ...base,
        documentId: created.id,
        documentTitle: created.title,
      };
      await this.prisma.processTimeline.update({
        where: { id: timeline.id },
        data: { metadata: nextMetadata },
      });
    }

    return created;
  }

  findAll(tenantId: string, processId?: string) {
    return this.prisma.documentHistory.findMany({
      where: processId ? { tenantId, processId } : { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { template: true, process: true, timeline: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const document = await this.prisma.documentHistory.findFirst({
      where: { id, tenantId },
      include: { template: true, process: true, timeline: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.documentHistory.update({
      where: { id },
      data: updateDocumentDto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.documentHistory.delete({
      where: { id },
    });
  }

  // =========================
  // Settings
  // =========================

  async getSettings() {
    return this.prisma.documentSettings.findMany();
  }

  async updateSetting(key: string, value: string) {
    return this.prisma.documentSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // =========================
  // Categories (tenant)
  // =========================

  async listCategories(tenantId: string) {
    return this.prisma.documentCategory.findMany({
      where: { tenantId },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(tenantId: string, input: { name: string; parentId?: string }) {
    const name = (input.name || '').trim();
    if (!name) throw new BadRequestException('Nome da categoria é obrigatório.');

    return this.prisma.documentCategory.create({
      data: {
        tenantId,
        name,
        parentId: input.parentId || null,
      },
    });
  }

  // =========================
  // Templates / Biblioteca
  // =========================

  private readonly libraryScope: TagScope = 'LIBRARY';

  private normalizeScopeList(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 20);
  }

  private normalizeTagNames(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((t) => String(t || '').trim().replace(/^#/, ''))
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 30);
  }

  private hashToColor(name: string) {
    const palette = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#14b8a6',
      '#06b6d4',
      '#3b82f6',
      '#64748b',
      '#d946ef',
      '#f43f5e',
      '#0ea5e9',
      '#a855f7',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  private async ensureLibraryTagsByNames(tenantId: string, rawNames: any): Promise<string[]> {
    const names = this.normalizeTagNames(rawNames);
    if (names.length === 0) return [];

    const ids: string[] = [];

    for (const name of names) {
      const existing = await this.prisma.tag.findFirst({
        where: {
          tenantId,
          active: true,
          name: { equals: name, mode: 'insensitive' },
        },
      });

      if (!existing) {
        const color = this.hashToColor(name);
        const created = await this.prisma.tag.create({
          data: {
            tenantId,
            name,
            color,
            textColor: '#ffffff',
            scope: [this.libraryScope],
          },
        });
        ids.push(created.id);
        continue;
      }

      const scopes = this.normalizeScopeList((existing as any).scope);
      if (!scopes.includes(this.libraryScope)) {
        const nextScopes = Array.from(new Set([...scopes, this.libraryScope]));
        await this.prisma.tag.update({
          where: { id: existing.id },
          data: { scope: nextScopes },
        });
      }

      ids.push(existing.id);
    }

    return ids;
  }

  private async resolveLibraryTagIds(
    tenantId: string,
    input?: { tagIds?: any; tags?: any },
  ): Promise<string[]> {
    const rawIds = Array.isArray(input?.tagIds) ? input?.tagIds : [];
    const tagIds = rawIds.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30);
    if (tagIds.length > 0) {
      const found = await this.prisma.tag.findMany({
        where: { tenantId, active: true, id: { in: tagIds } },
      });
      const allowed = found
        .filter((t) => this.normalizeScopeList((t as any).scope).includes(this.libraryScope))
        .map((t) => t.id);

      const missing = tagIds.filter((id) => !allowed.includes(id));
      if (missing.length) {
        throw new BadRequestException(
          `Uma ou mais tags nÃ£o estÃ£o disponÃ­veis para a Biblioteca (LIBRARY): ${missing.join(', ')}`,
        );
      }
      return allowed;
    }

    if (input?.tags) {
      return this.ensureLibraryTagsByNames(tenantId, input.tags);
    }

    return [];
  }

  private serializeTemplate(tpl: any) {
    const tagLinks = Array.isArray(tpl?.tagLinks) ? tpl.tagLinks : [];
    const globalTags = tagLinks.map((x: any) => x?.tag).filter(Boolean);
    const tagIds = globalTags.map((t: any) => t.id);
    const tagNames = globalTags.map((t: any) => t.name);
    const legacyTags = Array.isArray(tpl?.tags) ? tpl.tags : [];

    const result: any = { ...tpl };
    delete result.tagLinks;

    result.globalTags = globalTags;
    result.tagIds = tagIds;
    // MantÃ©m `tags` como lista de nomes para compatibilidade visual/legacy.
    result.tags = tpl?.tenantId ? (tagNames.length ? tagNames : legacyTags) : legacyTags;
    return result;
  }

  private async migrateLegacyTagsToGlobal(template: any, tenantId: string) {
    const isTenantTemplate = !!template?.tenantId && template.tenantId === tenantId && !template?.isSystemTemplate;
    if (!isTenantTemplate) return template;

    const hasLinks = Array.isArray(template?.tagLinks) && template.tagLinks.length > 0;
    if (hasLinks) return template;

    const legacyTags = Array.isArray(template?.tags) ? template.tags : [];
    if (!legacyTags.length) return template;

    const tagIds = await this.ensureLibraryTagsByNames(tenantId, legacyTags);
    if (!tagIds.length) return template;

    await this.prisma.$transaction(async (tx) => {
      await tx.documentTemplate.update({
        where: { id: template.id },
        data: { tags: null },
      });

      await (tx as any).documentTemplateTag?.createMany?.({
        data: tagIds.map((tagId) => ({ templateId: template.id, tagId })),
        skipDuplicates: true,
      });
    });

    const updated = await this.prisma.documentTemplate.findFirst({
      where: { id: template.id },
      include: { tagLinks: { include: { tag: true } } },
    });

    return updated || template;
  }

  private normalizeScope(scope?: string | null): TemplateScope {
    const raw = String(scope || '').trim().toLowerCase();
    if (raw === 'system') return 'system';
    if (raw === 'tenant') return 'tenant';
    return 'all';
  }

  private getSystemLibrarySeeds() {
    return SYSTEM_TEMPLATE_SEEDS;
  }

  private async ensureSystemLibrarySeeded() {
    if (this.systemLibrarySynced) return;
    this.systemLibrarySynced = true;
    await this.syncSystemLibrary(undefined, { force: false });
  }

  private normalizeLegacyTagNames(tags: any): string[] {
    const list = Array.isArray(tags) ? tags : [];
    return list
      .map((t) => String(t || '').trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 30);
  }

  async syncSystemLibrary(_tenantId?: string, options?: { force?: boolean }) {
    const seeds = this.getSystemLibrarySeeds();

    const force = Boolean(options?.force);
    let upserted = 0;
    let skipped = 0;

    if (!force) {
      const existing = await this.prisma.documentTemplate.findMany({
        where: { tenantId: null, isSystemTemplate: true, systemKey: { in: seeds.map((s) => s.systemKey) } },
        select: { systemKey: true },
      });
      const existingKeys = new Set(existing.map((x) => String(x.systemKey || '')));

      for (const seed of seeds) {
        if (existingKeys.has(seed.systemKey)) {
          skipped += 1;
          continue;
        }
        await this.prisma.documentTemplate.create({
          data: {
            tenantId: null,
            isSystemTemplate: true,
            systemKey: seed.systemKey,
            title: seed.title,
            content: seed.content,
            description: seed.description || null,
            tags: seed.tags || null,
            preferredStorage: seed.preferredStorage || null,
            metadata: seed.metadata || null,
            categoryId: null,
          },
        });
        upserted += 1;
      }

      return { upserted, skipped, mode: 'create-only' as const };
    }

    for (const seed of seeds) {
      await this.prisma.documentTemplate.upsert({
        where: { systemKey: seed.systemKey },
        update: {
          tenantId: null,
          isSystemTemplate: true,
          title: seed.title,
          content: seed.content,
          description: seed.description || null,
          tags: seed.tags || null,
          preferredStorage: seed.preferredStorage || null,
          metadata: seed.metadata || null,
          categoryId: null,
          sourceTemplateId: null,
        },
        create: {
          tenantId: null,
          isSystemTemplate: true,
          systemKey: seed.systemKey,
          title: seed.title,
          content: seed.content,
          description: seed.description || null,
          tags: seed.tags || null,
          preferredStorage: seed.preferredStorage || null,
          metadata: seed.metadata || null,
          categoryId: null,
        },
      });
      upserted += 1;
    }

    return { upserted, skipped, mode: 'force-upsert' as const };
  }

  async listSystemTemplates(q?: string) {
    await this.ensureSystemLibrarySeeded();
    const query = String(q || '').trim();

    const where: Prisma.DocumentTemplateWhereInput = {
      tenantId: null,
      isSystemTemplate: true,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { systemKey: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const list = await this.prisma.documentTemplate.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
    });

    return list.map((x) => this.serializeTemplate(x as any));
  }

  async findSystemTemplate(id: string) {
    await this.ensureSystemLibrarySeeded();
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: null, isSystemTemplate: true },
    });
    if (!template) throw new NotFoundException('Template do sistema não encontrado.');
    return this.serializeTemplate(template as any);
  }

  async createSystemTemplate(dto: {
    systemKey: string;
    title: string;
    content: string;
    description?: string;
    tags?: string[];
    preferredStorage?: string;
    metadata?: any;
  }) {
    await this.ensureSystemLibrarySeeded();
    const systemKey = String(dto.systemKey || '').trim();
    if (!systemKey) throw new BadRequestException('systemKey é obrigatório.');

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId: null,
        isSystemTemplate: true,
        systemKey,
        title: String(dto.title || '').trim(),
        content: String(dto.content || ''),
        description: dto.description ? String(dto.description) : null,
        tags: this.normalizeLegacyTagNames(dto.tags),
        preferredStorage: dto.preferredStorage ? String(dto.preferredStorage) : null,
        metadata: dto.metadata ?? null,
        categoryId: null,
        sourceTemplateId: null,
      },
    });

    return this.serializeTemplate(created as any);
  }

  async updateSystemTemplate(
    id: string,
    dto: {
      title?: string;
      content?: string;
      description?: string;
      tags?: string[];
      preferredStorage?: string;
      metadata?: any;
    },
  ) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: null, isSystemTemplate: true },
    });
    if (!existing) throw new NotFoundException('Template do sistema não encontrado.');

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: String(dto.title || '').trim() } : {}),
        ...(dto.content !== undefined ? { content: String(dto.content || '') } : {}),
        ...(dto.description !== undefined ? { description: dto.description ? String(dto.description) : null } : {}),
        ...(dto.tags !== undefined ? { tags: this.normalizeLegacyTagNames(dto.tags) } : {}),
        ...(dto.preferredStorage !== undefined ? { preferredStorage: dto.preferredStorage ? String(dto.preferredStorage) : null } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata ?? null } : {}),
      },
    });

    return this.serializeTemplate(updated as any);
  }

  async deleteSystemTemplate(id: string) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: null, isSystemTemplate: true },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Template do sistema não encontrado.');

    const dependents = await this.prisma.documentTemplate.count({
      where: { sourceTemplateId: id },
    });
    if (dependents > 0) {
      throw new BadRequestException('Não é possível excluir: existem modelos copiados a partir deste template.');
    }

    await this.prisma.documentTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async customizeTemplate(templateId: string, tenantId: string) {
    await this.ensureSystemLibrarySeeded();

    const systemTemplate = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, isSystemTemplate: true, tenantId: null },
    });
    if (!systemTemplate) {
      throw new NotFoundException('Template do sistema não encontrado.');
    }

    const tagIds = await this.ensureLibraryTagsByNames(tenantId, systemTemplate.tags);

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title: systemTemplate.title,
        content: systemTemplate.content,
        categoryId: null,
        isSystemTemplate: false,
        systemKey: null,
        sourceTemplateId: systemTemplate.id,
        description: systemTemplate.description,
        // Tags globais (relaÃ§Ã£o). MantÃ©m campo legacy apenas no System Template.
        tags: null,
        preferredStorage: systemTemplate.preferredStorage,
        metadata: systemTemplate.metadata,
        tagLinks: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: { tagLinks: { include: { tag: true } } },
    });

    return this.serializeTemplate(created);
  }

  async createTemplate(dto: CreateTemplateDto, tenantId: string) {
    const tagIds = await this.resolveLibraryTagIds(tenantId, dto);

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        categoryId: dto.categoryId,
        isSystemTemplate: false,
        description: dto.description || null,
        tags: null,
        preferredStorage: dto.preferredStorage || null,
        metadata: dto.metadata || null,
        systemKey: null,
        sourceTemplateId: dto.sourceTemplateId || null,
        tagLinks: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: { tagLinks: { include: { tag: true } } },
    });

    return this.serializeTemplate(created);
  }

  async findAllTemplates(
    tenantId: string,
    options?: { scope?: string; q?: string; tag?: string },
  ) {
    await this.ensureSystemLibrarySeeded();

    const scope = this.normalizeScope(options?.scope);
    const q = (options?.q || '').trim();
    const tag = (options?.tag || '').trim();

    const commonSearch: Prisma.DocumentTemplateWhereInput | undefined = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const buildWhere = (base: Prisma.DocumentTemplateWhereInput): Prisma.DocumentTemplateWhereInput => {
      if (!commonSearch) return base;
      return { AND: [base, commonSearch] };
    };

    const [systemTemplates, tenantTemplates] = await Promise.all([
      scope === 'tenant'
        ? Promise.resolve([])
        : this.prisma.documentTemplate.findMany({
            where: buildWhere({ isSystemTemplate: true, tenantId: null }),
            orderBy: { title: 'asc' },
            include: { tagLinks: { include: { tag: true } } },
          }),
      scope === 'system'
        ? Promise.resolve([])
        : this.prisma.documentTemplate.findMany({
            where: buildWhere({ tenantId }),
            orderBy: { title: 'asc' },
            include: { tagLinks: { include: { tag: true } } },
          }),
    ]);

    const migratedTenantTemplates = await Promise.all(
      tenantTemplates.map((t) => this.migrateLegacyTagsToGlobal(t, tenantId)),
    );

    let merged = [...systemTemplates, ...migratedTenantTemplates].map((t) => this.serializeTemplate(t));

    if (tag) {
      const raw = tag.trim();
      const normalizedTag = raw.toLowerCase();
      const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

      merged = merged.filter((t: any) => {
        const tagIds = Array.isArray(t.tagIds) ? (t.tagIds as string[]) : [];
        if (looksLikeId) return tagIds.includes(raw);
        const tagNames = Array.isArray(t.tags) ? (t.tags as any[]) : [];
        return tagNames.some((x) => String(x).toLowerCase() === normalizedTag);
      });
    }

    // Ordena: sistema primeiro, depois tenant (mesmo que a query tenha vindo misturada).
    merged.sort((a, b) => {
      if (a.isSystemTemplate !== b.isSystemTemplate) return a.isSystemTemplate ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return merged;
  }

  async findTemplate(id: string, tenantId: string) {
    await this.ensureSystemLibrarySeeded();
    let template = await this.prisma.documentTemplate.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { isSystemTemplate: true, tenantId: null }],
      },
      include: { tagLinks: { include: { tag: true } } },
    });
    if (!template) throw new NotFoundException('Template not found');

    template = await this.migrateLegacyTagsToGlobal(template, tenantId);
    return this.serializeTemplate(template);
  }

  async updateTemplate(id: string, dto: CreateTemplateDto, tenantId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isSystemTemplate) throw new ForbiddenException('Template do sistema não pode ser alterado.');

    const tagIds = await this.resolveLibraryTagIds(tenantId, dto);

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        categoryId: dto.categoryId,
        description: dto.description || null,
        tags: null,
        preferredStorage: dto.preferredStorage || null,
        metadata: dto.metadata || null,
        tagLinks: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
      include: { tagLinks: { include: { tag: true } } },
    });

    return this.serializeTemplate(updated);
  }

  async deleteTemplate(id: string, tenantId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isSystemTemplate) throw new ForbiddenException('Template do sistema não pode ser excluído.');
    return this.prisma.documentTemplate.delete({ where: { id } });
  }

  // =========================
  // Rendering / Cloud
  // =========================

  private toStr(value: any) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  async renderTemplate(
    id: string,
    tenantId: string,
    contactId: string,
    processId?: string,
    userId?: string,
  ) {
    const template = await this.findTemplate(id, tenantId);

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        addresses: true,
        pfDetails: true,
        pjDetails: true,
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const user = userId
      ? await this.prisma.user.findFirst({
          where: { id: userId, tenantId },
          select: { id: true, name: true, email: true },
        })
      : null;

    let process: any = null;
    let opposingParty: any = null;

    if (processId) {
      process = await this.prisma.process.findFirst({
        where: { id: processId, tenantId },
        include: {
          processParties: {
            where: { isOpposing: true },
            include: {
              contact: {
                include: {
                  addresses: true,
                  pfDetails: true,
                  pjDetails: true,
                },
              },
            },
          },
        },
      });

      if (process?.processParties?.length > 0) {
        opposingParty = process.processParties[0].contact;
      }
    }

    const formatDate = (date: Date | null | undefined) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('pt-BR');
    };

    const formatFullDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatAddress = (addr: any) => {
      if (!addr) return '';
      return `${addr.street}, ${addr.number}${addr.complement ? ` ${addr.complement}` : ''}, ${addr.district || ''}, ${addr.city}/${addr.state} - CEP: ${addr.zipCode}`;
    };

    const primaryAddress = contact.addresses?.[0];
    const opposingAddress = opposingParty?.addresses?.[0];
    const now = new Date();

    const replacements: Record<string, string> = {};
    const add = (key: string, value: any) => {
      replacements[key] = this.toStr(value);
    };

    // Dot-keys (compatíveis com editor moderno)
    add('contact.name', contact.name);
    add('contact.personType', contact.personType);
    add('contact.document', contact.document || contact.pfDetails?.cpf || contact.pjDetails?.cnpj || '');
    add('contact.email', contact.email || '');
    add('contact.phone', contact.phone || contact.whatsapp || '');
    add('contact.whatsapp', contact.whatsapp || '');
    add('contact.notes', contact.notes || '');
    add('contact.category', contact.category || '');
    add('contact.address.full', formatAddress(primaryAddress));
    add('contact.address.street', primaryAddress?.street || '');
    add('contact.address.number', primaryAddress?.number || '');
    add('contact.address.city', primaryAddress?.city || '');
    add('contact.address.state', primaryAddress?.state || '');
    add('contact.address.zipCode', primaryAddress?.zipCode || '');

    add('contact.pf.nationality', contact.pfDetails?.nationality || '');
    add('contact.pf.civilStatus', contact.pfDetails?.civilStatus || '');
    add('contact.pf.profession', contact.pfDetails?.profession || '');
    add('contact.pf.cpf', contact.pfDetails?.cpf || contact.document || '');
    add('contact.pf.rg', contact.pfDetails?.rg || '');
    add('contact.pf.rgIssuer', contact.pfDetails?.rgIssuer || '');
    add('contact.pf.birthDate', formatDate(contact.pfDetails?.birthDate));
    add('contact.pf.motherName', contact.pfDetails?.motherName || '');
    add('contact.pf.fatherName', contact.pfDetails?.fatherName || '');

    add('contact.pj.cnpj', contact.pjDetails?.cnpj || contact.document || '');
    add('contact.pj.companyName', contact.pjDetails?.companyName || '');
    add('contact.pj.stateRegistration', contact.pjDetails?.stateRegistration || '');

    add('process.cnj', process?.cnj || process?.number || '');
    add('process.title', process?.title || '');
    add('process.vars', process?.vars || '');
    add('process.district', process?.district || '');
    add('process.court', process?.court || '');
    add('process.courtSystem', process?.courtSystem || '');
    add('process.status', process?.status || '');
    add('process.category', process?.category || '');
    add('process.area', process?.area || '');
    add('process.subject', process?.subject || '');
    add('process.class', process?.class || '');
    add('process.distributionDate', formatDate(process?.distributionDate));
    add('process.judge', process?.judge || '');
    add('process.responsibleLawyer', process?.responsibleLawyer || '');
    add('process.uf', process?.uf || 'MG');
    add('process.value', process?.value ? String(process.value) : '');

    add('opposing.name', opposingParty?.name || '');
    add('opposing.document', opposingParty?.document || opposingParty?.pfDetails?.cpf || opposingParty?.pjDetails?.cnpj || '');
    add('opposing.address.full', formatAddress(opposingAddress));
    add('opposing.email', opposingParty?.email || '');
    add('opposing.phone', opposingParty?.phone || opposingParty?.whatsapp || '');
    add('opposing.whatsapp', opposingParty?.whatsapp || '');

    add('today.date', formatDate(now));
    add('today.fullDate', formatFullDate(now));
    add('current.city', '');
    add('current.state', '');
    add('user.name', user?.name || '');
    add('user.email', user?.email || '');
    add('user.oab', '');

    // Legacy keys (compatibilidade com modelos antigos)
    add('NOME_CLIENTE', contact.name);
    add('CPF_CLIENTE', contact.document || contact.pfDetails?.cpf || '');
    add('EMAIL_CLIENTE', contact.email || '');
    add('ENDERECO_CLIENTE', formatAddress(primaryAddress));
    add('NUMERO_PROCESSO', process?.cnj || '');
    add('COMARCA_PROCESSO', process?.district || '');
    add('VARA_PROCESSO', process?.vars || '');
    add('TRIBUNAL_PROCESSO', process?.court || '');
    add('DATA_ATUAL', formatFullDate(now));

    // Aliases usados em alguns modelos manuais
    add('dados_vara', process?.vars || '');
    add('numero_processo', process?.cnj || '');
    add('nome_cliente', contact.name);

    let content = template.content;
    for (const [key, value] of Object.entries(replacements)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      content = content.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), value);
      content = content.replace(new RegExp(`\\[${escapedKey}\\]`, 'gi'), value);
    }

    return { content };
  }

  async generateM365Document(
    id: string,
    tenantId: string,
    contactId: string,
    processId?: string,
    userId?: string,
    options?: { timelineId?: string; content?: string },
  ) {
    const overrideContent = String(options?.content || '').trim();
    const htmlContent = overrideContent
      ? overrideContent
      : (await this.renderTemplate(id, tenantId, contactId, processId, userId)).content;

    const requestedTimelineId = options?.timelineId ? String(options.timelineId) : null;
    let timeline: any = null;

    if (requestedTimelineId) {
      timeline = await this.prisma.processTimeline.findFirst({
        where: { id: requestedTimelineId, process: { tenantId } },
        select: { id: true, processId: true, metadata: true },
      });
      if (!timeline) throw new NotFoundException('Timeline not found');
      if (processId && processId !== timeline.processId) {
        throw new BadRequestException('timelineId nÃ£o pertence ao processId informado');
      }
      processId = timeline.processId;
    }

    const template = await this.findTemplate(id, tenantId);
    const documentRecord = await this.prisma.documentHistory.create({
      data: {
        title: `${template.title} (Word Online)`,
        content: htmlContent,
        templateId: id,
        tenantId,
        status: 'DRAFT',
        processId: processId || null,
        timelineId: requestedTimelineId,
        snapshot: {
          contactId,
          processId: processId || null,
          generatedAt: new Date().toISOString(),
          source: 'M365',
        },
      },
    });

    if (timeline) {
      const base = timeline.metadata && typeof timeline.metadata === 'object' ? timeline.metadata : {};
      await this.prisma.processTimeline.update({
        where: { id: timeline.id },
        data: {
          metadata: {
            ...base,
            documentId: documentRecord.id,
            documentTitle: documentRecord.title,
          },
        },
      });
    }

    if (!processId) {
      this.logger.warn(
        `ProcessId não fornecido. Não é possível enviar para a pasta do processo no OneDrive.`,
      );
      return {
        success: false,
        error: 'Process ID is required for OneDrive upload',
        documentId: documentRecord.id,
      };
    }

    const folderReady = await this.msGraphService.setupFolderStructure(tenantId, processId);
    if (!folderReady) {
      return {
        success: false,
        error:
          'Pasta Microsoft 365 do processo nÃ£o estÃ¡ configurada. Verifique as credenciais e a pasta raiz.',
        documentId: documentRecord.id,
      };
    }

    const success = await this.msGraphService.uploadToOneDrive(
      tenantId,
      processId,
      documentRecord.id,
      htmlContent,
    );

    if (success) {
      const updatedDoc = await this.findOne(documentRecord.id, tenantId);
      if (timeline && updatedDoc?.msFileUrl) {
        const base = timeline.metadata && typeof timeline.metadata === 'object' ? timeline.metadata : {};
        await this.prisma.processTimeline.update({
          where: { id: timeline.id },
          data: {
            metadata: {
              ...base,
              documentId: updatedDoc.id,
              documentTitle: updatedDoc.title,
              msFileUrl: updatedDoc.msFileUrl,
            },
          },
        });
      }
      return { success: true, msFileUrl: updatedDoc.msFileUrl, documentId: updatedDoc.id };
    }

    return { success: false, error: 'Falha ao enviar para o OneDrive', documentId: documentRecord.id };
  }

  // =========================
  // AI - Aprimorar Documento
  // =========================

  async improveHtml(
    tenantId: string,
    input: { html: string; instruction?: string; mode?: 'FULL' | 'SELECTION'; processId?: string },
  ) {
    const html = String(input?.html || '').trim();
    if (!html) throw new BadRequestException('html Ã© obrigatÃ³rio.');

    const instruction = String(input?.instruction || '').trim();
    const mode = String(input?.mode || 'FULL').toUpperCase() as 'FULL' | 'SELECTION';
    const processId = input?.processId ? String(input.processId).trim() : '';

    let processContext = '';
    if (processId) {
      const process = await this.prisma.process.findFirst({
        where: { id: processId, tenantId },
        select: {
          cnj: true,
          title: true,
          district: true,
          vars: true,
          court: true,
          courtSystem: true,
          area: true,
          subject: true,
          class: true,
          value: true,
          processParties: {
            select: {
              isClient: true,
              isOpposing: true,
              role: { select: { name: true } },
              contact: { select: { name: true, document: true } },
            },
          },
        },
      });

      if (process) {
        const parties = Array.isArray(process.processParties) ? process.processParties : [];
        const client = parties.find((p) => p.isClient) || parties[0];
        const opposing = parties.find((p) => p.isOpposing);
        processContext = [
          `CNJ: ${process.cnj || '-'}`,
          `Caso: ${process.title || '-'}`,
          `Comarca: ${process.district || '-'}`,
          `Vara: ${process.vars || '-'}`,
          `Tribunal: ${process.court || '-'}`,
          `Sistema: ${process.courtSystem || '-'}`,
          `Ãrea: ${process.area || '-'}`,
          `Assunto: ${process.subject || '-'}`,
          `Classe: ${process.class || '-'}`,
          `Valor: ${process.value ? String(process.value) : '-'}`,
          client?.contact?.name ? `Cliente: ${client.contact.name} (${client.contact.document || '-'})` : '',
          opposing?.contact?.name ? `Parte contrÃ¡ria: ${opposing.contact.name} (${opposing.contact.document || '-'})` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    const baseInstruction =
      instruction ||
      'Aprimore a redaÃ§Ã£o jurÃ­dica (clareza, coesÃ£o, persuasÃ£o) e corrija portuguÃªs. Mantenha a estrutura e o sentido. Retorne apenas HTML pronto para Word Online.';

    const prompt = [
      'VocÃª Ã© um advogado brasileiro sÃªnior especializado em petiÃ§Ãµes cÃ­veis.',
      'Tarefa: aprimorar um texto jurÃ­dico mantendo formataÃ§Ã£o HTML (Word Online).',
      'Regras:',
      '- NÃ£o use Markdown, nem blocos de cÃ³digo. Retorne apenas HTML puro.',
      '- Preserve nomes, valores e dados jÃ¡ presentes; nÃ£o invente fatos.',
      '- Se houver trechos com pedidos/fundamentos, melhore tecnicamente sem alterar o pedido principal.',
      '- Mantenha tÃ­tulos, listas e caixas (Visual Law) quando existirem.',
      '',
      processContext ? `Contexto do Processo:\n${processContext}\n` : '',
      `Modo: ${mode === 'SELECTION' ? 'Trecho selecionado' : 'Documento inteiro'}`,
      `InstruÃ§Ãµes do usuÃ¡rio:\n${baseInstruction}`,
      '',
      'HTML de entrada:',
      html,
    ].join('\n');

    const result = await this.drxClawService.runPlayground(tenantId, {
      scenario: 'Aprimorar PeÃ§a (HTML/Word Online)',
      prompt,
    });

    let answer = String(result?.answer || '').trim();
    answer = answer.replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim();

    if (!answer) throw new BadRequestException('IA nÃ£o retornou conteÃºdo.');

    // Se o provedor devolver texto puro, embrulha em HTML bÃ¡sico para compatibilidade com Word Online.
    if (!/[<][a-z][\s\S]*[>]/i.test(answer)) {
      const safe = answer
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br/>');
      answer = `<p>${safe}</p>`;
    }
    return { html: answer };
  }

  // =========================
  // Variables / Seed antigo
  // =========================

  getVariables() {
    return {
      contact: [
        { key: 'contact.name', label: 'Nome Completo' },
        { key: 'contact.personType', label: 'Tipo (PF/PJ)' },
        { key: 'contact.document', label: 'CPF / CNPJ (Genérico)' },
        { key: 'contact.whatsapp', label: 'WhatsApp' },
        { key: 'contact.email', label: 'E-mail' },
        { key: 'contact.phone', label: 'Telefone' },
        { key: 'contact.notes', label: 'Observações' },
        { key: 'contact.category', label: 'Categoria' },

        { key: 'contact.address.full', label: 'Endereço Completo' },
        { key: 'contact.address.street', label: 'Logradouro' },
        { key: 'contact.address.number', label: 'Número' },
        { key: 'contact.address.city', label: 'Cidade' },
        { key: 'contact.address.state', label: 'Estado' },
        { key: 'contact.address.zipCode', label: 'CEP' },

        { key: 'contact.pf.cpf', label: 'CPF' },
        { key: 'contact.pf.rg', label: 'RG' },
        { key: 'contact.pf.rgIssuer', label: 'Órgão Emissor RG' },
        { key: 'contact.pf.birthDate', label: 'Data Nascimento' },
        { key: 'contact.pf.motherName', label: 'Nome da Mãe' },
        { key: 'contact.pf.fatherName', label: 'Nome do Pai' },
        { key: 'contact.pf.profession', label: 'Profissão' },
        { key: 'contact.pf.nationality', label: 'Nacionalidade' },
        { key: 'contact.pf.civilStatus', label: 'Estado Civil' },

        { key: 'contact.pj.cnpj', label: 'CNPJ' },
        { key: 'contact.pj.companyName', label: 'Razão Social' },
        { key: 'contact.pj.stateRegistration', label: 'Inscrição Estadual' },
      ],
      process: [
        { key: 'process.title', label: 'Título do Caso' },
        { key: 'process.cnj', label: 'Número do Processo (CNJ)' },
        { key: 'process.court', label: 'Tribunal' },
        { key: 'process.courtSystem', label: 'Sistema' },
        { key: 'process.vars', label: 'Vara' },
        { key: 'process.district', label: 'Comarca' },
        { key: 'process.status', label: 'Status' },
        { key: 'process.category', label: 'Categoria' },
        { key: 'process.area', label: 'Área' },
        { key: 'process.subject', label: 'Assunto' },
        { key: 'process.class', label: 'Classe Processual' },
        { key: 'process.distributionDate', label: 'Data de Distribuição' },
        { key: 'process.judge', label: 'Magistrado' },
        { key: 'process.responsibleLawyer', label: 'Responsável (Processo)' },
        { key: 'process.value', label: 'Valor da Causa' },
      ],
      opposing: [
        { key: 'opposing.name', label: 'Nome (Parte contrária)' },
        { key: 'opposing.document', label: 'CPF/CNPJ (Parte contrária)' },
        { key: 'opposing.email', label: 'E-mail (Parte contrária)' },
        { key: 'opposing.phone', label: 'Telefone (Parte contrária)' },
        { key: 'opposing.whatsapp', label: 'WhatsApp (Parte contrária)' },
        { key: 'opposing.address.full', label: 'Endereço (Parte contrária)' },
      ],
      system: [
        { key: 'today.date', label: 'Data de Hoje' },
        { key: 'today.fullDate', label: 'Data Extenso' },
        { key: 'user.name', label: 'Advogado Responsável' },
        { key: 'user.email', label: 'E-mail do Advogado' },
        { key: 'user.oab', label: 'OAB do Advogado' },
        { key: 'current.city', label: 'Cidade do Escritório' },
        { key: 'current.state', label: 'Estado do Escritório' },
      ],
    };
  }

  async seedDefaults(tenantId: string) {
    // Mantido para compatibilidade com botão antigo "seed".
    await this.ensureSystemLibrarySeeded();

    const title = 'Procuração (Geral)';
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, title },
    });
    if (existing) return { message: 'Template já existente.' };

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title,
        content: this.getSystemLibrarySeeds().find((s) => s.systemKey === 'PROCURACAO_GERAL')!.content,
        isSystemTemplate: false,
        sourceTemplateId: null,
        description: 'Cópia inicial baseada no modelo do sistema.',
      },
    });

    return { message: 'Template criado com sucesso.', id: created.id };
  }
}
