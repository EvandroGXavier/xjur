import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Roles padrão pré-cadastrados por tenant
const DEFAULT_ROLES = [
    // Polo Ativo
    { name: 'AUTOR', category: 'POLO_ATIVO' },
    { name: 'AUTORA', category: 'POLO_ATIVO' },
    { name: 'REQUERENTE', category: 'POLO_ATIVO' },
    { name: 'EXEQUENTE', category: 'POLO_ATIVO' },
    { name: 'RECLAMANTE', category: 'POLO_ATIVO' },
    { name: 'IMPETRANTE', category: 'POLO_ATIVO' },
    { name: 'APELANTE', category: 'POLO_ATIVO' },
    { name: 'AGRAVANTE', category: 'POLO_ATIVO' },
    { name: 'EMBARGANTE', category: 'POLO_ATIVO' },
    // Polo Passivo
    { name: 'RÉU', category: 'POLO_PASSIVO' },
    { name: 'RÉ', category: 'POLO_PASSIVO' },
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
    // Outros
    { name: 'TESTEMUNHA', category: 'OUTROS' },
    { name: 'PERITO', category: 'OUTROS' },
    { name: 'ASSISTENTE TÉCNICO', category: 'OUTROS' },
    { name: 'JUIZ', category: 'OUTROS' },
    { name: 'MAGISTRADO', category: 'OUTROS' },
    { name: 'PROMOTOR', category: 'OUTROS' },
    { name: 'DEFENSOR PÚBLICO', category: 'OUTROS' },
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
    { name: 'ADVOGADO CONTRÁRIO', category: 'OUTROS' },
    { name: 'DENUNCIADO', category: 'OUTROS' },
];

@Injectable()
export class ProcessPartiesService implements OnModuleInit {

    constructor(private prisma: PrismaService) {}

    // ─── INICIALIZAÇÃO: Seed de roles padrão ───────────────
    async onModuleInit() {
        await this.seedDefaultRoles();
    }

    private async seedDefaultRoles() {
        try {
            // Buscar todos os tenants
            const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
            
            for (const tenant of tenants) {
                for (const role of DEFAULT_ROLES) {
                    await this.prisma.partyRole.upsert({
                        where: {
                            tenantId_name: {
                                tenantId: tenant.id,
                                name: role.name,
                            }
                        },
                        update: {},  // Não atualiza se já existir
                        create: {
                            tenantId: tenant.id,
                            name: role.name,
                            category: role.category,
                            isDefault: true,
                        }
                    });
                }
            }
            console.log(`[ProcessParties] Seeded default roles for ${tenants.length} tenant(s)`);
        } catch (error) {
            console.error('[ProcessParties] Error seeding default roles:', error.message);
        }
    }

    // ─── PARTY ROLES (CRUD) ───────────────────────────────
    
    async findAllRoles(tenantId: string) {
        return this.prisma.partyRole.findMany({
            where: { tenantId, active: true },
            orderBy: [
                { category: 'asc' },
                { name: 'asc' },
            ],
        });
    }

    async createRole(tenantId: string, name: string, category?: string) {
        // Verificar se já existe
        const existing = await this.prisma.partyRole.findUnique({
            where: { tenantId_name: { tenantId, name: name.toUpperCase().trim() } }
        });

        if (existing) {
            if (!existing.active) {
                // Reativar role desativado
                return this.prisma.partyRole.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            }
            throw new ConflictException(`O tipo de parte "${name}" já existe`);
        }

        return this.prisma.partyRole.create({
            data: {
                tenantId,
                name: name.toUpperCase().trim(),
                category: category || 'OUTROS',
                isDefault: false,
            }
        });
    }

    async deleteRole(id: string) {
        // Verificar se está em uso
        const usage = await this.prisma.processParty.count({ where: { roleId: id } });

        if (usage > 0) {
            // Desativar em vez de deletar
            return this.prisma.partyRole.update({
                where: { id },
                data: { active: false },
            });
        }

        return this.prisma.partyRole.delete({ where: { id } });
    }

    // ─── PROCESS PARTIES (CRUD) ────────────────────────────

    async findByProcess(processId: string) {
        return this.prisma.processParty.findMany({
            where: { processId },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        personType: true,
                        document: true,
                        email: true,
                        phone: true,
                        whatsapp: true,
                        category: true,
                    }
                },
                role: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                    }
                },
                qualification: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: [
                { role: { category: 'asc' } },
                { createdAt: 'asc' },
            ]
        });
    }

    async addParty(data: {
        processId: string;
        contactId: string;
        roleId: string;
        qualificationId?: string;
        isClient?: boolean;
        isOpposing?: boolean;
        notes?: string;
    }) {
        // Buscar processo para obter tenantId
        const process = await this.prisma.process.findUnique({
            where: { id: data.processId },
            select: { tenantId: true },
        });
        if (!process) throw new NotFoundException('Processo não encontrado');

        // Verificar se contato existe
        const contact = await this.prisma.contact.findUnique({
            where: { id: data.contactId },
            select: { id: true },
        });
        if (!contact) throw new NotFoundException('Contato não encontrado');

        // Verificar se role existe
        const role = await this.prisma.partyRole.findUnique({
            where: { id: data.roleId },
            select: { id: true },
        });
        if (!role) throw new NotFoundException('Tipo de parte não encontrado');

        try {
            const party = await this.prisma.processParty.create({
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
                include: {
                    contact: {
                        select: { id: true, name: true, personType: true, document: true }
                    },
                    role: {
                        select: { id: true, name: true, category: true }
                    },
                    qualification: {
                        select: { id: true, name: true }
                    }
                }
            });

            console.log(`[Party] Added ${party.contact.name} as ${party.role.name} to process ${data.processId}`);
            return party;
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Este contato já tem este papel neste processo');
            }
            throw error;
        }
    }

    async updateParty(id: string, data: {
        roleId?: string;
        qualificationId?: string;
        isClient?: boolean;
        isOpposing?: boolean;
        notes?: string;
    }) {
        const existing = await this.prisma.processParty.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Parte não encontrada');

        return this.prisma.processParty.update({
            where: { id },
            data: {
                roleId: data.roleId !== undefined ? data.roleId : undefined,
                qualificationId: data.qualificationId !== undefined ? data.qualificationId : undefined,
                isClient: data.isClient !== undefined ? data.isClient : undefined,
                isOpposing: data.isOpposing !== undefined ? data.isOpposing : undefined,
                notes: data.notes !== undefined ? data.notes : undefined,
            },
            include: {
                contact: {
                    select: { id: true, name: true, personType: true, document: true }
                },
                role: {
                    select: { id: true, name: true, category: true }
                },
                qualification: {
                    select: { id: true, name: true }
                }
            }
        });
    }

    async removeParty(id: string) {
        const existing = await this.prisma.processParty.findUnique({
            where: { id },
            include: { contact: { select: { name: true } }, role: { select: { name: true } } }
        });
        if (!existing) throw new NotFoundException('Parte não encontrada');

        await this.prisma.processParty.delete({ where: { id } });
        console.log(`[Party] Removed ${existing.contact.name} (${existing.role.name}) from process ${existing.processId}`);
        return { success: true, removed: { name: existing.contact.name, role: existing.role.name } };
    }

    // ─── QUICK CONTACT: Cria contato + adiciona como parte ───
    async quickContactAndParty(data: {
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
        const process = await this.prisma.process.findUnique({
            where: { id: data.processId },
            select: { tenantId: true },
        });
        if (!process) throw new NotFoundException('Processo não encontrado');

        // Criar contato
        const contact = await this.prisma.contact.create({
            data: {
                tenantId: process.tenantId,
                name: data.name,
                document: data.document,
                phone: data.phone || '',
                email: data.email,
                personType: data.personType || 'PF',
                category: data.isClient ? 'Cliente' : data.isOpposing ? 'Parte Contrária' : 'Outro',
            }
        });

        // Adicionar como parte
        const party = await this.addParty({
            processId: data.processId,
            contactId: contact.id,
            roleId: data.roleId,
            qualificationId: data.qualificationId,
            isClient: data.isClient,
            isOpposing: data.isOpposing,
        });

        console.log(`[QuickParty] Created contact "${data.name}" and added as party to process ${data.processId}`);
        return party;
    }
}
