import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class ProcessTimelinesService {
    constructor(private prisma: PrismaService) {}

    private async getProcessContext(processId: string, tenantId?: string) {
        const process = await this.prisma.process.findFirst({
            where: {
                id: processId,
                ...(tenantId ? { tenantId } : {}),
            },
            select: {
                id: true,
                tenantId: true,
            },
        });

        if (!process) {
            throw new NotFoundException('Processo nao encontrado.');
        }

        return process;
    }

    private async getTimelineContext(id: string, tenantId?: string) {
        const timeline = await this.prisma.processTimeline.findFirst({
            where: {
                id,
                ...(tenantId ? { process: { is: { tenantId } } } : {}),
            },
        });

        if (!timeline) {
            throw new NotFoundException('Andamento nao encontrado.');
        }

        return timeline;
    }

    async listTasksForTenant(
        tenantId: string,
        currentUserEmail: string,
        query: {
            q?: string;
            scope?: 'mine' | 'all' | 'unassigned';
            status?: string;
            category?: string;
            overdue?: string;
            includeCompleted?: string;
            limit?: string;
        } = {},
    ) {
        const search = String(query.q || '').trim();
        const scope = (query.scope || 'mine') as 'mine' | 'all' | 'unassigned';
        const includeCompleted = String(query.includeCompleted || '').toLowerCase() === 'true';
        const overdueOnly = String(query.overdue || '').toLowerCase() === 'true';
        const limit = Math.min(Math.max(parseInt(String(query.limit || '200'), 10) || 200, 1), 500);

        const baseWhere: any = {
            process: { is: { tenantId } },
            AND: [
                {
                    OR: [
                        { category: { in: ['ACAO', 'AGENDA'] } },
                        { internalDate: { not: null } },
                        { fatalDate: { not: null } },
                        { responsibleName: { not: null } },
                    ],
                },
            ],
        };

        if (!includeCompleted) {
            baseWhere.AND.push({ status: { not: 'CONCLUIDO' } });
        }

        if (query.category) {
            baseWhere.AND.push({ category: String(query.category) });
        }

        if (query.status) {
            baseWhere.AND.push({ status: String(query.status) });
        }

        if (scope === 'mine') {
            baseWhere.AND.push({
                responsibleName: { equals: currentUserEmail, mode: 'insensitive' },
            });
        } else if (scope === 'unassigned') {
            baseWhere.AND.push({
                OR: [{ responsibleName: null }, { responsibleName: '' }],
            });
        }

        if (overdueOnly) {
            const now = new Date();
            baseWhere.AND.push({ status: { not: 'CONCLUIDO' } });
            baseWhere.AND.push({
                OR: [{ fatalDate: { lt: now } }, { internalDate: { lt: now } }],
            });
        }

        if (search) {
            baseWhere.AND.push({
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { responsibleName: { contains: search, mode: 'insensitive' } },
                    { requesterName: { contains: search, mode: 'insensitive' } },
                    { process: { is: { title: { contains: search, mode: 'insensitive' } } } },
                    { process: { is: { code: { contains: search, mode: 'insensitive' } } } },
                    { process: { is: { cnj: { contains: search, mode: 'insensitive' } } } },
                ],
            });
        }

        const items = await this.prisma.processTimeline.findMany({
            where: baseWhere,
            include: {
                process: {
                    select: {
                        id: true,
                        code: true,
                        title: true,
                        cnj: true,
                        status: true,
                        category: true,
                    },
                },
            },
            orderBy: [
                { fatalDate: 'asc' },
                { internalDate: 'asc' },
                { date: 'desc' },
            ],
            take: limit,
        });

        const now = new Date();
        const summaryBaseWhere: any = {
            process: { is: { tenantId } },
            OR: [
                { category: { in: ['ACAO', 'AGENDA'] } },
                { internalDate: { not: null } },
                { fatalDate: { not: null } },
                { responsibleName: { not: null } },
            ],
        };

        const [myOpen, myOverdue, openTotal, overdueTotal] = await Promise.all([
            this.prisma.processTimeline.count({
                where: {
                    ...summaryBaseWhere,
                    status: { not: 'CONCLUIDO' },
                    responsibleName: { equals: currentUserEmail, mode: 'insensitive' },
                },
            }),
            this.prisma.processTimeline.count({
                where: {
                    ...summaryBaseWhere,
                    status: { not: 'CONCLUIDO' },
                    responsibleName: { equals: currentUserEmail, mode: 'insensitive' },
                    OR: [{ fatalDate: { lt: now } }, { internalDate: { lt: now } }],
                },
            }),
            this.prisma.processTimeline.count({
                where: {
                    ...summaryBaseWhere,
                    status: { not: 'CONCLUIDO' },
                },
            }),
            this.prisma.processTimeline.count({
                where: {
                    ...summaryBaseWhere,
                    status: { not: 'CONCLUIDO' },
                    OR: [{ fatalDate: { lt: now } }, { internalDate: { lt: now } }],
                },
            }),
        ]);

        return {
            items: items.map((item) => ({
                ...item,
                dueAt: item.fatalDate || item.internalDate || null,
                isOverdue:
                    item.status !== 'CONCLUIDO' &&
                    ((item.fatalDate && item.fatalDate < now) ||
                        (item.internalDate && item.internalDate < now)) &&
                    true,
            })),
            summary: {
                myOpen,
                myOverdue,
                openTotal,
                overdueTotal,
            },
        };
    }

    async create(processId: string, data: any, files?: any[], user?: string, tenantId?: string) {
        await this.getProcessContext(processId, tenantId);
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
        const priority = data.priority || 'BAIXA';
        const templateCode = data.templateCode || null;
        const parentTimelineId = data.parentTimelineId || null;

        // Enforce manual origin for user-created items
        const newItem = await this.prisma.processTimeline.create({
            data: {
                processId,
                title: data.title,
                description: data.description,
                date: data.date ? new Date(data.date) : new Date(),
                type: data.type || (attachments.length > 0 ? 'FILE' : 'MOVEMENT'),
                origin: data.origin || 'INTERNO',
                internalDate: data.internalDate !== undefined ? (data.internalDate ? new Date(data.internalDate) : null) : undefined, 
                fatalDate: data.fatalDate !== undefined ? (data.fatalDate ? new Date(data.fatalDate) : null) : undefined, 
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
                // Defaults
                source: data.source || 'MANUAL',
                
                // Workflow Fields
                category,
                status,
                priority,
                templateCode,
                parentTimelineId,
                workflowStepId: data.workflowStepId || null,
                requesterName: user || 'sistema',
                responsibleName: data.responsibleName || null,
                completedAt: status === 'CONCLUIDO' ? new Date() : null,
                responsibleHistory: data.responsibleName ? [{ name: data.responsibleName, date: new Date() }] : [],
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

    /**
     * Creates a system-generated movement (AUTOMÁTICO)
     */
    async createSystemTimeline(processId: string, title: string, description: string, metadata: any = {}, category: 'REGISTRO' | 'ACAO' | 'AGENDA' = 'REGISTRO') {
        return this.create(processId, {
            title,
            description,
            date: new Date().toISOString(),
            type: 'MOVEMENT',
            origin: 'SYSTEM',
            source: 'SYSTEM',
            category,
            status: 'CONCLUIDO',
            metadata
        }, [], 'SISTEMA');
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
                    origin: 'AUTOMATICO',
                    source: 'SYSTEM',
                    category: item.category,
                    status: item.status,
                    priority: item.priority,
                    internalDate: item.internalDate || null,
                    templateCode: 'WF_NOVA_DEMANDA',
                    requesterName: user || 'sistema',
                    metadata: { generatedBy: 'WF_NOVA_DEMANDA' }
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

    async update(id: string, data: any, files?: any[], tenantId?: string) {
        const existing = await this.getTimelineContext(id, tenantId);
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
                internalDate: data.internalDate !== undefined ? (data.internalDate ? new Date(data.internalDate) : null) : undefined, 
                fatalDate: data.fatalDate !== undefined ? (data.fatalDate ? new Date(data.fatalDate) : null) : undefined, 
                type: data.type,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
                category: data.category,
                status: data.status,
                priority: data.priority,
                responsibleName: data.responsibleName,
                completedAt: (data.status === 'CONCLUIDO' && existing.status !== 'CONCLUIDO') 
                    ? (data.completedAt ? new Date(data.completedAt) : new Date()) 
                    : (data.status !== 'CONCLUIDO' ? null : existing.completedAt),
                completedBy: (data.status === 'CONCLUIDO' && existing.status !== 'CONCLUIDO') ? data.completedBy : (data.status !== 'CONCLUIDO' ? null : existing.completedBy),
                conclusionNotes: data.conclusionNotes,
                responsibleHistory: (data.responsibleName && data.responsibleName !== existing.responsibleName) 
                    ? [...(Array.isArray(existing.responsibleHistory) ? existing.responsibleHistory : []), { name: data.responsibleName, date: new Date() }]
                    : existing.responsibleHistory
            },
        });

        // Trigger sync if category changed to AGENDA or if dates updated and it's already an AGENDA
        // This is a naive sync. For robust usage, you would track existing appointments and update them.
        if (data.category === 'AGENDA' && existing.category !== 'AGENDA') {
             await this.syncAppointment(updated);
        }

        // --- Workflow trigger ---
        if (updated.status === 'CONCLUIDO' && existing.status !== 'CONCLUIDO' && updated.workflowStepId) {
            await this.triggerNextWorkflowStepsForCompletedTimeline(updated);
        }

        return updated;
    }

    async remove(id: string, tenantId?: string) {
        await this.getTimelineContext(id, tenantId);
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        return this.prisma.processTimeline.delete({
            where: { id },
        });
    }

    getAttachmentPath(fileName: string) {
        const path = require('path');
        return path.join(process.cwd(), 'uploads', 'timelines', fileName);
    }

    // --- Workflows (Esteira de Trabalho) ---

    private async triggerNextWorkflowStepsForCompletedTimeline(timeline: any) {
        if (!timeline.workflowStepId) return;

        const currentStep = await this.prisma.workflowStep.findUnique({
            where: { id: timeline.workflowStepId },
            include: { workflow: true }
        });

        if (!currentStep) return;

        await this.triggerNextWorkflowSteps(timeline.processId, currentStep.workflowId, currentStep.order, timeline.responsibleName || 'Sistema');
    }

    async triggerNextWorkflowSteps(processId: string, workflowId: string, currentOrder: number, user: string) {
        // Find next steps (order = currentOrder + 1)
        const nextSteps = await this.prisma.workflowStep.findMany({
            where: { 
                workflowId, 
                order: currentOrder + 1 
            }
        });

        if (!nextSteps.length) return; // Workflow completed or no next steps

        const now = new Date();

        for (const step of nextSteps) {
            let internalDate = null;
            let fatalDate = null;

            if (step.daysToInternal !== null && step.daysToInternal !== undefined) {
                internalDate = new Date(now.getTime() + step.daysToInternal * 24 * 60 * 60 * 1000);
            }
            if (step.daysToFatal !== null && step.daysToFatal !== undefined) {
                fatalDate = new Date(now.getTime() + step.daysToFatal * 24 * 60 * 60 * 1000);
            }

            await this.prisma.processTimeline.create({
                data: {
                    processId,
                    title: step.taskTitle,
                    description: step.description || `Este andamento foi gerado automaticamente pela Esteira de Trabalho`,
                    date: now,
                    type: 'MOVEMENT',
                    origin: 'AUTOMATICO',
                    source: 'SYSTEM',
                    category: step.taskCategory,
                    status: 'PENDENTE',
                    priority: step.taskPriority,
                    internalDate,
                    fatalDate,
                    workflowStepId: step.id,
                    requesterName: 'Sistema (Auto)',
                    responsibleName: step.defaultAssigneeRole || null,
                    metadata: { generatedByWorkflow: workflowId }
                }
            });
        }
    }
}

