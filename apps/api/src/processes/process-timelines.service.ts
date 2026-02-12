
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class ProcessTimelinesService {
    constructor(private prisma: PrismaService) {}

    async create(processId: string, data: any) {
        // Enforce manual origin for user-created items
        const newItem = await this.prisma.processTimeline.create({
            data: {
                processId,
                title: data.title,
                description: data.description,
                date: new Date(data.date),
                type: data.type || 'MOVEMENT',
                origin: data.origin || 'INTERNO',
                internalDate: data.internalDate ? new Date(data.internalDate) : null,
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                // Defaults
                source: 'MANUAL',
            },
        });
        return newItem;
    }

    async update(id: string, data: any) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        return this.prisma.processTimeline.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                date: data.date ? new Date(data.date) : undefined,
                internalDate: data.internalDate ? new Date(data.internalDate) : null, // Allow clearing
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null, // Allow clearing
                type: data.type,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                // Don't change origin or source typically, unless specified
            },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        return this.prisma.processTimeline.delete({
            where: { id },
        });
    }
}
