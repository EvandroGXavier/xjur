import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class ProcessTimelinesService {
    constructor(private prisma: PrismaService) {}

    async create(processId: string, data: any, files?: any[], user?: string) {
        let metadata: any = data.metadata || {};
        
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch {}
        }
        
        // Add user to metadata if provided
        if (user) {
            metadata.user = user;
        }
        
        const attachments = [];

        if (files && files.length > 0) {
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(process.cwd(), 'uploads', 'timelines');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of files) {
                const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
                const filePath = path.join(uploadDir, fileName);
                fs.writeFileSync(filePath, file.buffer);

                attachments.push({
                    originalName: file.originalname,
                    fileName: fileName,
                    path: `/uploads/timelines/${fileName}`,
                    mimeType: file.mimetype,
                    size: file.size
                });
            }
        }
        
        if (attachments.length > 0) {
            metadata.attachments = attachments;
            data.type = 'FILE'; 
        }

        // --- Workflow Fields ---
        const category = data.category || 'REGISTRO';
        const status = data.status || 'PENDENTE';
        const priority = data.priority || 'MEDIA';
        const templateCode = data.templateCode || null;
        const parentTimelineId = data.parentTimelineId || null;

        // Enforce manual origin for user-created items
        const newItem = await this.prisma.processTimeline.create({
            data: {
                processId,
                title: data.title,
                description: data.description,
                date: new Date(data.date),
                type: data.type || (attachments.length > 0 ? 'FILE' : 'MOVEMENT'),
                origin: data.origin || 'INTERNO',
                internalDate: data.internalDate ? new Date(data.internalDate) : null,
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
                // Defaults
                source: 'MANUAL',
                
                // Workflow Fields
                category,
                status,
                priority,
                templateCode,
                parentTimelineId,
                requesterName: user,
                responsibleName: data.responsibleName || null,
            },
        });

        // Trigger Workflow Sequence Generation
        if (templateCode === 'WF_NOVA_DEMANDA' && !parentTimelineId) {
            await this.generateWorkflowNovaDemanda(processId, newItem.id, user);
        }

        // Trigger Appointment sync if category is AGENDA
        if (category === 'AGENDA') {
            await this.syncAppointment(newItem);
        }

        return newItem;
    }

    private async generateWorkflowNovaDemanda(processId: string, parentId: string, user?: string) {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

        const sequence = [
            {
                title: "Triagem de Documentos",
                category: "REGISTRO",
                status: "PENDENTE",
                type: "MOVEMENT",
                priority: "ALTA",
                date: now
            },
            {
                title: "Resumo Estratégico IA",
                category: "REGISTRO",
                status: "PENDENTE",
                type: "MOVEMENT",
                priority: "MEDIA",
                date: now
            },
            {
                title: "Elaborar Proposta de Honorários",
                category: "ACAO",
                status: "PENDENTE",
                type: "MOVEMENT",
                priority: "ALTA",
                internalDate: tomorrow,
                date: now
            },
            {
                title: "Coletar Assinatura do Cliente",
                category: "ACAO",
                status: "PENDENTE",
                type: "MOVEMENT",
                priority: "ALTA",
                date: now
            }
        ];

        for (const item of sequence) {
            await this.prisma.processTimeline.create({
                data: {
                    processId,
                    parentTimelineId: parentId,
                    title: item.title,
                    description: `Gerado via template WF_NOVA_DEMANDA`,
                    date: item.date,
                    type: item.type,
                    origin: 'INTERNO',
                    source: 'MANUAL',
                    category: item.category,
                    status: item.status,
                    priority: item.priority,
                    internalDate: item.internalDate || null,
                    templateCode: 'WF_NOVA_DEMANDA',
                    requesterName: user || 'sistema',
                }
            });
        }
    }

    private async syncAppointment(timeline: any) {
        // Fetch the process to get the tenantId
        const process = await this.prisma.process.findUnique({
            where: { id: timeline.processId }
        });

        if (!process) return;

        // If it's AGENDA, create an appointment
        const startAt = timeline.internalDate || timeline.fatalDate || timeline.date;
        const endAt = timeline.fatalDate || new Date(new Date(startAt).getTime() + 60 * 60 * 1000); // Default 1 hour duration

        await this.prisma.appointment.create({
            data: {
                tenantId: process.tenantId,
                processId: process.id,
                title: timeline.title,
                description: timeline.description,
                type: 'PRAZO', 
                startAt: new Date(startAt),
                endAt: new Date(endAt),
                status: 'SCHEDULED'
            }
        });
    }

    async update(id: string, data: any, files?: any[]) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        let metadata: any = existing.metadata || {};
        if (typeof metadata === 'object' && metadata !== null) {
            // keep existing
        } else {
            metadata = {};
        }

        if (data.metadata) {
             try {
                 const newMeta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
                 metadata = { ...metadata, ...newMeta };
             } catch {}
        }

        if (files && files.length > 0) {
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(process.cwd(), 'uploads', 'timelines');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const newAttachments = [];
            for (const file of files) {
                const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
                const filePath = path.join(uploadDir, fileName);
                fs.writeFileSync(filePath, file.buffer);

                newAttachments.push({
                    originalName: file.originalname,
                    fileName: fileName,
                    path: `/uploads/timelines/${fileName}`,
                    mimeType: file.mimetype,
                    size: file.size
                });
            }

            const existingAttachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
            metadata.attachments = [...existingAttachments, ...newAttachments];
        }

        const updated = await this.prisma.processTimeline.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                date: data.date ? new Date(data.date) : undefined,
                internalDate: data.internalDate ? new Date(data.internalDate) : null, 
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null, 
                type: data.type,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
                category: data.category,
                status: data.status,
                priority: data.priority,
            },
        });

        // Trigger sync if category changed to AGENDA or if dates updated and it's already an AGENDA
        // This is a naive sync. For robust usage, you would track existing appointments and update them.
        if (data.category === 'AGENDA' && existing.category !== 'AGENDA') {
             await this.syncAppointment(updated);
        }

        return updated;
    }

    async remove(id: string) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        return this.prisma.processTimeline.delete({
            where: { id },
        });
    }

    getAttachmentPath(fileName: string) {
        const path = require('path');
        return path.join(process.cwd(), 'uploads', 'timelines', fileName);
    }
}

