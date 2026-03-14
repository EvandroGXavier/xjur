import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';

interface CreateProcessDto {
    tenantId?: string;
    contactId?: string;
    cnj?: string;
    category: 'JUDICIAL' | 'EXTRAJUDICIAL' | 'ADMINISTRATIVO';
    title?: string;
    code?: string;
    description?: string;
    folder?: string;
    subject?: string;
    value?: number | string;
    status?: string;
    court?: string;
    courtSystem?: string;
    vars?: string;
    district?: string;
    area?: string;
    class?: string;
    distributionDate?: string | Date;
    judge?: string;
    parties?: any;
    metadata?: any;
}

interface ImportedProcessPartyInput {
    name: string;
    type?: string;
    document?: string | null;
    phone?: string | null;
    email?: string | null;
    oab?: string | null;
    representedNames?: string[] | null;
}

interface ImportedPartySyncRef {
    id: string;
    contactId: string;
    roleName: string;
    normalizedName: string;
    normalizedDocument?: string | null;
    representedNames: string[];
}

@Injectable()
export class ProcessesService {
    constructor(
        private prisma: PrismaService,
        private readonly microsoftGraphService: MicrosoftGraphService,
    ) {}

    private async syncMicrosoftFolder(tenantId: string, processId: string) {
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { msStorageActive: true },
            });

            if (!tenant?.msStorageActive) {
                return;
            }

            await this.microsoftGraphService.setupFolderStructure(tenantId, processId);
        } catch (error: any) {
            console.warn(`Microsoft folder sync failed for process ${processId}:`, error?.message || error);
        }
    }

    async syncMicrosoftFolderForProcess(id: string, tenantId: string) {
        const process = await this.findOne(id, tenantId);
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { msStorageActive: true },
        });

        if (!tenant?.msStorageActive) {
            return {
                success: false,
                message: 'Armazenamento Microsoft 365 desativado para esta empresa.',
                process,
            };
        }

        const success = await this.microsoftGraphService.setupFolderStructure(tenantId, process.id);
        const updatedProcess = await this.findOne(process.id, tenantId);

        return {
            success,
            message: success
                ? 'Pasta Microsoft 365 sincronizada com sucesso.'
                : 'Nao foi possivel sincronizar a pasta Microsoft 365.',
            process: updatedProcess,
        };
    }

    async getFirstTenantId(): Promise<string> {
        const tenant = await this.prisma.tenant.findFirst();
        if (!tenant) throw new NotFoundException('Nenhum tenant encontrado');
        return tenant.id;
    }

    private logAudit(step: string, data: any) {
        try {
            const logDir = path.join(process.cwd(), 'tmp', 'audit_logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `process_${step}_${timestamp}.json`;
            fs.writeFileSync(path.join(logDir, filename), JSON.stringify(data, null, 2));
            console.log(`[AUDIT] Log saved: ${filename}`);
        } catch (e) {
            console.error('[AUDIT] Failed to save log:', e);
        }
    }

    private normalizeText(value?: string | null) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
    }

    private normalizeDocument(value?: string | null) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }

    private normalizeCnj(value?: string | null) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }

    private isLawyerRole(roleName?: string | null) {
        const normalized = this.normalizeText(roleName);
        return ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some(term => normalized.includes(term));
    }

    private inferImportedPole(roleName?: string | null): 'ACTIVE' | 'PASSIVE' | null {
        const normalized = this.normalizeText(roleName);
        if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalized.includes(term))) {
            return 'ACTIVE';
        }
        if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalized.includes(term))) {
            return 'PASSIVE';
        }
        if (normalized.includes('CONTRARIO')) {
            return 'PASSIVE';
        }
        if (this.isLawyerRole(normalized)) {
            return 'ACTIVE';
        }
        return null;
    }

    private buildProcessInclude() {
        return {
            timeline: { orderBy: { date: 'desc' as const }, take: 50 },
            appointments: { orderBy: { startAt: 'asc' as const }, take: 20 },
            contact: true,
            tags: {
                include: {
                    tag: true,
                },
            },
            processParties: {
                orderBy: { createdAt: 'asc' as const },
                include: {
                    contact: {
                        include: {
                            additionalContacts: true,
                        },
                    },
                    role: true,
                    qualification: true,
                    representativeLinks: {
                        orderBy: { createdAt: 'asc' as const },
                        include: {
                            representativeParty: {
                                include: {
                                    contact: {
                                        include: {
                                            additionalContacts: true,
                                        },
                                    },
                                    role: true,
                                    qualification: true,
                                },
                            },
                        },
                    },
                    representedPartyLinks: true,
                },
            },
            processPartyRepresentations: true,
        };
    }

    private parseDate(value: any) {
        if (!value) return undefined;
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? undefined : value;
        }
        if (typeof value === 'string') {
            if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
                const [day, month, year] = value.split('/');
                const parsed = new Date(`${year}-${month}-${day}`);
                return Number.isNaN(parsed.getTime()) ? undefined : parsed;
            }
            if (/^\d{8,14}$/.test(value)) {
                const year = value.slice(0, 4);
                const month = value.slice(4, 6) || '01';
                const day = value.slice(6, 8) || '01';
                const hour = value.slice(8, 10) || '00';
                const minute = value.slice(10, 12) || '00';
                const second = value.slice(12, 14) || '00';
                const parsedCompact = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                return Number.isNaN(parsedCompact.getTime()) ? undefined : parsedCompact;
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? undefined : parsed;
        }
        return undefined;
    }

    private parseMoneyValue(value: any) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (typeof value === 'number') {
            return value;
        }
        const parsed = parseFloat(
            String(value)
                .replace('R$', '')
                .trim()
                .replace(/\./g, '')
                .replace(',', '.'),
        );
        return Number.isNaN(parsed) ? undefined : parsed;
    }

    private isInformativeJudgeName(value?: string | null) {
        const normalized = this.normalizeText(value);
        return Boolean(
            normalized &&
            ![
                'NAO INFORMADO',
                'NAO INFORMADO VIA DATAJUD',
                'NAO IDENTIFICADO',
                'DESCONHECIDO',
                '-',
            ].includes(normalized),
        );
    }

    private normalizeImportedRole(rawType?: string | null) {
        const normalized = this.normalizeText(rawType);
        if (!normalized) return 'TERCEIRO';

        if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalized.includes(term))) {
            if (normalized.includes('AUTORA')) return 'AUTORA';
            if (normalized.includes('REQUERENTE')) return 'REQUERENTE';
            if (normalized.includes('EXEQUENTE')) return 'EXEQUENTE';
            if (normalized.includes('RECLAMANTE')) return 'RECLAMANTE';
            return 'AUTOR';
        }

        if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalized.includes(term))) {
            if (normalized.includes('REQUERIDA')) return 'REQUERIDA';
            if (normalized.includes('REQUERIDO')) return 'REQUERIDO';
            if (normalized.includes('EXECUTADA')) return 'EXECUTADA';
            if (normalized.includes('EXECUTADO')) return 'EXECUTADO';
            if (normalized.includes('RECLAMADA')) return 'RECLAMADA';
            if (normalized.includes('RECLAMADO')) return 'RECLAMADO';
            return 'REU';
        }

        if (['ADVOGADO', 'ADVOGADA', 'PROCURADOR', 'PROCURADORA', 'DEFENSOR'].some(term => normalized.includes(term))) {
            return normalized.includes('CONTRAR') ? 'ADVOGADO CONTRARIO' : 'ADVOGADO';
        }

        if (['JUIZ', 'MAGISTRADO', 'RELATOR'].some(term => normalized.includes(term))) return 'MAGISTRADO';
        if (normalized.includes('PROMOTOR')) return 'PROMOTOR';
        if (normalized.includes('PERITO')) return 'PERITO';
        if (normalized.includes('TESTEMUNHA')) return 'TESTEMUNHA';
        if (normalized.includes('CURADORA')) return 'CURADORA';
        if (normalized.includes('CURADOR')) return 'CURADOR';
        if (normalized.includes('INVENTARIANTE')) return 'INVENTARIANTE';
        if (normalized.includes('HERDEIRA')) return 'HERDEIRA';
        if (normalized.includes('HERDEIRO')) return 'HERDEIRO';
        if (normalized.includes('MEEIRA')) return 'MEEIRA';
        if (normalized.includes('MEEIRO')) return 'MEEIRO';

        return normalized.slice(0, 80);
    }

    private inferRoleCategory(roleName: string) {
        const normalized = this.normalizeText(roleName);
        if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalized.includes(term))) {
            return 'POLO_ATIVO';
        }
        if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalized.includes(term))) {
            return 'POLO_PASSIVO';
        }
        return 'OUTROS';
    }

    private getQualificationNameForRole(roleName: string) {
        const category = this.inferRoleCategory(roleName);
        if (category === 'POLO_ATIVO') return 'CLIENTE';
        if (category === 'POLO_PASSIVO') return 'CONTRARIO';

        const normalized = this.normalizeText(roleName);
        if (normalized.includes('PERITO')) return 'PERITO';
        if (normalized.includes('TESTEMUNHA')) return 'TESTEMUNHA';

        return null;
    }

    private async ensureRole(tenantId: string, roleName: string) {
        const normalizedRoleName = this.normalizeImportedRole(roleName);
        const existing = await this.prisma.partyRole.findUnique({
            where: {
                tenantId_name: {
                    tenantId,
                    name: normalizedRoleName,
                },
            },
        });

        if (existing) {
            if (!existing.active) {
                return this.prisma.partyRole.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            }
            return existing;
        }

        return this.prisma.partyRole.create({
            data: {
                tenantId,
                name: normalizedRoleName,
                category: this.inferRoleCategory(normalizedRoleName),
            },
        });
    }

    private async ensureQualification(tenantId: string, name: string) {
        const normalizedName = this.normalizeText(name);
        if (!normalizedName) return null;

        const existingList = await this.prisma.partyQualification.findMany({
            where: { tenantId },
            select: { id: true, name: true, active: true },
        });

        const existing = existingList.find(item => this.normalizeText(item.name) === normalizedName);
        if (existing) {
            if (!existing.active) {
                return this.prisma.partyQualification.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            }
            return existing;
        }

        return this.prisma.partyQualification.create({
            data: {
                tenantId,
                name: normalizedName,
            },
        });
    }

    private async findExistingImportedContact(tenantId: string, name: string, cleanDoc?: string | null) {
        if (cleanDoc) {
            if (cleanDoc.length <= 11) {
                const byCpf = await this.prisma.contact.findFirst({
                    where: {
                        tenantId,
                        OR: [
                            { document: cleanDoc },
                            { pfDetails: { cpf: cleanDoc } },
                        ],
                    },
                    select: { id: true },
                });
                if (byCpf) return byCpf;
            } else {
                const byCnpj = await this.prisma.contact.findFirst({
                    where: {
                        tenantId,
                        OR: [
                            { document: cleanDoc },
                            { pjDetails: { cnpj: cleanDoc } },
                        ],
                    },
                    select: { id: true },
                });
                if (byCnpj) return byCnpj;
            }
        }

        return this.prisma.contact.findFirst({
            where: {
                tenantId,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
            select: { id: true },
        });
    }

    private async ensureImportedAdditionalContact(contactId: string, type: string, value?: string | null) {
        const trimmedValue = String(value || '').trim();
        if (!trimmedValue) return;

        const existing = await this.prisma.additionalContact.findFirst({
            where: {
                contactId,
                type,
                value: trimmedValue,
            },
            select: { id: true },
        });

        if (!existing) {
            await this.prisma.additionalContact.create({
                data: {
                    contactId,
                    type,
                    value: trimmedValue,
                },
            });
        }
    }

    private async updateExistingImportedContact(
        contactId: string,
        roleName: string,
        document?: string | null,
        phone?: string | null,
        email?: string | null,
    ) {
        const cleanDoc = this.normalizeDocument(document);
        const category = roleName === 'MAGISTRADO' ? 'MAGISTRADO' : roleName;
        const current = await this.prisma.contact.findUnique({
            where: { id: contactId },
            include: {
                pfDetails: true,
                pjDetails: true,
            },
        });

        if (!current) return;

        await this.prisma.contact.update({
            where: { id: contactId },
            data: {
                document: current.document || cleanDoc || undefined,
                phone: current.phone || String(phone || '').trim() || undefined,
                email: current.email || String(email || '').trim() || undefined,
                category: current.category || category,
                notes: current.notes || 'Importado automaticamente via processo',
                pfDetails: cleanDoc && cleanDoc.length <= 11 && !current.pfDetails
                    ? {
                        create: { cpf: cleanDoc },
                    }
                    : undefined,
                pjDetails: cleanDoc && cleanDoc.length > 11 && !current.pjDetails
                    ? {
                        create: {
                            cnpj: cleanDoc,
                            companyName: current.name,
                        },
                    }
                    : undefined,
            },
        });

        await this.ensureImportedAdditionalContact(contactId, 'PHONE', phone);
        await this.ensureImportedAdditionalContact(contactId, 'EMAIL', email);
    }

    private async findOrCreateImportedContact(
        tenantId: string,
        name: string,
        roleName: string,
        document?: string | null,
        phone?: string | null,
        email?: string | null,
    ) {
        const trimmedName = String(name || '').trim().slice(0, 100);
        if (!trimmedName) return null;

        const cleanDoc = this.normalizeDocument(document);
        const existing = await this.findExistingImportedContact(tenantId, trimmedName, cleanDoc);
        if (existing) {
            await this.updateExistingImportedContact(existing.id, roleName, cleanDoc, phone, email);
            return existing.id;
        }

        const personType = cleanDoc && cleanDoc.length > 11 ? 'PJ' : 'PF';
        const category = roleName === 'MAGISTRADO' ? 'MAGISTRADO' : roleName;

        const created = await this.prisma.contact.create({
            data: {
                tenantId,
                name: trimmedName,
                personType,
                document: cleanDoc || undefined,
                phone: String(phone || '').trim() || undefined,
                email: String(email || '').trim() || undefined,
                category,
                notes: 'Importado automaticamente via processo',
                pfDetails: personType === 'PF' && cleanDoc
                    ? {
                        create: { cpf: cleanDoc },
                    }
                    : undefined,
                pjDetails: personType === 'PJ' && cleanDoc
                    ? {
                        create: {
                            cnpj: cleanDoc,
                            companyName: trimmedName,
                        },
                    }
                    : undefined,
            },
            select: { id: true },
        });

        await this.ensureImportedAdditionalContact(created.id, 'PHONE', phone);
        await this.ensureImportedAdditionalContact(created.id, 'EMAIL', email);

        return created.id;
    }

    private async upsertImportedProcessParty(
        tenantId: string,
        processId: string,
        contactId: string,
        roleName: string,
        notes?: string,
    ) {
        const role = await this.ensureRole(tenantId, roleName);
        const qualificationName = this.getQualificationNameForRole(role.name);
        const qualification = qualificationName
            ? await this.ensureQualification(tenantId, qualificationName)
            : null;

        const roleCategory = this.normalizeText(role.category);

        return this.prisma.processParty.upsert({
            where: {
                processId_contactId_roleId: {
                    processId,
                    contactId,
                    roleId: role.id,
                },
            },
            update: {
                qualificationId: qualification?.id || null,
                isClient: roleCategory === 'POLO_ATIVO',
                isOpposing: roleCategory === 'POLO_PASSIVO',
                notes: notes || undefined,
            },
            create: {
                tenantId,
                processId,
                contactId,
                roleId: role.id,
                qualificationId: qualification?.id || undefined,
                isClient: roleCategory === 'POLO_ATIVO',
                isOpposing: roleCategory === 'POLO_PASSIVO',
                notes,
            },
        });
    }

    private matchImportedPartyRef(
        refs: ImportedPartySyncRef[],
        name?: string | null,
        document?: string | null,
    ) {
        const normalizedDocument = this.normalizeDocument(document);
        if (normalizedDocument) {
            const byDocument = refs.find(ref => ref.normalizedDocument === normalizedDocument);
            if (byDocument) return byDocument;
        }

        const normalizedName = this.normalizeText(name);
        if (!normalizedName) return null;
        return refs.find(ref => ref.normalizedName === normalizedName) || null;
    }

    private async linkImportedRepresentations(
        tenantId: string,
        processId: string,
        refs: ImportedPartySyncRef[],
    ) {
        const principalRefs = refs.filter(ref => !this.isLawyerRole(ref.roleName) && this.inferImportedPole(ref.roleName));
        const lawyerRefs = refs.filter(ref => this.isLawyerRole(ref.roleName));

        for (const lawyer of lawyerRefs) {
            const explicitTargets = lawyer.representedNames
                .map(name => this.matchImportedPartyRef(principalRefs, name))
                .filter(Boolean) as ImportedPartySyncRef[];

            let targets = explicitTargets;

            if (targets.length === 0) {
                const inferredPole = this.inferImportedPole(lawyer.roleName);
                if (inferredPole) {
                    targets = principalRefs.filter(ref => this.inferImportedPole(ref.roleName) === inferredPole);
                }
            }

            const uniqueTargets = new Map<string, ImportedPartySyncRef>();
            for (const target of targets) {
                if (target.id !== lawyer.id) {
                    uniqueTargets.set(target.id, target);
                }
            }

            for (const target of uniqueTargets.values()) {
                await this.prisma.processPartyRepresentation.upsert({
                    where: {
                        partyId_representativePartyId: {
                            partyId: target.id,
                            representativePartyId: lawyer.id,
                        },
                    },
                    update: {},
                    create: {
                        tenantId,
                        processId,
                        partyId: target.id,
                        representativePartyId: lawyer.id,
                    },
                });
            }
        }
    }

    private async assignPrimaryProcessContactIfMissing(
        processId: string,
        refs: ImportedPartySyncRef[],
    ) {
        const current = await this.prisma.process.findUnique({
            where: { id: processId },
            select: { contactId: true },
        });

        if (current?.contactId) return;

        const preferred =
            refs.find(ref => this.inferImportedPole(ref.roleName) === 'ACTIVE' && !this.isLawyerRole(ref.roleName)) ||
            refs.find(ref => !this.isLawyerRole(ref.roleName));

        if (preferred) {
            await this.prisma.process.update({
                where: { id: processId },
                data: { contactId: preferred.contactId },
            });
        }
    }

    private async syncImportedProcessParties(
        processId: string,
        tenantId: string,
        parties: any[] = [],
        judgeName?: string,
    ) {
        const safeParties = (Array.isArray(parties) ? parties : []) as ImportedProcessPartyInput[];
        const syncedRefs: ImportedPartySyncRef[] = [];

        for (const party of safeParties) {
            const name = String(party?.name || '').trim();
            if (!name) continue;

            const roleName = this.normalizeImportedRole(party?.type);
            const contactId = await this.findOrCreateImportedContact(
                tenantId,
                name,
                roleName,
                party?.document,
                party?.phone,
                party?.email,
            );

            if (!contactId) continue;

            const processParty = await this.upsertImportedProcessParty(
                tenantId,
                processId,
                contactId,
                roleName,
                'Importado automaticamente via consulta/processo',
            );

            syncedRefs.push({
                id: processParty.id,
                contactId,
                roleName,
                normalizedName: this.normalizeText(name),
                normalizedDocument: this.normalizeDocument(party?.document),
                representedNames: Array.isArray(party?.representedNames) ? party.representedNames : [],
            });
        }

        if (this.isInformativeJudgeName(judgeName)) {
            const judgeContactId = await this.findOrCreateImportedContact(
                tenantId,
                String(judgeName).trim(),
                'MAGISTRADO',
            );

            if (judgeContactId) {
                const judgeParty = await this.upsertImportedProcessParty(
                    tenantId,
                    processId,
                    judgeContactId,
                    'MAGISTRADO',
                    'Magistrado importado automaticamente via consulta/processo',
                );

                syncedRefs.push({
                    id: judgeParty.id,
                    contactId: judgeContactId,
                    roleName: 'MAGISTRADO',
                    normalizedName: this.normalizeText(String(judgeName).trim()),
                    normalizedDocument: null,
                    representedNames: [],
                });
            }
        }

        await this.linkImportedRepresentations(tenantId, processId, syncedRefs);
        await this.assignPrimaryProcessContactIfMissing(processId, syncedRefs);
    }

    private async resolveTenantId(inputTenantId?: string) {
        if (inputTenantId) {
            return inputTenantId;
        }

        const defaultTenant = await this.prisma.tenant.findFirst();
        if (defaultTenant) {
            return defaultTenant.id;
        }

        const newTenant = await this.prisma.tenant.create({
            data: {
                name: 'Escritorio Principal',
                document: '00000000000191',
            },
        });

        return newTenant.id;
    }

    private async buildProcessCode(tenantId: string, data: CreateProcessDto) {
        if (data.category !== 'EXTRAJUDICIAL') {
            return data.code || this.normalizeCnj(data.cnj) || data.cnj;
        }

        const year = new Date().getFullYear();
        const codes = await this.prisma.process.findMany({
            where: {
                tenantId,
                code: { startsWith: `CASO-${year}-` },
            },
            select: { code: true },
        });

        let maxSeq = 0;
        for (const item of codes) {
            if (!item.code) continue;
            const parts = item.code.split('-');
            if (parts.length !== 3) continue;
            const seq = parseInt(parts[2], 10);
            if (!Number.isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }

        return `CASO-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
    }

    async create(data: CreateProcessDto) {
        this.logAudit('1_RECEIVED_PAYLOAD', data);
        console.log('Creating process payload:', JSON.stringify(data, null, 2));

        if (data.category === 'JUDICIAL' && !data.cnj) {
            throw new BadRequestException('CNJ e obrigatorio para processos judiciais.');
        }
        if (data.category === 'EXTRAJUDICIAL' && !data.title) {
            throw new BadRequestException('Titulo e obrigatorio para casos.');
        }

        const tenantId = await this.resolveTenantId(data.tenantId);
        const code = await this.buildProcessCode(tenantId, data);

        const processData = {
            tenantId,
            contactId: data.contactId,
            cnj: this.normalizeCnj(data.cnj),
            category: data.category,
            title: data.title || `Processo ${this.normalizeCnj(data.cnj) || data.cnj}`,
            code,
            description: data.description,
            folder: data.folder,
            court: data.court,
            courtSystem: data.courtSystem,
            npu: this.normalizeCnj(data.cnj),
            vars: data.vars,
            district: data.district,
            status: data.status || 'ATIVO',
            area: data.area,
            subject: data.subject,
            class: data.class,
            distributionDate: this.parseDate(data.distributionDate),
            judge: data.judge,
            value: this.parseMoneyValue(data.value),
            parties: Array.isArray(data.parties) ? data.parties : [],
            metadata: data.metadata || {},
        };

        this.logAudit('2_MAPPED_DATA', processData);

        try {
            const process =
                data.category === 'JUDICIAL' && data.cnj
                    ? await this.prisma.process.upsert({
                        where: { cnj: processData.cnj! },
                        update: {
                            contactId: processData.contactId,
                            cnj: processData.cnj,
                            category: processData.category,
                            title: processData.title,
                            code: processData.code,
                            description: processData.description,
                            folder: processData.folder,
                            court: processData.court,
                            courtSystem: processData.courtSystem,
                            vars: processData.vars,
                            district: processData.district,
                            status: processData.status,
                            area: processData.area,
                            subject: processData.subject,
                            class: processData.class,
                            distributionDate: processData.distributionDate,
                            judge: processData.judge,
                            value: processData.value,
                            parties: processData.parties,
                            metadata: processData.metadata,
                        },
                        create: processData,
                    })
                    : await this.prisma.process.create({
                        data: processData,
                    });

            this.logAudit('3_SAVED_RESULT', process);
            console.log(`Process saved successfully: ${process.id}`);

            if (
                (Array.isArray(processData.parties) && processData.parties.length > 0) ||
                this.isInformativeJudgeName(processData.judge)
            ) {
                await this.syncImportedProcessParties(
                    process.id,
                    tenantId,
                    processData.parties as any[],
                    processData.judge,
                );
            }

            await this.syncMicrosoftFolder(tenantId, process.id);
            return this.findOne(process.id, tenantId);
        } catch (error: any) {
            this.logAudit('ERROR_SAVING', { error: error.message, stack: error.stack });
            console.error('Error creating/upserting process:', error);
            throw error;
        }
    }

    async findAll(params: {
        tenantId: string,
        search?: string,
        includedTags?: string,
        excludedTags?: string,
        status?: string
    }) {
        if (!params.tenantId) {
            throw new BadRequestException('Tenant ID is required');
        }
        const { tenantId, search, includedTags, excludedTags, status } = params;

        const where: any = { tenantId };

        if (search) {
            where.OR = [
                { cnj: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { court: { contains: search, mode: 'insensitive' } },
                { district: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (includedTags || excludedTags) {
            if (!where.AND) where.AND = [];

            if (includedTags) {
                const incArray = includedTags.split(',');
                where.AND.push({
                    tags: {
                        some: { tagId: { in: incArray } },
                    },
                });
            }

            if (excludedTags) {
                const excArray = excludedTags.split(',');
                where.AND.push({
                    tags: {
                        none: { tagId: { in: excArray } },
                    },
                });
            }
        }

        return this.prisma.process.findMany({
            where,
            include: {
                tags: {
                    include: {
                        tag: true,
                    },
                },
                processParties: {
                    include: {
                        contact: {
                            select: { id: true, name: true, email: true, phone: true, whatsapp: true },
                        },
                        role: { select: { name: true, category: true } },
                        qualification: { select: { name: true } },
                    },
                },
                timeline: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { date: true, title: true, description: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, tenantId: string) {
        const process = await this.prisma.process.findFirst({
            where: { id, tenantId },
            include: this.buildProcessInclude(),
        });

        if (!process) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        return process;
    }

    async update(id: string, data: Partial<CreateProcessDto>, tenantId: string) {
        const existing = await this.prisma.process.findFirst({ where: { id, tenantId } });
        if (!existing) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        this.logAudit('UPDATE_RECEIVED', { id, data });

        const updateData: any = {};

        if (data.title !== undefined) updateData.title = data.title;
        if (data.cnj !== undefined) {
            updateData.cnj = this.normalizeCnj(data.cnj);
            updateData.npu = this.normalizeCnj(data.cnj);
        }
        if (data.category !== undefined) updateData.category = data.category;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.folder !== undefined) updateData.folder = data.folder;
        if (data.court !== undefined) updateData.court = data.court;
        if (data.courtSystem !== undefined) updateData.courtSystem = data.courtSystem;
        if (data.vars !== undefined) updateData.vars = data.vars;
        if (data.district !== undefined) updateData.district = data.district;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.area !== undefined) updateData.area = data.area;
        if (data.subject !== undefined) updateData.subject = data.subject;
        if (data.class !== undefined) updateData.class = data.class;
        if (data.judge !== undefined) updateData.judge = data.judge;
        if (data.parties !== undefined) updateData.parties = data.parties;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;
        if (data.contactId !== undefined) updateData.contactId = data.contactId;

        if (data.distributionDate !== undefined) {
            updateData.distributionDate = this.parseDate(data.distributionDate);
        }

        if (data.value !== undefined) {
            updateData.value = this.parseMoneyValue(data.value);
        }

        try {
            const updated = await this.prisma.process.update({
                where: { id },
                data: updateData,
            });

            this.logAudit('UPDATE_SUCCESS', { id, updated });
            console.log(`Process updated: ${id}`);

            if (
                (Array.isArray(data.parties) && data.parties.length > 0) ||
                this.isInformativeJudgeName(data.judge)
            ) {
                await this.syncImportedProcessParties(
                    updated.id,
                    tenantId,
                    Array.isArray(data.parties) ? data.parties : [],
                    data.judge,
                );
            }

            await this.syncMicrosoftFolder(tenantId, updated.id);
            return this.findOne(updated.id, tenantId);
        } catch (error: any) {
            this.logAudit('UPDATE_ERROR', { id, error: error.message });
            console.error('Error updating process:', error);
            throw error;
        }
    }

    async remove(id: string, tenantId: string) {
        const existing = await this.prisma.process.findFirst({ where: { id, tenantId } });
        if (!existing) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        this.logAudit('DELETE', { id, title: existing.title, cnj: existing.cnj });

        await this.prisma.processTimeline.deleteMany({ where: { processId: id } });

        const deleted = await this.prisma.process.delete({ where: { id } });
        console.log(`Process deleted: ${id} (${existing.title || existing.cnj})`);
        return { success: true, deleted: { id: deleted.id, title: deleted.title } };
    }

    async bulkAction(tenantId: string, dto: any) {
        const { action, tagId, status, lawyerName, category, processIds } = dto;
        const whereClause: any = { tenantId };

        if (processIds && processIds.length > 0) {
            whereClause.id = { in: processIds };
        } else {
            if (category) whereClause.category = category;
            if (status) whereClause.status = status;
            if (dto.search) {
                whereClause.OR = [
                    { title: { contains: dto.search, mode: 'insensitive' } },
                    { cnj: { contains: dto.search, mode: 'insensitive' } },
                    { client: { contains: dto.search, mode: 'insensitive' } },
                ];
            }
        }

        const processes = await this.prisma.process.findMany({
            where: whereClause,
            select: { id: true },
        });

        const ids = processes.map(p => p.id);
        if (ids.length === 0) return { updatedCount: 0 };

        switch (action) {
            case 'ADD_TAG':
                if (!tagId) throw new BadRequestException('Tag ID is required');
                await this.prisma.processTag.createMany({
                    data: ids.map(processId => ({
                        processId,
                        tagId,
                    })),
                    skipDuplicates: true,
                });
                return { updatedCount: ids.length };

            case 'REMOVE_TAG':
                if (!tagId) throw new BadRequestException('Tag ID is required');
                await this.prisma.processTag.deleteMany({
                    where: {
                        processId: { in: ids },
                        tagId,
                    },
                });
                return { updatedCount: ids.length };

            case 'UPDATE_STATUS':
                if (!status) throw new BadRequestException('Status is required');
                await this.prisma.process.updateMany({
                    where: { id: { in: ids } },
                    data: { status },
                });
                return { updatedCount: ids.length };

            case 'UPDATE_LAWYER':
                if (!lawyerName) throw new BadRequestException('Lawyer name is required');
                await this.prisma.process.updateMany({
                    where: { id: { in: ids } },
                    data: { responsibleLawyer: lawyerName },
                });
                return { updatedCount: ids.length };

            default:
                throw new BadRequestException('Invalid bulk action');
        }
    }
}
