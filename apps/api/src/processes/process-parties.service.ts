import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const DEFAULT_ROLES = [
    { name: 'AUTOR', category: 'POLO_ATIVO' },
    { name: 'AUTORA', category: 'POLO_ATIVO' },
    { name: 'REQUERENTE', category: 'POLO_ATIVO' },
    { name: 'EXEQUENTE', category: 'POLO_ATIVO' },
    { name: 'RECLAMANTE', category: 'POLO_ATIVO' },
    { name: 'IMPETRANTE', category: 'POLO_ATIVO' },
    { name: 'APELANTE', category: 'POLO_ATIVO' },
    { name: 'AGRAVANTE', category: 'POLO_ATIVO' },
    { name: 'EMBARGANTE', category: 'POLO_ATIVO' },
    { name: 'REU', category: 'POLO_PASSIVO' },
    { name: 'REQUERIDO', category: 'POLO_PASSIVO' },
    { name: 'REQUERIDA', category: 'POLO_PASSIVO' },
    { name: 'EXECUTADO', category: 'POLO_PASSIVO' },
    { name: 'EXECUTADA', category: 'POLO_PASSIVO' },
    { name: 'RECLAMADO', category: 'POLO_PASSIVO' },
    { name: 'RECLAMADA', category: 'POLO_PASSIVO' },
    { name: 'IMPETRADO', category: 'POLO_PASSIVO' },
    { name: 'APELADO', category: 'POLO_PASSIVO' },
    { name: 'AGRAVADO', category: 'POLO_PASSIVO' },
    { name: 'EMBARGADO', category: 'POLO_PASSIVO' },
    { name: 'ADVOGADO', category: 'OUTROS' },
    { name: 'ADVOGADA', category: 'OUTROS' },
    { name: 'PROCURADOR', category: 'OUTROS' },
    { name: 'PROCURADORA', category: 'OUTROS' },
    { name: 'ADVOGADO CONTRARIO', category: 'OUTROS' },
    { name: 'ADVOGADA CONTRARIA', category: 'OUTROS' },
    { name: 'TESTEMUNHA', category: 'OUTROS' },
    { name: 'PERITO', category: 'OUTROS' },
    { name: 'ASSISTENTE TECNICO', category: 'OUTROS' },
    { name: 'JUIZ', category: 'OUTROS' },
    { name: 'MAGISTRADO', category: 'OUTROS' },
    { name: 'PROMOTOR', category: 'OUTROS' },
    { name: 'DEFENSOR PUBLICO', category: 'OUTROS' },
    { name: 'TERCEIRO INTERESSADO', category: 'OUTROS' },
    { name: 'LITISCONSORTE', category: 'OUTROS' },
    { name: 'HERDEIRO', category: 'OUTROS' },
    { name: 'HERDEIRA', category: 'OUTROS' },
    { name: 'MEEIRO', category: 'OUTROS' },
    { name: 'MEEIRA', category: 'OUTROS' },
    { name: 'INVENTARIANTE', category: 'OUTROS' },
    { name: 'CURADOR', category: 'OUTROS' },
    { name: 'CURADORA', category: 'OUTROS' },
    { name: 'INTERVENIENTE', category: 'OUTROS' },
    { name: 'DENUNCIADO', category: 'OUTROS' },
];

type PoleKey = 'active' | 'passive';

interface QuickContactInput {
    name: string;
    document?: string;
    phone?: string;
    email?: string;
    personType?: string;
}

const normalizeText = (value?: string) =>
    (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

@Injectable()
export class ProcessPartiesService implements OnModuleInit {
    constructor(private prisma: PrismaService) {}

    private readonly baseContactSelect = {
        id: true,
        name: true,
        personType: true,
        document: true,
        email: true,
        phone: true,
        whatsapp: true,
        category: true,
        additionalContacts: {
            select: {
                type: true,
                value: true,
            },
        },
    };

    private readonly basePartyInclude = {
        contact: { select: this.baseContactSelect },
        role: {
            select: {
                id: true,
                name: true,
                category: true,
            },
        },
        qualification: {
            select: {
                id: true,
                name: true,
            },
        },
        representativeLinks: {
            orderBy: { createdAt: 'asc' as const },
            select: {
                id: true,
                partyId: true,
                representativePartyId: true,
                createdAt: true,
                representativeParty: {
                    include: {
                        contact: { select: this.baseContactSelect },
                        role: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                            },
                        },
                        qualification: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        },
        representedPartyLinks: {
            select: {
                id: true,
                partyId: true,
                representativePartyId: true,
            },
        },
    };

    async onModuleInit() {
        await this.seedDefaultRoles();
    }

    private async seedDefaultRoles() {
        try {
            const tenants = await this.prisma.tenant.findMany({ select: { id: true } });

            for (const tenant of tenants) {
                for (const role of DEFAULT_ROLES) {
                    await this.prisma.partyRole.upsert({
                        where: {
                            tenantId_name: {
                                tenantId: tenant.id,
                                name: role.name,
                            },
                        },
                        update: {},
                        create: {
                            tenantId: tenant.id,
                            name: role.name,
                            category: role.category,
                            isDefault: true,
                        },
                    });
                }
            }
        } catch (error: any) {
            console.error('[ProcessParties] Error seeding default roles:', error.message);
        }
    }

    private async getProcessContext(processId: string, tenantId?: string) {
        const process = await this.prisma.process.findFirst({
            where: {
                id: processId,
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true, tenantId: true },
        });

        if (!process) throw new NotFoundException('Processo nao encontrado');
        return process;
    }

    private async ensureContactExists(contactId: string, tenantId?: string) {
        const contact = await this.prisma.contact.findFirst({
            where: {
                id: contactId,
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true, name: true },
        });

        if (!contact) throw new NotFoundException('Contato nao encontrado');
        return contact;
    }

    private async getTenantRoles(tenantId: string) {
        return this.prisma.partyRole.findMany({
            where: { tenantId, active: true },
            select: { id: true, name: true, category: true },
            orderBy: { createdAt: 'asc' },
        });
    }

    private async resolveRoleId(tenantId: string, candidateNames: string[]) {
        const normalizedCandidates = candidateNames.map(name => normalizeText(name));
        const roles = await this.getTenantRoles(tenantId);

        for (const candidate of normalizedCandidates) {
            const role = roles.find(item => normalizeText(item.name) === candidate);
            if (role) return role.id;
        }

        throw new NotFoundException(`Tipo de parte padrao nao encontrado: ${candidateNames[0]}`);
    }

    private getPrincipalRoleCandidates(pole: PoleKey) {
        return pole === 'active' ? ['AUTOR', 'AUTORA', 'REQUERENTE'] : ['REU', 'REQUERIDO', 'REQUERIDA'];
    }

    private getRepresentativeRoleCandidates(pole: PoleKey) {
        return pole === 'active'
            ? ['ADVOGADO', 'ADVOGADA', 'PROCURADOR', 'PROCURADORA']
            : ['ADVOGADO CONTRARIO', 'ADVOGADA CONTRARIA', 'ADVOGADO', 'ADVOGADA', 'PROCURADOR', 'PROCURADORA'];
    }

    private inferPoleFromRole(roleName?: string, category?: string | null): PoleKey | null {
        const normalizedCategory = normalizeText(category || '');
        if (normalizedCategory === 'POLO_ATIVO') return 'active';
        if (normalizedCategory === 'POLO_PASSIVO') return 'passive';

        const normalizedName = normalizeText(roleName);
        if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'RECLAMANTE', 'IMPETRANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalizedName.includes(term))) {
            return 'active';
        }
        if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'RECLAMADO', 'RECLAMADA', 'IMPETRADO', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalizedName.includes(term))) {
            return 'passive';
        }

        return null;
    }

    private isLawyerRole(roleName?: string) {
        const normalizedName = normalizeText(roleName);
        return ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some(term => normalizedName.includes(term));
    }

    private async createQuickContact(tenantId: string, data: QuickContactInput, category = 'Outro') {
        if (!data?.name?.trim()) {
            throw new ConflictException('Informe o nome do contato');
        }

        return this.prisma.contact.create({
            data: {
                tenantId,
                name: data.name.trim(),
                document: data.document,
                phone: data.phone || '',
                email: data.email,
                personType: data.personType || 'PF',
                category,
            },
            select: { id: true, name: true },
        });
    }

    private async resolveContactId(
        processId: string,
        tenantId: string,
        contactId?: string,
        quickContact?: QuickContactInput,
        category = 'Outro',
    ) {
        if (contactId) {
            const contact = await this.ensureContactExists(contactId, tenantId);
            return contact.id;
        }

        if (!quickContact?.name?.trim()) {
            throw new BadRequestException('Selecione um contato existente ou informe os dados do cadastro rapido.');
        }

        const process = await this.getProcessContext(processId, tenantId);
        const contact = await this.createQuickContact(process.tenantId, quickContact!, category);
        return contact.id;
    }

    private async ensureQualificationExists(tenantId: string, qualificationId?: string) {
        if (!qualificationId) return null;

        const qualification = await this.prisma.partyQualification.findFirst({
            where: {
                id: qualificationId,
                tenantId,
                active: true,
            },
            select: { id: true },
        });

        if (!qualification) {
            throw new NotFoundException('Qualificacao da parte nao encontrada');
        }

        return qualification;
    }

    async findAllRoles(tenantId: string) {
        return this.prisma.partyRole.findMany({
            where: { tenantId, active: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
    }

    async createRole(tenantId: string, name: string, category?: string) {
        const normalizedName = normalizeText(name);
        const existing = await this.prisma.partyRole.findUnique({
            where: { tenantId_name: { tenantId, name: normalizedName } },
        });

        if (existing) {
            if (!existing.active) {
                return this.prisma.partyRole.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            }
            throw new ConflictException(`O tipo de parte "${name}" ja existe`);
        }

        return this.prisma.partyRole.create({
            data: {
                tenantId,
                name: normalizedName,
                category: category || 'OUTROS',
                isDefault: false,
            },
        });
    }

    async deleteRole(id: string, tenantId: string) {
        const role = await this.prisma.partyRole.findFirst({
            where: { id, tenantId },
            select: { id: true },
        });
        if (!role) throw new NotFoundException('Tipo de parte nao encontrado');

        const usage = await this.prisma.processParty.count({ where: { roleId: id, tenantId } });

        if (usage > 0) {
            return this.prisma.partyRole.update({
                where: { id },
                data: { active: false },
            });
        }

        return this.prisma.partyRole.delete({ where: { id } });
    }

    async findByProcess(processId: string, tenantId: string) {
        const process = await this.getProcessContext(processId, tenantId);
        return this.prisma.processParty.findMany({
            where: {
                processId: process.id,
                tenantId: process.tenantId,
            },
            include: this.basePartyInclude,
            orderBy: { createdAt: 'asc' },
        });
    }

    async addParty(data: {
        tenantId: string;
        processId: string;
        contactId: string;
        roleId: string;
        qualificationId?: string;
        isClient?: boolean;
        isOpposing?: boolean;
        notes?: string;
    }) {
        const process = await this.getProcessContext(data.processId, data.tenantId);
        await this.ensureContactExists(data.contactId, process.tenantId);

        const role = await this.prisma.partyRole.findFirst({
            where: {
                id: data.roleId,
                tenantId: process.tenantId,
                active: true,
            },
            select: { id: true },
        });
        if (!role) throw new NotFoundException('Tipo de parte nao encontrado');

        await this.ensureQualificationExists(process.tenantId, data.qualificationId);

        try {
            return await this.prisma.processParty.create({
                data: {
                    tenantId: process.tenantId,
                    processId: data.processId,
                    contactId: data.contactId,
                    roleId: data.roleId,
                    qualificationId: data.qualificationId,
                    isClient: data.isClient || false,
                    isOpposing: data.isOpposing || false,
                    notes: data.notes,
                },
                include: this.basePartyInclude,
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new ConflictException('Este contato ja tem este papel neste processo');
            }
            throw error;
        }
    }

    async addPrincipalParty(data: {
        tenantId: string;
        processId: string;
        pole: PoleKey;
        contactId?: string;
        quickContact?: QuickContactInput;
        notes?: string;
    }) {
        const process = await this.getProcessContext(data.processId, data.tenantId);
        const resolvedContactId = await this.resolveContactId(
            data.processId,
            process.tenantId,
            data.contactId,
            data.quickContact,
            'Parte',
        );
        const roleId = await this.resolveRoleId(process.tenantId, this.getPrincipalRoleCandidates(data.pole));

        return this.addParty({
            tenantId: process.tenantId,
            processId: data.processId,
            contactId: resolvedContactId,
            roleId,
            notes: data.notes,
        });
    }

    async addRepresentative(data: {
        tenantId: string;
        processId: string;
        partyId: string;
        contactId?: string;
        quickContact?: QuickContactInput;
        notes?: string;
    }) {
        const process = await this.getProcessContext(data.processId, data.tenantId);

        const principalParty = await this.prisma.processParty.findFirst({
            where: {
                id: data.partyId,
                processId: data.processId,
                tenantId: process.tenantId,
            },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                    },
                },
            },
        });

        if (!principalParty) throw new NotFoundException('Parte principal nao encontrada');

        const pole = this.inferPoleFromRole(principalParty.role.name, principalParty.role.category) || 'active';
        const resolvedContactId = await this.resolveContactId(
            data.processId,
            process.tenantId,
            data.contactId,
            data.quickContact,
            'Advogado',
        );
        const roleId = await this.resolveRoleId(process.tenantId, this.getRepresentativeRoleCandidates(pole));

        let representativeParty = await this.prisma.processParty.findFirst({
            where: {
                processId: data.processId,
                contactId: resolvedContactId,
                roleId,
                tenantId: process.tenantId,
            },
            include: this.basePartyInclude,
        });

        if (!representativeParty) {
            representativeParty = await this.prisma.processParty.create({
                data: {
                    tenantId: process.tenantId,
                    processId: data.processId,
                    contactId: resolvedContactId,
                    roleId,
                    notes: data.notes,
                },
                include: this.basePartyInclude,
            });
        }

        try {
            await this.prisma.processPartyRepresentation.create({
                data: {
                    tenantId: process.tenantId,
                    processId: data.processId,
                    partyId: data.partyId,
                    representativePartyId: representativeParty.id,
                },
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new ConflictException('Este procurador ja esta vinculado a esta parte');
            }
            throw error;
        }

        return this.findByProcess(data.processId, process.tenantId);
    }

    async unlinkRepresentative(processId: string, partyId: string, representativePartyId: string, tenantId: string) {
        const process = await this.getProcessContext(processId, tenantId);
        const link = await this.prisma.processPartyRepresentation.findFirst({
            where: {
                processId: process.id,
                partyId,
                representativePartyId,
                tenantId: process.tenantId,
            },
        });

        if (!link) throw new NotFoundException('Vinculo de procurador nao encontrado');

        await this.prisma.processPartyRepresentation.delete({ where: { id: link.id } });
        await this.cleanupOrphanRepresentativeParties(process.id, process.tenantId, [representativePartyId]);

        return { success: true };
    }

    async updateParty(id: string, data: {
        tenantId: string;
        roleId?: string;
        qualificationId?: string;
        isClient?: boolean;
        isOpposing?: boolean;
        notes?: string;
    }) {
        const existing = await this.prisma.processParty.findFirst({
            where: {
                id,
                tenantId: data.tenantId,
            },
            include: {
                role: {
                    select: {
                        name: true,
                        category: true,
                    },
                },
            },
        });
        if (!existing) throw new NotFoundException('Parte nao encontrada');

        if (data.roleId) {
            const role = await this.prisma.partyRole.findFirst({
                where: {
                    id: data.roleId,
                    tenantId: data.tenantId,
                    active: true,
                },
                select: { id: true },
            });
            if (!role) throw new NotFoundException('Tipo de parte nao encontrado');
        }

        await this.ensureQualificationExists(data.tenantId, data.qualificationId);

        const nextIsClient = data.isClient !== undefined ? data.isClient : existing.isClient;
        const nextIsOpposing = nextIsClient
            ? false
            : data.isOpposing !== undefined
                ? data.isOpposing
                : existing.isOpposing;

        if (existing.isClient && !nextIsClient) {
            const otherClientCount = await this.prisma.processParty.count({
                where: {
                    processId: existing.processId,
                    tenantId: data.tenantId,
                    isClient: true,
                    id: { not: existing.id },
                },
            });

            if (otherClientCount === 0) {
                throw new ConflictException('O processo precisa manter ao menos um Cliente Principal vinculado.');
            }
        }

        return this.prisma.processParty.update({
            where: { id },
            data: {
                roleId: data.roleId !== undefined ? data.roleId : undefined,
                qualificationId: data.qualificationId !== undefined ? data.qualificationId : undefined,
                isClient: data.isClient !== undefined ? nextIsClient : undefined,
                isOpposing: data.isClient !== undefined || data.isOpposing !== undefined ? nextIsOpposing : undefined,
                notes: data.notes !== undefined ? data.notes : undefined,
            },
            include: this.basePartyInclude,
        });
    }

    private async cleanupOrphanRepresentativeParties(processId: string, tenantId: string, partyIds: string[]) {
        if (!partyIds.length) return;

        const candidates = await this.prisma.processParty.findMany({
            where: {
                id: { in: partyIds },
                processId,
                tenantId,
            },
            include: {
                representedPartyLinks: {
                    select: { id: true },
                },
                role: {
                    select: { name: true },
                },
            },
        });

        const orphanIds = candidates
            .filter(item => this.isLawyerRole(item.role?.name) && item.representedPartyLinks.length === 0)
            .map(item => item.id);

        if (orphanIds.length > 0) {
            await this.prisma.processParty.deleteMany({
                where: { id: { in: orphanIds } },
            });
        }
    }

    async removeParty(id: string, tenantId: string) {
        const existing = await this.prisma.processParty.findFirst({
            where: {
                id,
                tenantId,
            },
            include: {
                contact: { select: { name: true } },
                role: { select: { name: true } },
                representativeLinks: { select: { representativePartyId: true } },
            },
        });
        if (!existing) throw new NotFoundException('Parte nao encontrada');

        if (existing.isClient) {
            const otherClientCount = await this.prisma.processParty.count({
                where: {
                    processId: existing.processId,
                    tenantId,
                    isClient: true,
                    id: { not: existing.id },
                },
            });

            if (otherClientCount === 0) {
                throw new ConflictException('O processo precisa manter ao menos um Cliente Principal vinculado.');
            }
        }

        const linkedRepresentativeIds = existing.representativeLinks.map(link => link.representativePartyId);

        await this.prisma.processParty.delete({ where: { id } });
        await this.cleanupOrphanRepresentativeParties(existing.processId, tenantId, linkedRepresentativeIds);

        return {
            success: true,
            removed: {
                name: existing.contact.name,
                role: existing.role.name,
            },
        };
    }

    async quickContactAndParty(data: {
        tenantId: string;
        processId: string;
        name: string;
        document?: string;
        phone?: string;
        email?: string;
        personType?: string;
        roleId: string;
        qualificationId?: string;
        isClient?: boolean;
        isOpposing?: boolean;
    }) {
        const process = await this.getProcessContext(data.processId, data.tenantId);
        const contact = await this.createQuickContact(
            process.tenantId,
            {
                name: data.name,
                document: data.document,
                phone: data.phone,
                email: data.email,
                personType: data.personType,
            },
            data.isClient ? 'Cliente' : data.isOpposing ? 'Parte Contraria' : 'Outro',
        );

        return this.addParty({
            tenantId: process.tenantId,
            processId: data.processId,
            contactId: contact.id,
            roleId: data.roleId,
            qualificationId: data.qualificationId,
            isClient: data.isClient,
            isOpposing: data.isOpposing,
        });
    }
}
