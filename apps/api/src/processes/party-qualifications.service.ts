
import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const DEFAULT_QUALIFICATIONS = [
    { name: 'CLIENTE' },
    { name: 'CONTRÁRIO' },
    { name: 'TERCEIRO' },
    { name: 'TESTEMUNHA' },
    { name: 'PERITO' },
    { name: 'INTERESSADO' },
];

@Injectable()
export class PartyQualificationsService implements OnModuleInit {

    constructor(private prisma: PrismaService) {}

    async onModuleInit() {
        await this.seedDefaultQualifications();
    }

    private async seedDefaultQualifications() {
        try {
            const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
            
            for (const tenant of tenants) {
                for (const qual of DEFAULT_QUALIFICATIONS) {
                    await this.prisma.partyQualification.upsert({
                        where: {
                            tenantId_name: {
                                tenantId: tenant.id,
                                name: qual.name,
                            }
                        },
                        update: {},
                        create: {
                            tenantId: tenant.id,
                            name: qual.name,
                            isDefault: true,
                        }
                    });
                }
            }
            console.log(`[PartyQualifications] Seeded default qualifications for ${tenants.length} tenant(s)`);
        } catch (error) {
            console.error('[PartyQualifications] Error seeding default qualifications:', error.message);
        }
    }

    async findAll(tenantId: string) {
        return this.prisma.partyQualification.findMany({
            where: { tenantId, active: true },
            orderBy: { name: 'asc' },
        });
    }

    async create(tenantId: string, name: string) {
        const existing = await this.prisma.partyQualification.findUnique({
            where: { tenantId_name: { tenantId, name: name.toUpperCase().trim() } }
        });

        if (existing) {
            if (!existing.active) {
                return this.prisma.partyQualification.update({
                    where: { id: existing.id },
                    data: { active: true },
                });
            }
            return existing; // Just return if exists
        }

        return this.prisma.partyQualification.create({
            data: {
                tenantId,
                name: name.toUpperCase().trim(),
                isDefault: false,
            }
        });
    }

    async delete(id: string) {
        const usage = await this.prisma.processParty.count({ where: { qualificationId: id } });

        if (usage > 0) {
            return this.prisma.partyQualification.update({
                where: { id },
                data: { active: false },
            });
        }

        return this.prisma.partyQualification.delete({ where: { id } });
    }
}
