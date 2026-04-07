import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class ProcessTimelinesService {
    constructor(private prisma: PrismaService) {}

    private normalizeIdentity(value?: string | null) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    private tokenizeIdentity(value?: string | null) {
        return this.normalizeIdentity(value)
            .split(/[^a-z0-9]+/i)
            .map((token) => token.trim())
            .filter(Boolean);
    }

    private namesPossiblyMatch(left?: string | null, right?: string | null) {
        const leftTokens = this.tokenizeIdentity(left);
        const rightTokens = this.tokenizeIdentity(right);

        if (leftTokens.length === 0 || rightTokens.length === 0) return false;
        if (leftTokens.join(' ') === rightTokens.join(' ')) return true;

        const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
        const longer = shorter === leftTokens ? rightTokens : leftTokens;

        let matched = 0;
        for (const token of shorter) {
            const hasMatch = longer.some((candidate) => {
                if (candidate === token) return true;
                if (token.length === 1) return candidate.startsWith(token);
                if (candidate.length === 1) return token.startsWith(candidate);
                return false;
            });
            if (hasMatch) matched += 1;
        }

        return matched >= Math.min(2, shorter.length) && matched === shorter.length;
    }

    private async buildResponsibleAliases(currentUser: CurrentUserData) {
        const aliases = new Set<string>();
        const pushAlias = (value?: string | null) => {
            const next = String(value || '').trim();
            if (next) aliases.add(next);
        };

        pushAlias(currentUser.email);
        pushAlias(currentUser.name);

        const [userRecord, matchingContacts] = await Promise.all([
            this.prisma.user.findFirst({
                where: { id: currentUser.userId, tenantId: currentUser.tenantId },
                select: { id: true, name: true, email: true },
            }),
            this.prisma.contact.findMany({
                where: {
                    tenantId: currentUser.tenantId,
                    OR: [
                        ...(currentUser.email
                            ? [{ email: { equals: currentUser.email, mode: 'insensitive' as const } }]
                            : []),
                        ...(currentUser.name
                            ? [{ name: { equals: currentUser.name, mode: 'insensitive' as const } }]
                            : []),
                    ],
                },
                select: { id: true, name: true, email: true },
                take: 10,
            }),
        ]);

        pushAlias(userRecord?.email);
        pushAlias(userRecord?.name);

        for (const contact of matchingContacts) {
            pushAlias(contact.name);
            pushAlias(contact.email);
        }

        return Array.from(aliases);
    }

    private isTimelineAssignedToUser(
        timeline: {
            responsibleName?: string | null;
            metadata?: any;
        },
        currentUser: CurrentUserData,
        aliases: string[],
    ) {
        const metadata =
            timeline?.metadata && typeof timeline.metadata === 'object'
                ? timeline.metadata
                : {};

        if (String(metadata?.responsibleUserId || '') === String(currentUser.userId || '')) {
            return true;
        }

        const responsibleName = String(timeline?.responsibleName || '').trim();
        if (!responsibleName) return false;

        const normalizedResponsible = this.normalizeIdentity(responsibleName);
        if (!normalizedResponsible) return false;

        return aliases.some((alias) => {
            if (!alias) return false;
            const normalizedAlias = this.normalizeIdentity(alias);
            if (!normalizedAlias) return false;
            if (normalizedResponsible === normalizedAlias) return true;
            return this.namesPossiblyMatch(responsibleName, alias);
        });
    }

    private isTimelineUnassigned(timeline: {
        responsibleName?: string | null;
        metadata?: any;
    }) {
        const metadata =
            timeline?.metadata && typeof timeline.metadata === 'object'
                ? timeline.metadata
                : {};

        return (
            !String(timeline?.responsibleName || '').trim() &&
            !String(metadata?.responsibleUserId || '').trim()
        );
    }

    private getEffectiveTaskCategory(timeline: {
        category?: string | null;
        responsibleName?: string | null;
        internalDate?: Date | string | null;
        fatalDate?: Date | string | null;
        metadata?: any;
    }): 'REGISTRO' | 'ACAO' | 'AGENDA' {
        const normalizedCategory = String(timeline?.category || '')
            .trim()
            .toUpperCase();

        if (normalizedCategory === 'ACAO' || normalizedCategory === 'AGENDA') {
            return normalizedCategory as 'ACAO' | 'AGENDA';
        }

        if (timeline?.fatalDate || timeline?.internalDate) {
            return 'AGENDA';
        }

        if (
            String(timeline?.responsibleName || '').trim() ||
            String(timeline?.metadata?.responsibleUserId || '').trim()
        ) {
            return 'ACAO';
        }

        return 'REGISTRO';
    }

    private isTimelineOverdue(timeline: {
        status?: string | null;
        internalDate?: Date | string | null;
        fatalDate?: Date | string | null;
    }, now = new Date()) {
        return (
            String(timeline?.status || '').toUpperCase() !== 'CONCLUIDO' &&
            ((timeline?.fatalDate && new Date(timeline.fatalDate) < now) ||
                (timeline?.internalDate && new Date(timeline.internalDate) < now))
        );
    }

    private buildTaskSearchableText(item: any) {
        const attachmentNames = Array.isArray(item?.metadata?.attachments)
            ? item.metadata.attachments
                  .map((attachment: any) => attachment?.originalName || attachment?.fileName || '')
                  .join(' ')
            : '';

        return this.normalizeIdentity(
            [
                item?.title,
                item?.description,
                item?.responsibleName,
                item?.requesterName,
                item?.displayId,
                item?.aiSummary,
                item?.clientMessage,
                item?.origin,
                item?.type,
                item?.process?.title,
                item?.process?.code,
                item?.process?.cnj,
                attachmentNames,
            ].join(' '),
        );
    }

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
        currentUser: CurrentUserData,
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
        const tenantId = currentUser.tenantId;
        const search = String(query.q || '').trim();
        const normalizedStatus = String(query.status || '').trim().toUpperCase();
        const scope = (query.scope || 'mine') as 'mine' | 'all' | 'unassigned';
        const includeCompleted = String(query.includeCompleted || '').toLowerCase() === 'true';
        const shouldIncludeCompleted =
            includeCompleted || normalizedStatus === 'CONCLUIDO';
        const overdueOnly = String(query.overdue || '').toLowerCase() === 'true';
        const shouldApplyOverdue = overdueOnly && normalizedStatus !== 'CONCLUIDO';
        const limit = Math.min(Math.max(parseInt(String(query.limit || '200'), 10) || 200, 1), 500);
        const responsibleAliases = await this.buildResponsibleAliases(currentUser);
        const fetchLimit = Math.min(Math.max(limit * 5, 500), 2000);

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

        if (!shouldIncludeCompleted) {
            baseWhere.AND.push({ status: { not: 'CONCLUIDO' } });
        }

        if (normalizedStatus) {
            baseWhere.AND.push({ status: normalizedStatus });
        }

        if (shouldApplyOverdue) {
            const now = new Date();
            baseWhere.AND.push({ status: { not: 'CONCLUIDO' } });
            baseWhere.AND.push({
                OR: [{ fatalDate: { lt: now } }, { internalDate: { lt: now } }],
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
            take: fetchLimit,
        });

        const scopedItems = items.filter((item) => {
            if (scope === 'mine') {
                return this.isTimelineAssignedToUser(item, currentUser, responsibleAliases);
            }
            if (scope === 'unassigned') {
                return this.isTimelineUnassigned(item);
            }
            return true;
        });

        const categoryFilteredItems = scopedItems.filter((item) => {
            if (!query.category) return true;
            return this.getEffectiveTaskCategory(item) === String(query.category).toUpperCase();
        });

        const searchFilteredItems = categoryFilteredItems.filter((item) => {
            if (!search) return true;
            return this.buildTaskSearchableText(item).includes(this.normalizeIdentity(search));
        });

        const finalItems = searchFilteredItems.slice(0, limit);

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

        const [summaryItems, openTotal, overdueTotal] = await Promise.all([
            this.prisma.processTimeline.findMany({
                where: summaryBaseWhere,
                select: {
                    id: true,
                    status: true,
                    internalDate: true,
                    fatalDate: true,
                    responsibleName: true,
                    metadata: true,
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

        const myOpen = summaryItems.filter(
            (item) =>
                item.status !== 'CONCLUIDO' &&
                this.isTimelineAssignedToUser(item, currentUser, responsibleAliases),
        ).length;

        const myOverdue = summaryItems.filter(
            (item) =>
                item.status !== 'CONCLUIDO' &&
                this.isTimelineAssignedToUser(item, currentUser, responsibleAliases) &&
                ((item.fatalDate && item.fatalDate < now) ||
                    (item.internalDate && item.internalDate < now)),
        ).length;

        return {
            items: finalItems.map((item) => ({
                ...item,
                category: this.getEffectiveTaskCategory(item),
                dueAt: item.fatalDate || item.internalDate || null,
                isOverdue: this.isTimelineOverdue(item, now),
            })),
            summary: {
                myOpen,
                myOverdue,
                openTotal,
                overdueTotal,
            },
        };
    }

    async create(processId: string, data: any, files?: any[], user?: string, currentUser?: CurrentUserData) {
        await this.getProcessContext(processId, currentUser?.tenantId);
        let metadata: any = data.metadata || {};
        
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch {}
        }
        
        // Add user to metadata if provided
        if (user) {
            metadata.user = user;
        }

        if (data.responsibleUserId) {
            metadata.responsibleUserId = String(data.responsibleUserId);
        } else if (!data.responsibleName) {
            delete metadata.responsibleUserId;
        }

        if (data.responsibleEmail) {
            metadata.responsibleEmail = String(data.responsibleEmail);
        } else if (!data.responsibleName) {
            delete metadata.responsibleEmail;
        }

        if (data.responsibleContactId) {
            metadata.responsibleContactId = String(data.responsibleContactId);
        } else if (!data.responsibleName) {
            delete metadata.responsibleContactId;
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
                responsibleName: String(data.responsibleName || '').trim() || null,
                completedAt: status === 'CONCLUIDO' ? new Date() : null,
                responsibleHistory: String(data.responsibleName || '').trim() ? [{
                    name: String(data.responsibleName).trim(),
                    date: new Date(),
                    userId: data.responsibleUserId || null,
                    email: data.responsibleEmail || null,
                    contactId: data.responsibleContactId || null,
                }] : [],
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

    async update(id: string, data: any, files?: any[], currentUser?: CurrentUserData) {
        const existing = await this.getTimelineContext(id, currentUser?.tenantId);
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

        if (data.responsibleUserId) {
            metadata.responsibleUserId = String(data.responsibleUserId);
        } else if (data.responsibleName === '' || data.responsibleName === null) {
            delete metadata.responsibleUserId;
        }

        if (data.responsibleEmail) {
            metadata.responsibleEmail = String(data.responsibleEmail);
        } else if (data.responsibleName === '' || data.responsibleName === null) {
            delete metadata.responsibleEmail;
        }

        if (data.responsibleContactId) {
            metadata.responsibleContactId = String(data.responsibleContactId);
        } else if (data.responsibleName === '' || data.responsibleName === null) {
            delete metadata.responsibleContactId;
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
                responsibleName:
                    data.responsibleName !== undefined
                        ? (String(data.responsibleName).trim() ? String(data.responsibleName).trim() : null)
                        : undefined,
                completedAt: (data.status === 'CONCLUIDO' && existing.status !== 'CONCLUIDO') 
                    ? (data.completedAt ? new Date(data.completedAt) : new Date()) 
                    : (data.status !== 'CONCLUIDO' ? null : existing.completedAt),
                completedBy: (data.status === 'CONCLUIDO' && existing.status !== 'CONCLUIDO') ? data.completedBy : (data.status !== 'CONCLUIDO' ? null : existing.completedBy),
                conclusionNotes: data.conclusionNotes,
                responsibleHistory: (String(data.responsibleName || '').trim() && String(data.responsibleName).trim() !== String(existing.responsibleName || '').trim()) 
                    ? [...(Array.isArray(existing.responsibleHistory) ? existing.responsibleHistory : []), {
                        name: String(data.responsibleName).trim(),
                        date: new Date(),
                        userId: data.responsibleUserId || null,
                        email: data.responsibleEmail || null,
                        contactId: data.responsibleContactId || null,
                    }]
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
        const existing = await this.getTimelineContext(id, tenantId);
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

