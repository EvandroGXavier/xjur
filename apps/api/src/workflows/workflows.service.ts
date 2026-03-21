import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WorkflowsService {
    constructor(private prisma: PrismaService) {}

    async findAll(tenantId: string) {
        return this.prisma.workflow.findMany({
            where: { tenantId },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(tenantId: string, id: string) {
        const workflow = await this.prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!workflow || workflow.tenantId !== tenantId) {
            throw new NotFoundException('Esteira de trabalho nao encontrada');
        }

        return workflow;
    }

    async create(tenantId: string, data: any) {
        if (data.isDefault) {
            await this.prisma.workflow.updateMany({
                where: { tenantId },
                data: { isDefault: false },
            });
        }

        return this.prisma.workflow.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                isDefault: data.isDefault ?? false,
                steps: {
                    create: data.steps || [],
                },
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });
    }

    async update(tenantId: string, id: string, data: any) {
        const workflow = await this.findOne(tenantId, id);

        if (data.isDefault) {
            await this.prisma.workflow.updateMany({
                where: { tenantId, id: { not: id } },
                data: { isDefault: false },
            });
        }

        if (data.steps) {
            // Remove existing steps and recreate to keep it simple for now
            await this.prisma.workflowStep.deleteMany({
                where: { workflowId: id },
            });
        }

        return this.prisma.workflow.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
                isDefault: data.isDefault,
                ...(data.steps && {
                    steps: {
                        create: data.steps,
                    },
                }),
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });
    }

    async remove(tenantId: string, id: string) {
        await this.findOne(tenantId, id);
        return this.prisma.workflow.delete({
            where: { id },
        });
    }
}
