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
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SYSTEM_TEMPLATE_SEEDS } from './system-templates.constants';

type TemplateScope = 'system' | 'tenant' | 'all';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private systemLibrarySynced = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly msGraphService: MicrosoftGraphService,
  ) {}

  // =========================
  // Document History
  // =========================

  async create(createDocumentDto: CreateDocumentDto, tenantId: string) {
    return this.prisma.documentHistory.create({
      data: {
        title: createDocumentDto.title,
        content: createDocumentDto.content,
        templateId: createDocumentDto.templateId,
        tenantId,
        snapshot: createDocumentDto.snapshot,
        status: createDocumentDto.status || 'DRAFT',
      },
    });
  }

  findAll(tenantId: string) {
    return this.prisma.documentHistory.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { template: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const document = await this.prisma.documentHistory.findFirst({
      where: { id, tenantId },
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
    await this.syncSystemLibrary();
  }

  async syncSystemLibrary(_tenantId?: string) {
    const seeds = this.getSystemLibrarySeeds();
    let upserted = 0;

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

    return { upserted };
  }

  async customizeTemplate(templateId: string, tenantId: string) {
    await this.ensureSystemLibrarySeeded();

    const systemTemplate = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, isSystemTemplate: true, tenantId: null },
    });
    if (!systemTemplate) {
      throw new NotFoundException('Template do sistema não encontrado.');
    }

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
        tags: systemTemplate.tags,
        preferredStorage: systemTemplate.preferredStorage,
        metadata: systemTemplate.metadata,
      },
    });

    return created;
  }

  async createTemplate(dto: CreateTemplateDto, tenantId: string) {
    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        categoryId: dto.categoryId,
        isSystemTemplate: false,
        description: dto.description || null,
        tags: dto.tags || null,
        preferredStorage: dto.preferredStorage || null,
        metadata: dto.metadata || null,
        systemKey: null,
        sourceTemplateId: dto.sourceTemplateId || null,
      },
    });
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
          }),
      scope === 'system'
        ? Promise.resolve([])
        : this.prisma.documentTemplate.findMany({
            where: buildWhere({ tenantId }),
            orderBy: { title: 'asc' },
          }),
    ]);

    let merged = [...systemTemplates, ...tenantTemplates];

    if (tag) {
      const normalizedTag = tag.toLowerCase();
      merged = merged.filter((t) => {
        const tags = Array.isArray(t.tags) ? (t.tags as any[]) : [];
        return tags.some((x) => String(x).toLowerCase() === normalizedTag);
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
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { isSystemTemplate: true, tenantId: null }],
      },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(id: string, dto: CreateTemplateDto, tenantId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isSystemTemplate) throw new ForbiddenException('Template do sistema não pode ser alterado.');

    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        categoryId: dto.categoryId,
        description: dto.description || null,
        tags: dto.tags || null,
        preferredStorage: dto.preferredStorage || null,
        metadata: dto.metadata || null,
      },
    });
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
  ) {
    const { content: htmlContent } = await this.renderTemplate(id, tenantId, contactId, processId, userId);

    const template = await this.findTemplate(id, tenantId);
    const documentRecord = await this.prisma.documentHistory.create({
      data: {
        title: `${template.title} (Word Online)`,
        content: htmlContent,
        templateId: id,
        tenantId,
        status: 'DRAFT',
      },
    });

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
      return { success: true, msFileUrl: updatedDoc.msFileUrl, documentId: updatedDoc.id };
    }

    return { success: false, error: 'Falha ao enviar para o OneDrive', documentId: documentRecord.id };
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
