import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { MicrosoftGraphService } from "../integrations/microsoft-graph.service";
import { DrxClawService } from "../drx-claw/drx-claw.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { SYSTEM_TEMPLATE_SEEDS } from "./system-templates.constants";

type TemplateScope = "system" | "tenant" | "all";
type TagScope =
  | "CONTACT"
  | "PROCESS"
  | "FINANCE"
  | "TASK"
  | "TICKET"
  | "LIBRARY";

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
        throw new NotFoundException("Timeline not found");
      }
      if (resolvedProcessId && resolvedProcessId !== timeline.processId) {
        throw new BadRequestException(
          "timelineId nÃ£o pertence ao processId informado",
        );
      }
      resolvedProcessId = timeline.processId;
    }

    if (resolvedProcessId) {
      const processExists = await this.prisma.process.findFirst({
        where: { id: resolvedProcessId, tenantId },
        select: { id: true },
      });
      if (!processExists) {
        throw new NotFoundException("Process not found");
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
        status: createDocumentDto.status || "DRAFT",
      },
    });

    if (timeline) {
      const base =
        timeline.metadata && typeof timeline.metadata === "object"
          ? timeline.metadata
          : {};
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

  findAll(
    tenantId: string,
    options?: {
      processId?: string;
      q?: string;
      sortBy?: string;
      sortDirection?: string;
    },
  ) {
    const q = String(options?.q || "").trim();
    const sortField = this.normalizeHistorySortField(options?.sortBy);
    const sortDirection = this.normalizeSortDirection(options?.sortDirection);

    const where: Prisma.DocumentHistoryWhereInput = {
      tenantId,
      ...(options?.processId ? { processId: options.processId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { status: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.documentHistory.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      include: { template: true, process: true, timeline: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const document = await this.prisma.documentHistory.findFirst({
      where: { id, tenantId },
      include: { template: true, process: true, timeline: true },
    });
    if (!document) throw new NotFoundException("Document not found");
    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    tenantId: string,
  ) {
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
  // Tenant Header/Footer (por empresa)
  // =========================

  private readonly tenantHeaderKey = "HEADER_HTML";
  private readonly tenantFooterKey = "FOOTER_HTML";

  async getTenantDocumentLayout(tenantId: string) {
    const list = await this.prisma.tenantDocumentSetting.findMany({
      where: {
        tenantId,
        key: { in: [this.tenantHeaderKey, this.tenantFooterKey] },
      },
      select: { key: true, value: true },
    });

    const byKey = new Map(
      list.map((x: any) => [String(x.key), String(x.value || "")]),
    );
    return {
      headerHtml: byKey.get(this.tenantHeaderKey) || "",
      footerHtml: byKey.get(this.tenantFooterKey) || "",
    };
  }

  async updateTenantDocumentLayout(
    tenantId: string,
    body: { headerHtml?: string; footerHtml?: string },
  ) {
    const headerHtml =
      body.headerHtml !== undefined ? String(body.headerHtml || "") : undefined;
    const footerHtml =
      body.footerHtml !== undefined ? String(body.footerHtml || "") : undefined;

    if (headerHtml !== undefined) {
      await this.prisma.tenantDocumentSetting.upsert({
        where: { tenantId_key: { tenantId, key: this.tenantHeaderKey } },
        update: { value: headerHtml },
        create: { tenantId, key: this.tenantHeaderKey, value: headerHtml },
      });
    }

    if (footerHtml !== undefined) {
      await this.prisma.tenantDocumentSetting.upsert({
        where: { tenantId_key: { tenantId, key: this.tenantFooterKey } },
        update: { value: footerHtml },
        create: { tenantId, key: this.tenantFooterKey, value: footerHtml },
      });
    }

    return this.getTenantDocumentLayout(tenantId);
  }

  // =========================
  // Categories (tenant)
  // =========================

  async listCategories(tenantId: string) {
    return this.prisma.documentCategory.findMany({
      where: { tenantId },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(
    tenantId: string,
    input: { name: string; parentId?: string },
  ) {
    const name = (input.name || "").trim();
    if (!name)
      throw new BadRequestException("Nome da categoria é obrigatório.");

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

  private readonly libraryScope: TagScope = "LIBRARY";
  private readonly internalLibraryTagName = "SISTEMA";
  private readonly internalLibraryTagColor = "#f59e0b";
  private readonly internalLibraryTagTextColor = "#ffffff";

  private normalizeScopeList(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((s) =>
        String(s || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 20);
  }

  private normalizeTagName(input: any): string {
    return String(input || "")
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);
  }

  private normalizeTagKey(input: any): string {
    return this.normalizeTagName(input).toUpperCase();
  }

  private normalizeTagNames(input: any): string[] {
    const list = Array.isArray(input) ? input : input ? [input] : [];
    const normalized = list
      .map((t) => this.normalizeTagName(t))
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 30);
  }

  private isInternalLibraryTagName(input: any): boolean {
    return this.normalizeTagKey(input) === this.internalLibraryTagName;
  }

  private isInternalLibraryTag(tag: any): boolean {
    if (!tag) return false;
    return (
      this.isInternalLibraryTagName(tag.name) &&
      this.normalizeScopeList(tag.scope).includes(this.libraryScope)
    );
  }

  private serializeLibraryTag(tag: any) {
    return {
      ...tag,
      scope: this.normalizeScopeList(tag?.scope),
      isInternal: this.isInternalLibraryTag(tag),
    };
  }

  private hashToColor(name: string) {
    const palette = [
      "#6366f1",
      "#8b5cf6",
      "#ec4899",
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#14b8a6",
      "#06b6d4",
      "#3b82f6",
      "#64748b",
      "#d946ef",
      "#f43f5e",
      "#0ea5e9",
      "#a855f7",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1)
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  private async ensureLibraryTagRecordsByNames(
    tenantId: string,
    rawNames: any,
    options?: {
      includeInternalSystemTag?: boolean;
      allowInternalSystemTag?: boolean;
    },
  ): Promise<any[]> {
    const names = this.normalizeTagNames(rawNames);
    if (options?.includeInternalSystemTag) {
      names.unshift(this.internalLibraryTagName);
    }
    if (names.length === 0) return [];

    const dedupedNames = Array.from(
      new Map(names.map((name) => [this.normalizeTagKey(name), name])).values(),
    );
    const tags: any[] = [];

    for (const name of dedupedNames) {
      const isInternal = this.isInternalLibraryTagName(name);
      if (isInternal && options?.allowInternalSystemTag === false) {
        throw new BadRequestException(
          "A tag SISTEMA é reservada ao uso interno da Biblioteca.",
        );
      }

      const existing = await this.prisma.tag.findFirst({
        where: {
          tenantId,
          name: { equals: name, mode: "insensitive" },
        },
      });

      if (!existing) {
        const created = await this.prisma.tag.create({
          data: {
            tenantId,
            name,
            color: isInternal
              ? this.internalLibraryTagColor
              : this.hashToColor(name),
            textColor: isInternal
              ? this.internalLibraryTagTextColor
              : "#ffffff",
            scope: [this.libraryScope],
            active: true,
          },
        });
        tags.push(created);
        continue;
      }

      const scopes = this.normalizeScopeList((existing as any).scope);
      const nextScopes = isInternal
        ? [this.libraryScope]
        : Array.from(new Set([...scopes, this.libraryScope]));
      const needsUpdate =
        !existing.active ||
        !scopes.includes(this.libraryScope) ||
        (isInternal &&
          (scopes.length !== 1 || scopes[0] !== this.libraryScope)) ||
        (isInternal &&
          (existing.color !== this.internalLibraryTagColor ||
            existing.textColor !== this.internalLibraryTagTextColor));

      if (needsUpdate) {
        const updated = await this.prisma.tag.update({
          where: { id: existing.id },
          data: {
            active: true,
            scope: nextScopes,
            ...(isInternal
              ? {
                  color: this.internalLibraryTagColor,
                  textColor: this.internalLibraryTagTextColor,
                }
              : {}),
          },
        });
        tags.push(updated);
        continue;
      }

      tags.push(existing);
    }

    return tags.map((tag) => this.serializeLibraryTag(tag));
  }

  private async ensureLibraryTagsByNames(
    tenantId: string,
    rawNames: any,
    options?: {
      includeInternalSystemTag?: boolean;
      allowInternalSystemTag?: boolean;
    },
  ): Promise<string[]> {
    const tags = await this.ensureLibraryTagRecordsByNames(
      tenantId,
      rawNames,
      options,
    );
    return tags.map((tag) => tag.id);
  }

  private async ensureSystemLibraryTag(tenantId: string) {
    const [tag] = await this.ensureLibraryTagRecordsByNames(
      tenantId,
      [this.internalLibraryTagName],
      { allowInternalSystemTag: true },
    );
    return tag;
  }

  private buildSystemTemplateTagNames(rawTags: any): string[] {
    return this.normalizeTagNames([
      this.internalLibraryTagName,
      ...this.normalizeLegacyTagNames(rawTags),
    ]);
  }

  private async resolveLibraryTagIds(
    tenantId: string,
    input?: { tagIds?: any; tags?: any },
    options?: {
      allowInternalSystemTag?: boolean;
    },
  ): Promise<string[]> {
    const rawIds = Array.isArray(input?.tagIds) ? input?.tagIds : [];
    const tagIds = rawIds
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 30);
    if (tagIds.length > 0) {
      const found = await this.prisma.tag.findMany({
        where: { tenantId, active: true, id: { in: tagIds } },
      });
      const allowed = found
        .filter((t) =>
          this.normalizeScopeList((t as any).scope).includes(this.libraryScope),
        )
        .filter(
          (t) =>
            options?.allowInternalSystemTag || !this.isInternalLibraryTag(t),
        )
        .map((t) => t.id);

      const missing = tagIds.filter((id) => !allowed.includes(id));
      if (missing.length) {
        throw new BadRequestException(
          `Uma ou mais tags nÃ£o estÃ£o disponÃ­veis para a Biblioteca (LIBRARY): ${missing.join(", ")}`,
        );
      }
      return allowed;
    }

    if (input?.tags) {
      return this.ensureLibraryTagsByNames(tenantId, input.tags, {
        allowInternalSystemTag: options?.allowInternalSystemTag,
      });
    }

    return [];
  }

  private serializeTemplate(
    tpl: any,
    options?: {
      globalTags?: any[];
    },
  ) {
    const tagLinks = Array.isArray(tpl?.tagLinks) ? tpl.tagLinks : [];
    const globalTags = (
      Array.isArray(options?.globalTags)
        ? options?.globalTags
        : tagLinks.map((x: any) => x?.tag).filter(Boolean)
    ).map((tag: any) => this.serializeLibraryTag(tag));
    const tagIds = globalTags.map((t: any) => t.id);
    const tagNames = globalTags.map((t: any) => t.name);
    const legacyTags = Array.isArray(tpl?.tags) ? tpl.tags : [];

    const result: any = { ...tpl };
    delete result.tagLinks;

    result.globalTags = globalTags;
    result.tagIds = tagIds;
    result.tags = tagNames.length ? tagNames : legacyTags;
    return result;
  }

  private async migrateLegacyTagsToGlobal(template: any, tenantId: string) {
    const isTenantTemplate =
      !!template?.tenantId &&
      template.tenantId === tenantId &&
      !template?.isSystemTemplate;
    if (!isTenantTemplate) return template;

    const hasLinks =
      Array.isArray(template?.tagLinks) && template.tagLinks.length > 0;
    if (hasLinks) return template;

    const legacyTags = this.normalizeLegacyTagNames(template?.tags).filter(
      (name) => !this.isInternalLibraryTagName(name),
    );
    if (!legacyTags.length) return template;

    const tagIds = await this.ensureLibraryTagsByNames(tenantId, legacyTags, {
      allowInternalSystemTag: false,
    });
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

  private async migrateCategoryToTags(template: any, tenantId: string) {
    const isTenantTemplate =
      !!template?.tenantId &&
      template.tenantId === tenantId &&
      !template?.isSystemTemplate;
    const categoryName = String(template?.category?.name || "").trim();
    if (!isTenantTemplate || !template?.categoryId || !categoryName) {
      return template;
    }

    const tagIds = await this.ensureLibraryTagsByNames(tenantId, [categoryName], {
      allowInternalSystemTag: false,
    });
    if (!tagIds.length) return template;

    await this.prisma.$transaction(async (tx) => {
      await tx.documentTemplate.update({
        where: { id: template.id },
        data: { categoryId: null },
      });

      await (tx as any).documentTemplateTag?.createMany?.({
        data: tagIds.map((tagId) => ({ templateId: template.id, tagId })),
        skipDuplicates: true,
      });
    });

    const updated = await this.prisma.documentTemplate.findFirst({
      where: { id: template.id },
      include: {
        category: { select: { id: true, name: true } },
        tagLinks: { include: { tag: true } },
      },
    });

    return updated || template;
  }

  private async removeInternalTagsFromTenantTemplate(template: any, tenantId: string) {
    const isTenantTemplate =
      !!template?.tenantId &&
      template.tenantId === tenantId &&
      !template?.isSystemTemplate;
    if (!isTenantTemplate) return template;

    const internalTagIds = (Array.isArray(template?.tagLinks) ? template.tagLinks : [])
      .map((link: any) => link?.tag)
      .filter((tag: any) => this.isInternalLibraryTag(tag))
      .map((tag: any) => tag.id);

    if (!internalTagIds.length) return template;

    await (this.prisma as any).documentTemplateTag?.deleteMany?.({
      where: {
        templateId: template.id,
        tagId: { in: internalTagIds },
      },
    });

    const updated = await this.prisma.documentTemplate.findFirst({
      where: { id: template.id },
      include: {
        category: { select: { id: true, name: true } },
        tagLinks: { include: { tag: true } },
      },
    });

    return updated || template;
  }

  private normalizeScope(scope?: string | null): TemplateScope {
    const raw = String(scope || "")
      .trim()
      .toLowerCase();
    if (raw === "system") return "system";
    if (raw === "tenant") return "tenant";
    return "all";
  }

  private normalizeSortDirection(direction?: string | null): Prisma.SortOrder {
    return String(direction || "")
      .trim()
      .toLowerCase() === "asc"
      ? "asc"
      : "desc";
  }

  private normalizeHistorySortField(
    field?: string | null,
  ): "createdAt" | "updatedAt" | "title" | "status" {
    const raw = String(field || "")
      .trim()
      .toLowerCase();
    if (raw === "title") return "title";
    if (raw === "status") return "status";
    if (raw === "updatedat") return "updatedAt";
    return "createdAt";
  }

  private normalizeTemplateSortField(
    field?: string | null,
  ): "title" | "updatedAt" | "createdAt" {
    const raw = String(field || "")
      .trim()
      .toLowerCase();
    if (raw === "title") return "title";
    if (raw === "createdat") return "createdAt";
    return "updatedAt";
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
    return this.normalizeTagNames(tags);
  }

  async syncSystemLibrary(_tenantId?: string, options?: { force?: boolean }) {
    const seeds = this.getSystemLibrarySeeds();

    const force = Boolean(options?.force);
    let upserted = 0;
    let skipped = 0;

    if (!force) {
      const existing = await this.prisma.documentTemplate.findMany({
        where: {
          tenantId: null,
          isSystemTemplate: true,
          systemKey: { in: seeds.map((s) => s.systemKey) },
        },
        select: { systemKey: true },
      });
      const existingKeys = new Set(
        existing.map((x) => String(x.systemKey || "")),
      );

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
            tags: this.buildSystemTemplateTagNames(seed.tags),
            preferredStorage: seed.preferredStorage || null,
            metadata: seed.metadata || null,
            categoryId: null,
          },
        });
        upserted += 1;
      }

      return { upserted, skipped, mode: "create-only" as const };
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
          tags: this.buildSystemTemplateTagNames(seed.tags),
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
          tags: this.buildSystemTemplateTagNames(seed.tags),
          preferredStorage: seed.preferredStorage || null,
          metadata: seed.metadata || null,
          categoryId: null,
        },
      });
      upserted += 1;
    }

    return { upserted, skipped, mode: "force-upsert" as const };
  }

  async listSystemTemplates(q?: string) {
    await this.ensureSystemLibrarySeeded();
    const query = String(q || "").trim();

    const where: Prisma.DocumentTemplateWhereInput = {
      tenantId: null,
      isSystemTemplate: true,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { systemKey: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const list = await this.prisma.documentTemplate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    return list.map((x) => this.serializeTemplate(x as any));
  }

  async findSystemTemplate(id: string) {
    await this.ensureSystemLibrarySeeded();
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: null, isSystemTemplate: true },
    });
    if (!template)
      throw new NotFoundException("Template do sistema não encontrado.");
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
    const systemKey = String(dto.systemKey || "").trim();
    if (!systemKey) throw new BadRequestException("systemKey é obrigatório.");

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId: null,
        isSystemTemplate: true,
        systemKey,
        title: String(dto.title || "").trim(),
        content: String(dto.content || ""),
        description: dto.description ? String(dto.description) : null,
        tags: this.buildSystemTemplateTagNames(dto.tags),
        preferredStorage: dto.preferredStorage
          ? String(dto.preferredStorage)
          : null,
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
    if (!existing)
      throw new NotFoundException("Template do sistema não encontrado.");

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined
          ? { title: String(dto.title || "").trim() }
          : {}),
        ...(dto.content !== undefined
          ? { content: String(dto.content || "") }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ? String(dto.description) : null }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: this.buildSystemTemplateTagNames(dto.tags) }
          : {}),
        ...(dto.preferredStorage !== undefined
          ? {
              preferredStorage: dto.preferredStorage
                ? String(dto.preferredStorage)
                : null,
            }
          : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata ?? null }
          : {}),
      },
    });

    return this.serializeTemplate(updated as any);
  }

  async deleteSystemTemplate(id: string) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: null, isSystemTemplate: true },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException("Template do sistema não encontrado.");

    const dependents = await this.prisma.documentTemplate.count({
      where: { sourceTemplateId: id },
    });
    if (dependents > 0) {
      throw new BadRequestException(
        "Não é possível excluir: existem modelos copiados a partir deste template.",
      );
    }

    await this.prisma.documentTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async customizeTemplate(
    templateId: string,
    tenantId: string,
    customData?: any,
  ) {
    await this.ensureSystemLibrarySeeded();

    const systemTemplate = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, isSystemTemplate: true, tenantId: null },
    });
    if (!systemTemplate) {
      throw new NotFoundException("Template do sistema não encontrado.");
    }

    const tagIds = await this.ensureLibraryTagsByNames(
      tenantId,
      this.buildSystemTemplateTagNames(systemTemplate.tags).filter(
        (name) => !this.isInternalLibraryTagName(name),
      ),
      {
        allowInternalSystemTag: false,
      },
    );

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title: customData?.title?.trim() || systemTemplate.title,
        content: customData?.content || systemTemplate.content,
        categoryId: null,
        isSystemTemplate: false,
        systemKey: null,
        sourceTemplateId: systemTemplate.id,
        description:
          customData?.description !== undefined
            ? customData?.description
            : systemTemplate.description,
        // Tags globais (relaÃ§Ã£o). MantÃ©m campo legacy apenas no System Template.
        tags: null,
        preferredStorage: systemTemplate.preferredStorage,
        metadata: systemTemplate.metadata,
        tagLinks: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tagLinks: { include: { tag: true } } },
    });

    return this.serializeTemplate(created);
  }

  async createTemplate(dto: CreateTemplateDto, tenantId: string) {
    const tagIds = await this.resolveLibraryTagIds(tenantId, dto, {
      allowInternalSystemTag: false,
    });

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        categoryId: null,
        isSystemTemplate: false,
        description: dto.description || null,
        tags: null,
        preferredStorage: dto.preferredStorage || null,
        metadata: dto.metadata || null,
        systemKey: null,
        sourceTemplateId: dto.sourceTemplateId || null,
        tagLinks: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tagLinks: { include: { tag: true } } },
    });

    return this.serializeTemplate(created);
  }

  async findAllTemplates(
    tenantId: string,
    options?: {
      scope?: string;
      q?: string;
      tag?: string;
      includedTags?: string;
      excludedTags?: string;
      categoryId?: string;
      sortBy?: string;
      sortDirection?: string;
    },
  ) {
    await this.ensureSystemLibrarySeeded();

    const scope = this.normalizeScope(options?.scope);
    const q = (options?.q || "").trim();
    const tag = (options?.tag || "").trim();
    const sortField = this.normalizeTemplateSortField(options?.sortBy);
    const sortDirection = this.normalizeSortDirection(options?.sortDirection);

    const commonSearch: Prisma.DocumentTemplateWhereInput | undefined = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined;

    const buildWhere = (
      base: Prisma.DocumentTemplateWhereInput,
    ): Prisma.DocumentTemplateWhereInput => {
      if (!commonSearch) return base;
      return { AND: [base, commonSearch] };
    };

    const [systemTemplates, tenantTemplates] = await Promise.all([
      scope === "tenant"
        ? Promise.resolve([])
        : this.prisma.documentTemplate.findMany({
            where: buildWhere({ isSystemTemplate: true, tenantId: null }),
            orderBy: { title: "asc" },
            include: { tagLinks: { include: { tag: true } } },
          }),
      scope === "system"
        ? Promise.resolve([])
        : this.prisma.documentTemplate.findMany({
            where: buildWhere({ tenantId }),
            orderBy: { title: "asc" },
            include: {
              category: { select: { id: true, name: true } },
              tagLinks: { include: { tag: true } },
            },
          }),
    ]);

    const migratedTenantTemplates = await Promise.all(
      tenantTemplates.map(async (template) => {
        const withLegacyTags = await this.migrateLegacyTagsToGlobal(
          template,
          tenantId,
        );
        const withCategoryTags = await this.migrateCategoryToTags(
          withLegacyTags,
          tenantId,
        );
        return this.removeInternalTagsFromTenantTemplate(
          withCategoryTags,
          tenantId,
        );
      }),
    );
    const systemTagNames = Array.from(
      new Set(
        systemTemplates.flatMap((template) =>
          this.buildSystemTemplateTagNames(template.tags),
        ),
      ),
    );
    const systemTagRecords = systemTagNames.length
      ? await this.ensureLibraryTagRecordsByNames(tenantId, systemTagNames, {
          allowInternalSystemTag: true,
        })
      : [await this.ensureSystemLibraryTag(tenantId)];
    const systemTagMap = new Map(
      systemTagRecords.map((tag) => [this.normalizeTagKey(tag.name), tag]),
    );

    let merged = [
      ...systemTemplates.map((template) =>
        this.serializeTemplate(template, {
          globalTags: this.buildSystemTemplateTagNames(template.tags)
            .map((name) => systemTagMap.get(this.normalizeTagKey(name)))
            .filter(Boolean),
        }),
      ),
      ...migratedTenantTemplates.map((template) => this.serializeTemplate(template)),
    ];

    const includedTags = (options?.includedTags || "")
      .split(",")
      .filter(Boolean);
    const excludedTags = (options?.excludedTags || "")
      .split(",")
      .filter(Boolean);

    if (tag || includedTags.length > 0 || excludedTags.length > 0) {
      merged = merged.filter((t: any) => {
        const itemTagIds = Array.isArray(t.tagIds)
          ? (t.tagIds as string[])
          : [];
        const itemTagNames = (
          Array.isArray(t.tags) ? (t.tags as any[]) : []
        ).map((x) => String(x).toLowerCase());

        // 1. Filtro legado 'tag' (nome ou ID)
        if (tag) {
          const raw = tag.trim();
          const normalizedTag = raw.toLowerCase();
          const looksLikeId =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              raw,
            );
          const matched = looksLikeId
            ? itemTagIds.includes(raw)
            : itemTagNames.includes(normalizedTag);
          if (!matched) return false;
        }

        // Para filtros de inclusão/exclusão por ID, precisamos ser cuidadosos com System Templates
        // que só possuem nomes. Mas como o filtro de UI é baseado nas tags do tenant,
        // e os System Templates têm tags fixas, vamos focar nos IDs para Tenant Templates.
        // Se for System Template (sem tenantId), ele pode acabar sendo filtrado se não batermos nomes.
        // Mas por ora, seguimos o padrão de ID.

        // 2. Filtro de Inclusão (Must have at least one)
        if (includedTags.length > 0) {
          const hasIncluded = includedTags.some((id) =>
            itemTagIds.includes(id),
          );
          if (!hasIncluded) return false;
        }

        // 3. Filtro de Exclusão (Must not have any)
        if (excludedTags.length > 0) {
          const hasExcluded = excludedTags.some((id) =>
            itemTagIds.includes(id),
          );
          if (hasExcluded) return false;
        }

        return true;
      });
    }

    // Ordena: sistema primeiro, depois tenant (mesmo que a query tenha vindo misturada).
    merged.sort((a: any, b: any) => {
      if (a.isSystemTemplate !== b.isSystemTemplate)
        return a.isSystemTemplate ? -1 : 1;

      const left = a?.[sortField];
      const right = b?.[sortField];

      if (sortField === "title") {
        const comparison = String(left || "").localeCompare(
          String(right || ""),
          "pt-BR",
          {
            sensitivity: "base",
          },
        );
        return sortDirection === "asc" ? comparison : comparison * -1;
      }

      const leftTime = left ? new Date(left).getTime() : 0;
      const rightTime = right ? new Date(right).getTime() : 0;
      const comparison = leftTime - rightTime;
      return sortDirection === "asc" ? comparison : comparison * -1;
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
      include: {
        category: { select: { id: true, name: true } },
        tagLinks: { include: { tag: true } },
      },
    });
    if (!template) throw new NotFoundException("Template not found");

    if (template.isSystemTemplate) {
      const globalTags = await this.ensureLibraryTagRecordsByNames(
        tenantId,
        this.buildSystemTemplateTagNames(template.tags),
        {
          allowInternalSystemTag: true,
        },
      );
      return this.serializeTemplate(template, { globalTags });
    }

    template = await this.migrateLegacyTagsToGlobal(template, tenantId);
    template = await this.migrateCategoryToTags(template, tenantId);
    template = await this.removeInternalTagsFromTenantTemplate(
      template,
      tenantId,
    );
    return this.serializeTemplate(template);
  }

  async updateTemplate(id: string, dto: CreateTemplateDto, tenantId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException("Template not found");
    if (template.isSystemTemplate)
      throw new ForbiddenException(
        "Template do sistema não pode ser alterado.",
      );

    const tagIds = await this.resolveLibraryTagIds(tenantId, dto, {
      allowInternalSystemTag: false,
    });

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        categoryId: null,
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
    if (!template) throw new NotFoundException("Template not found");
    if (template.isSystemTemplate)
      throw new ForbiddenException(
        "Template do sistema não pode ser excluído.",
      );
    return this.prisma.documentTemplate.delete({ where: { id } });
  }

  // =========================
  // Rendering / Cloud
  // =========================

  private toStr(value: any) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  private applyReplacementsToHtml(
    html: string,
    replacements: Record<string, string>,
  ) {
    let content = html;
    for (const [key, value] of Object.entries(replacements)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content.replace(
        new RegExp(`\\{\\{${escapedKey}\\}\\}`, "gi"),
        value,
      );
      content = content.replace(new RegExp(`\\[${escapedKey}\\]`, "gi"), value);
    }
    return content;
  }

  private async injectTenantHeaderFooterHtml(tenantId: string, html: string) {
    const raw = String(html || "");
    if (!raw.trim()) return raw;
    if (
      raw.includes('data-tenant-header="1"') ||
      raw.includes('data-tenant-footer="1"')
    )
      return raw;

    const { headerHtml, footerHtml } =
      await this.getTenantDocumentLayout(tenantId);
    const header = String(headerHtml || "").trim();
    const footer = String(footerHtml || "").trim();
    if (!header && !footer) return raw;

    const headerBlock = header
      ? `
<div data-tenant-header="1" style="font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; color: #0f172a; border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px 12px; border-radius: 10px; margin: 0 0 14px 0;">
${header}
</div>
`.trim()
      : "";

    const footerBlock = footer
      ? `
<div data-tenant-footer="1" style="font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #334155; border-top: 1px solid #e2e8f0; margin: 18px 0 0 0; padding: 10px 0 0 0;">
${footer}
</div>
`.trim()
      : "";

    return [headerBlock, raw, footerBlock].filter(Boolean).join("\n");
  }

  private async buildTemplateReplacements(
    tenantId: string,
    contactId: string,
    processId?: string,
    userId?: string,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true, name: true, document: true },
    });

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        addresses: true,
        pfDetails: true,
        pjDetails: true,
      },
    });
    if (!contact) throw new NotFoundException("Contact not found");

    const user = userId
      ? await this.prisma.user.findFirst({
          where: { id: userId, tenantId },
          select: { id: true, name: true, email: true },
        })
      : null;

    let process: any = null;
    let parties: any[] = [];

    if (processId) {
      process = await this.prisma.process.findFirst({
        where: { id: processId, tenantId },
        include: {
          processParties: {
            include: {
              role: true,
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

      if (process?.processParties) {
        parties = process.processParties;
      }
    }

    const formatDate = (date: Date | null | undefined) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("pt-BR");
    };

    const formatFullDate = (date: Date) => {
      return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const formatAddress = (addr: any) => {
      if (!addr) return "";
      const parts = [
        addr.street,
        addr.number ? `, nº ${addr.number}` : "",
        addr.complement ? ` (${addr.complement})` : "",
        addr.district ? `, Bairro ${addr.district}` : "",
        addr.city ? `, ${addr.city}` : "",
        addr.state ? `/${addr.state}` : "",
        addr.zipCode ? `, CEP ${addr.zipCode}` : "",
      ];
      return parts.join("").replace(/^, /, "");
    };

    const getQualification = (c: any) => {
      if (!c) return "";
      const isPF = c.personType === "PF";
      const details = isPF ? c.pfDetails : c.pjDetails;
      const addr = c.addresses?.[0];

      if (isPF) {
        const parts = [
          c.name.toUpperCase(),
          details?.nationality ? `, ${details.nationality}` : "",
          details?.civilStatus ? `, ${details.civilStatus.toLowerCase()}` : "",
          details?.profession ? `, ${details.profession.toLowerCase()}` : "",
          details?.cpf
            ? `, inscrito no CPF sob o nº ${details.cpf}`
            : c.document
              ? `, inscrito no CPF sob o nº ${c.document}`
              : "",
          details?.rg ? `, portador do RG nº ${details.rg}` : "",
          details?.rgIssuer ? ` ${details.rgIssuer}` : "",
          addr ? `, residente e domiciliado na ${formatAddress(addr)}` : "",
        ];
        return parts.join("");
      } else {
        const parts = [
          details?.companyName ? details.companyName.toUpperCase() : c.name.toUpperCase(),
          details?.cnpj
            ? `, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${details.cnpj}`
            : c.document
              ? `, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.document}`
              : "",
          addr ? `, com sede na ${formatAddress(addr)}` : "",
        ];
        return parts.join("");
      }
    };

    const replacements: Record<string, string> = {};
    const add = (key: string, value: any) => {
      replacements[key] = this.toStr(value);
    };

    // Tenant
    add("tenant.name", tenant?.name || "");
    add("tenant.document", tenant?.document || "");

    // Contact (Primary)
    const primaryAddress = contact.addresses?.[0];
    add("contact.name", contact.name);
    add("contact.personType", contact.personType);
    add("contact.document", contact.document || contact.pfDetails?.cpf || contact.pjDetails?.cnpj || "");
    add("contact.qualification", getQualification(contact));
    add("contact.email", contact.email || "");
    add("contact.whatsapp", contact.whatsapp || "");
    add("contact.address.full", formatAddress(primaryAddress));
    add("contact.address.street", primaryAddress?.street || "");
    add("contact.address.number", primaryAddress?.number || "");
    add("contact.address.complement", primaryAddress?.complement || "");
    add("contact.address.neighborhood", primaryAddress?.district || "");
    add("contact.address.city", primaryAddress?.city || "");
    add("contact.address.state", primaryAddress?.state || "");
    add("contact.address.zipCode", primaryAddress?.zipCode || "");

    // Multi-Party Logic (Buyers and Sellers)
    const buyers = parties
      .filter((p) => p.role?.name?.toUpperCase() === "COMPRADOR")
      .map((p) => p.contact);
    const sellers = parties
      .filter((p) => p.role?.name?.toUpperCase() === "VENDEDOR")
      .map((p) => p.contact);

    const addPartyGroup = (list: any[], prefix: string) => {
      add(`${prefix}.count`, list.length);
      add(
        `${prefix}s.list.names`,
        list.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " e $1"),
      );
      add(
        `${prefix}s.list.qualifications`,
        list.map((c) => getQualification(c)).join("; "),
      );

      list.forEach((c, i) => {
        const index = i + 1;
        add(`${prefix}.${index}.name`, c.name);
        add(`${prefix}.${index}.document`, c.document || c.pfDetails?.cpf || c.pjDetails?.cnpj || "");
        add(`${prefix}.${index}.qualification`, getQualification(c));
      });
    };

    addPartyGroup(buyers, "buyer");
    addPartyGroup(sellers, "seller");

    // Process
    add("process.cnj", process?.cnj || process?.number || "");
    add("process.title", process?.title || "");
    add("process.vars", process?.vars || "");
    add("process.district", process?.district || "");
    add("process.court", process?.court || "");
    add("process.status", process?.status || "");
    add("process.value", process?.value ? String(process.value) : "");

    // Opposing
    const opposingParty = parties.find((p) => p.isOpposing)?.contact;
    const opposingAddress = opposingParty?.addresses?.[0];
    add("opposing.name", opposingParty?.name || "");
    add("opposing.document", opposingParty?.document || opposingParty?.pfDetails?.cpf || opposingParty?.pjDetails?.cnpj || "");
    add("opposing.qualification", getQualification(opposingParty));
    add("opposing.address.full", formatAddress(opposingAddress));
    add("opposing.address.neighborhood", opposingAddress?.district || "");

    // System
    const now = new Date();
    add("today.date", formatDate(now));
    add("today.fullDate", formatFullDate(now));
    add("user.name", user?.name || "");
    add("user.oab", "");

    // Aliases / Legacy
    add("NOME_CLIENTE", contact.name);
    add("CPF_CLIENTE", contact.document || contact.pfDetails?.cpf || "");
    add("ENDERECO_CLIENTE", formatAddress(primaryAddress));
    add("DATA_ATUAL", formatFullDate(now));

    return { replacements };
  }

  async renderTemplate(
    id: string,
    tenantId: string,
    contactId: string,
    processId?: string,
    userId?: string,
  ) {
    const template = await this.findTemplate(id, tenantId);
    const { replacements } = await this.buildTemplateReplacements(
      tenantId,
      contactId,
      processId,
      userId,
    );

    let html = template.content;
    html = await this.injectTenantHeaderFooterHtml(tenantId, html);
    html = this.applyReplacementsToHtml(html, replacements);

    return { content: html };
  }

  async generateM365Document(
    id: string,
    tenantId: string,
    contactId: string,
    processId?: string,
    userId?: string,
    options?: { timelineId?: string; content?: string },
  ) {
    const requestedTimelineId = options?.timelineId
      ? String(options.timelineId)
      : null;
    let timeline: any = null;

    if (requestedTimelineId) {
      timeline = await this.prisma.processTimeline.findFirst({
        where: { id: requestedTimelineId, process: { tenantId } },
        select: { id: true, processId: true, metadata: true },
      });
      if (!timeline) throw new NotFoundException("Timeline not found");
      if (processId && processId !== timeline.processId) {
        throw new BadRequestException(
          "timelineId nÃ£o pertence ao processId informado",
        );
      }
      processId = timeline.processId;
    }

    const template = await this.findTemplate(id, tenantId);
    const overrideContent = String(options?.content || "").trim();
    const { replacements } = await this.buildTemplateReplacements(
      tenantId,
      contactId,
      processId,
      userId,
    );

    let htmlContent = overrideContent ? overrideContent : template.content;
    htmlContent = await this.injectTenantHeaderFooterHtml(
      tenantId,
      htmlContent,
    );
    htmlContent = this.applyReplacementsToHtml(htmlContent, replacements);

    const documentRecord = await this.prisma.documentHistory.create({
      data: {
        title: `${template.title} (Word Online)`,
        content: htmlContent,
        templateId: id,
        tenantId,
        status: "DRAFT",
        processId: processId || null,
        timelineId: requestedTimelineId,
        snapshot: {
          contactId,
          processId: processId || null,
          generatedAt: new Date().toISOString(),
          source: "M365",
        },
      },
    });

    if (timeline) {
      const base =
        timeline.metadata && typeof timeline.metadata === "object"
          ? timeline.metadata
          : {};
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
        error: "Process ID is required for OneDrive upload",
        documentId: documentRecord.id,
      };
    }

    const folderReady = await this.msGraphService.setupFolderStructure(
      tenantId,
      processId,
    );
    if (!folderReady) {
      return {
        success: false,
        error:
          "Pasta Microsoft 365 do processo nÃ£o estÃ¡ configurada. Verifique as credenciais e a pasta raiz.",
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
        const base =
          timeline.metadata && typeof timeline.metadata === "object"
            ? timeline.metadata
            : {};
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
      return {
        success: true,
        msFileUrl: updatedDoc.msFileUrl,
        documentId: updatedDoc.id,
      };
    }

    return {
      success: false,
      error: "Falha ao enviar para o OneDrive",
      documentId: documentRecord.id,
    };
  }

  // =========================
  // AI - Aprimorar Documento
  // =========================

  async improveHtml(
    tenantId: string,
    input: {
      html: string;
      instruction?: string;
      mode?: "FULL" | "SELECTION";
      processId?: string;
    },
  ) {
    const html = String(input?.html || "").trim();
    if (!html) throw new BadRequestException("html Ã© obrigatÃ³rio.");

    const instruction = String(input?.instruction || "").trim();
    const mode = String(input?.mode || "FULL").toUpperCase() as
      | "FULL"
      | "SELECTION";
    const processId = input?.processId ? String(input.processId).trim() : "";

    let processContext = "";
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
        const parties = Array.isArray(process.processParties)
          ? process.processParties
          : [];
        const client = parties.find((p) => p.isClient) || parties[0];
        const opposing = parties.find((p) => p.isOpposing);
        processContext = [
          `CNJ: ${process.cnj || "-"}`,
          `Caso: ${process.title || "-"}`,
          `Comarca: ${process.district || "-"}`,
          `Vara: ${process.vars || "-"}`,
          `Tribunal: ${process.court || "-"}`,
          `Sistema: ${process.courtSystem || "-"}`,
          `Ãrea: ${process.area || "-"}`,
          `Assunto: ${process.subject || "-"}`,
          `Classe: ${process.class || "-"}`,
          `Valor: ${process.value ? String(process.value) : "-"}`,
          client?.contact?.name
            ? `Cliente: ${client.contact.name} (${client.contact.document || "-"})`
            : "",
          opposing?.contact?.name
            ? `Parte contrÃ¡ria: ${opposing.contact.name} (${opposing.contact.document || "-"})`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    const baseInstruction =
      instruction ||
      "Aprimore a redaÃ§Ã£o jurÃ­dica (clareza, coesÃ£o, persuasÃ£o) e corrija portuguÃªs. Mantenha a estrutura e o sentido. Retorne apenas HTML pronto para Word Online.";

    const prompt = [
      "VocÃª Ã© um advogado brasileiro sÃªnior especializado em petiÃ§Ãµes cÃ­veis.",
      "Tarefa: aprimorar um texto jurÃ­dico mantendo formataÃ§Ã£o HTML (Word Online).",
      "Regras:",
      "- NÃ£o use Markdown, nem blocos de cÃ³digo. Retorne apenas HTML puro.",
      "- Preserve nomes, valores e dados jÃ¡ presentes; nÃ£o invente fatos.",
      "- Se houver trechos com pedidos/fundamentos, melhore tecnicamente sem alterar o pedido principal.",
      "- Mantenha tÃ­tulos, listas e caixas (Visual Law) quando existirem.",
      "",
      processContext ? `Contexto do Processo:\n${processContext}\n` : "",
      `Modo: ${mode === "SELECTION" ? "Trecho selecionado" : "Documento inteiro"}`,
      `InstruÃ§Ãµes do usuÃ¡rio:\n${baseInstruction}`,
      "",
      "HTML de entrada:",
      html,
    ].join("\n");

    const result = await this.drxClawService.runPlayground(tenantId, {
      scenario: "Aprimorar PeÃ§a (HTML/Word Online)",
      prompt,
    });

    let answer = String(result?.answer || "").trim();
    answer = answer
      .replace(/^```(?:html)?/i, "")
      .replace(/```$/i, "")
      .trim();

    if (!answer) throw new BadRequestException("IA nÃ£o retornou conteÃºdo.");

    // Se o provedor devolver texto puro, embrulha em HTML bÃ¡sico para compatibilidade com Word Online.
    if (!/[<][a-z][\s\S]*[>]/i.test(answer)) {
      const safe = answer
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r?\n/g, "<br/>");
      answer = `<p>${safe}</p>`;
    }
    return { html: answer };
  }

  // =========================
  // Variables / Seed antigo
  // =========================

  getVariables() {
    const contactBase = [
      { key: "contact.name", label: "Nome Completo" },
      { key: "contact.personType", label: "Tipo (PF/PJ)" },
      { key: "contact.document", label: "CPF / CNPJ (Genérico)" },
      { key: "contact.qualification", label: "Qualificação Completa (Texto)" },
      { key: "contact.whatsapp", label: "WhatsApp" },
      { key: "contact.email", label: "E-mail" },
      { key: "contact.phone", label: "Telefone" },
      { key: "contact.address.full", label: "Endereço Completo" },
      { key: "contact.address.street", label: "Logradouro" },
      { key: "contact.address.number", label: "Número" },
      { key: "contact.address.complement", label: "Complemento" },
      { key: "contact.address.neighborhood", label: "Bairro" },
      { key: "contact.address.city", label: "Cidade" },
      { key: "contact.address.state", label: "Estado" },
      { key: "contact.address.zipCode", label: "CEP" },
    ];

    const generateIndexedParty = (prefix: string, label: string, count: number) => {
      const vars = [];
      for (let i = 1; i <= count; i++) {
        vars.push({ key: `${prefix}.${i}.name`, label: `${label} ${i}: Nome` });
        vars.push({ key: `${prefix}.${i}.document`, label: `${label} ${i}: CPF/CNPJ` });
        vars.push({ key: `${prefix}.${i}.qualification`, label: `${label} ${i}: Qualificação Completa` });
      }
      return vars;
    };

    return {
      contact: contactBase,
      "Compradores (Listas)": [
        { key: "buyers.list.names", label: "Lista de Nomes (Compradores)" },
        { key: "buyers.list.qualifications", label: "Lista de Qualificações (Compradores)" },
        { key: "buyers.count", label: "Total de Compradores" },
        ...generateIndexedParty("buyer", "Comprador", 5),
      ],
      "Vendedores (Listas)": [
        { key: "sellers.list.names", label: "Lista de Nomes (Vendedores)" },
        { key: "sellers.list.qualifications", label: "Lista de Qualificações (Vendedores)" },
        { key: "sellers.count", label: "Total de Vendedores" },
        ...generateIndexedParty("seller", "Vendedor", 5),
      ],
      process: [
        { key: "process.title", label: "Título do Caso" },
        { key: "process.cnj", label: "Número do Processo (CNJ)" },
        { key: "process.court", label: "Tribunal" },
        { key: "process.district", label: "Comarca" },
        { key: "process.status", label: "Status" },
        { key: "process.value", label: "Valor da Causa / Contrato" },
      ],
      opposing: [
        { key: "opposing.name", label: "Nome (Parte contrária)" },
        { key: "opposing.document", label: "CPF/CNPJ (Parte contrária)" },
        { key: "opposing.qualification", label: "Qualificação (Parte contrária)" },
        { key: "opposing.address.neighborhood", label: "Bairro (Parte contrária)" },
        { key: "opposing.address.full", label: "Endereço (Parte contrária)" },
      ],
      system: [
        { key: "today.date", label: "Data de Hoje" },
        { key: "today.fullDate", label: "Data Extenso" },
        { key: "user.name", label: "Advogado Responsável" },
        { key: "user.oab", label: "OAB do Advogado" },
        { key: "current.city", label: "Cidade do Escritório" },
      ],
    };
  }

  async seedDefaults(tenantId: string) {
    // Mantido para compatibilidade com botão antigo "seed".
    await this.ensureSystemLibrarySeeded();

    const title = "Procuração (Geral)";
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, title },
    });
    if (existing) return { message: "Template já existente." };

    const created = await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title,
        content: this.getSystemLibrarySeeds().find(
          (s) => s.systemKey === "PROCURACAO_GERAL",
        )!.content,
        isSystemTemplate: false,
        sourceTemplateId: null,
        description: "Cópia inicial baseada no modelo do sistema.",
      },
    });

    return { message: "Template criado com sucesso.", id: created.id };
  }
}
