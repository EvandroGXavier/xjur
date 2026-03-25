import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as fs from 'fs';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';
import { ProcessIntegrationsService } from './process-integrations.service';
import { ProcessPdfService } from './process-pdf.service';
import type { FullProcessPdfAnalysis, PdfProcessDocument } from './process-pdf.service';
import { DrxClawService } from '../drx-claw/drx-claw.service';
import { PROCESS_PDF_SKILL_ID } from '../drx-claw/drx-skill.constants';
import { ProcessTimelinesService } from './process-timelines.service';
import { buildAdvancedProcessWhere } from './process-advanced-filter';

interface CreateProcessDto {
    tenantId?: string;
    contactId?: string;
    cnj?: string;
    category: 'JUDICIAL' | 'EXTRAJUDICIAL' | 'ADMINISTRATIVO';
    title?: string;
    code?: string;
    description?: string;
    folder?: string;
    localFolder?: string;
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
    responsibleLawyer?: string;
    parties?: any;
    metadata?: any;
    workflowId?: string;
}

interface ImportedProcessPartyInput {
    name: string;
    type?: string;
    document?: string | null;
    phone?: string | null;
    email?: string | null;
    oab?: string | null;
    representedNames?: string[] | null;
    isClient?: boolean;
    isOpposing?: boolean;
}

interface ImportedPartySyncRef {
    id: string;
    contactId: string;
    roleName: string;
    normalizedName: string;
    normalizedDocument?: string | null;
    representedNames: string[];
    pole: 'ACTIVE' | 'PASSIVE' | null;
    isClient: boolean;
    isOpposing: boolean;
}

type TimelineImportReasonCode =
    | 'READY'
    | 'PROCESS_NOT_FOUND'
    | 'PROCESS_NOT_JUDICIAL'
    | 'CNJ_MISSING'
    | 'CNJ_INVALID'
    | 'DATAJUD_DISABLED'
    | 'API_KEY_MISSING'
    | 'PROCESS_UNDER_SEAL'
    | 'PROCESS_NOT_FOUND_AT_CNJ'
    | 'CNJ_UNAVAILABLE';

type TimelineImportStatus = {
    canImport: boolean;
    reasonCode: TimelineImportReasonCode;
    message: string;
    actionLabel: string;
    checkedAt: string;
    cnj: string | null;
    totalAvailableCount: number;
    importedTimelineCount: number;
    newMovementCount: number;
    lastSourceUpdateAt: string | null;
    sourceSystem: string | null;
    sourceCourt: string | null;
    isProcessSaved: boolean;
};

type PdfDossierImportResult = {
    success: boolean;
    processId: string;
    originalFileName: string | null;
    importedCount: number;
    skippedCount: number;
    totalCandidateCount: number;
    deadlineCount: number;
    explicitFatalDateCount: number;
    cnjMovementCount: number;
    cnjImportStatus: TimelineImportStatus | null;
    drxSummary: {
        mode: string | null;
        provider: string | null;
        model: string | null;
        answer: string | null;
        error: string | null;
        matchedSkills: Array<{
            id: string;
            name: string;
        }>;
    };
    analysis: {
        cnj: string | undefined;
        pageCount: number;
        textLength: number;
        ocrStatus: string;
        documentCount: number;
        proceduralActCount: number;
    };
    message: string;
};

@Injectable()
export class ProcessesService {
    constructor(
        private prisma: PrismaService,
        private readonly microsoftGraphService: MicrosoftGraphService,
        private readonly integrationsService: ProcessIntegrationsService,
        private readonly pdfService: ProcessPdfService,
        private readonly drxClawService: DrxClawService,
        private readonly timelineService: ProcessTimelinesService,
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

    private normalizeLifecycleStatus(value?: string | null, fallback = 'ATIVO') {
        const normalized = this.normalizeText(value).replace(/[\s-]+/g, '_');
        const statusMap: Record<string, string> = {
            ATIVO: 'ATIVO',
            ATIVA: 'ATIVO',
            INATIVO: 'INATIVO',
            INATIVA: 'INATIVO',
            EM_ANDAMENTO: 'EM_ANDAMENTO',
            EM_ACOMPANHAMENTO: 'EM_ANDAMENTO',
            OPORTUNIDADE: 'OPORTUNIDADE',
            SUSPENSO: 'SUSPENSO',
            SUSPENSA: 'SUSPENSO',
            ARQUIVADO: 'ARQUIVADO',
            ARQUIVADA: 'ARQUIVADO',
            ENCERRADO: 'ENCERRADO',
            ENCERRADA: 'ENCERRADO',
        };

        return statusMap[normalized] || fallback;
    }

    private buildProcessMetadata(inputMetadata: any, rawStatus?: string | null, normalizedStatus?: string) {
        const metadata =
            inputMetadata && typeof inputMetadata === 'object' && !Array.isArray(inputMetadata)
                ? { ...inputMetadata }
                : {};

        const existingProceduralStatus = String(metadata.proceduralStatus || '').trim();
        const incomingRawStatus = String(rawStatus || '').trim();
        const rawLifecycleStatus = this.normalizeLifecycleStatus(incomingRawStatus, '');

        if (existingProceduralStatus) {
            metadata.proceduralStatus = existingProceduralStatus;
            return metadata;
        }

        if (incomingRawStatus && (!rawLifecycleStatus || rawLifecycleStatus !== normalizedStatus)) {
            metadata.proceduralStatus = incomingRawStatus;
        }

        return metadata;
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

    private resolveImportedPartyFlags(roleName: string, party?: ImportedProcessPartyInput) {
        const hasExplicitFlags = party?.isClient !== undefined || party?.isOpposing !== undefined;
        const explicitClient = party?.isClient === true;
        const explicitOpposing = party?.isOpposing === true && !explicitClient;

        if (hasExplicitFlags) {
            return {
                isClient: explicitClient,
                isOpposing: explicitOpposing,
            };
        }

        const inferredPole = this.inferImportedPole(roleName);
        return {
            isClient: inferredPole === 'ACTIVE',
            isOpposing: inferredPole === 'PASSIVE',
        };
    }

    private buildProcessInclude() {
        return {
            timeline: { 
                orderBy: { date: 'desc' as const }, 
                take: 200,
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            },
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

    private mapTimelineImportReason(code: TimelineImportReasonCode) {
        const messages: Record<TimelineImportReasonCode, string> = {
            READY: 'Consulta CNJ liberada para importar os andamentos do processo.',
            PROCESS_NOT_FOUND: 'Processo nao encontrado para esta empresa.',
            PROCESS_NOT_JUDICIAL: 'A importacao do CNJ esta disponivel apenas para processos judiciais.',
            CNJ_MISSING: 'Informe e salve o numero CNJ antes de buscar os andamentos oficiais.',
            CNJ_INVALID: 'O numero CNJ salvo neste processo parece invalido.',
            DATAJUD_DISABLED: 'A integracao DataJud/CNJ nao esta configurada ou foi desativada.',
            API_KEY_MISSING: 'Cadastre a chave publica do CNJ/DataJud para liberar a busca oficial.',
            PROCESS_UNDER_SEAL: 'O processo possui sigilo e os movimentos nao podem ser importados por esta consulta publica.',
            PROCESS_NOT_FOUND_AT_CNJ: 'O CNJ nao localizou este processo na consulta publica do tribunal configurado.',
            CNJ_UNAVAILABLE: 'Nao foi possivel comunicar com o CNJ/DataJud neste momento.',
        };

        return messages[code];
    }

    private buildImportedTimelineKey(processCnj: string, movement: any) {
        const normalizedCnj = this.normalizeCnj(processCnj) || 'SEM_CNJ';
        const movementDate = String(movement?.dataHora || '').trim();
        const movementCode = String(movement?.codigo ?? '').trim();
        const movementName = this.normalizeText(movement?.nome);
        const orgaoCode = String(
            movement?.orgaoJulgador?.codigo ??
                movement?.orgaoJulgador?.id ??
                '',
        ).trim();
        const complementSignature = Array.isArray(movement?.complementosTabelados)
            ? movement.complementosTabelados
                  .map((item: any) =>
                      [
                          String(item?.codigo ?? '').trim(),
                          String(item?.valor ?? '').trim(),
                          this.normalizeText(item?.nome),
                          this.normalizeText(item?.descricao),
                      ].join(':'),
                  )
                  .sort()
                  .join('|')
            : '';

        return [
            normalizedCnj,
            movementDate,
            movementCode,
            movementName,
            orgaoCode,
            complementSignature,
        ].join('::');
    }

    private getExistingTimelineKey(processCnj: string, timeline: any) {
        const metadata = timeline?.metadata && typeof timeline.metadata === 'object'
            ? timeline.metadata
            : {};

        if (metadata?.externalKey) {
            return String(metadata.externalKey);
        }

        return this.buildImportedTimelineKey(processCnj, {
            dataHora: timeline?.date,
            codigo: metadata?.movementCode || timeline?.displayId || '',
            nome: metadata?.movementName || timeline?.title || '',
            orgaoJulgador: metadata?.orgaoJulgador || null,
            complementosTabelados: metadata?.complementosTabelados || [],
        });
    }

    private buildMovementTimelineDescription(movement: any) {
        const details: string[] = [];
        const orgaoNome = String(movement?.orgaoJulgador?.nome || '').trim();

        if (orgaoNome) {
            details.push(`Orgao julgador: ${orgaoNome}`);
        }

        if (Array.isArray(movement?.complementosTabelados) && movement.complementosTabelados.length > 0) {
            const complements = movement.complementosTabelados
                .map((item: any) => {
                    const name = String(item?.nome || '').trim();
                    const description = String(item?.descricao || '').trim();
                    const value = item?.valor === undefined || item?.valor === null
                        ? ''
                        : String(item.valor).trim();

                    if (name && description && value) return `${name} (${description}: ${value})`;
                    if (name && description) return `${name} (${description})`;
                    if (name && value) return `${name}: ${value}`;
                    return name || description || value;
                })
                .filter(Boolean);

            if (complements.length > 0) {
                details.push(`Complementos: ${complements.join(' | ')}`);
            }
        }

        const movementCode = String(movement?.codigo ?? '').trim();
        if (movementCode) {
            details.push(`Codigo CNJ do movimento: ${movementCode}`);
        }

        return details.join('\n');
    }

    private inferTimelineOrigin(systemName?: string | null) {
        const normalized = this.normalizeText(systemName);
        if (normalized.includes('EPROC')) return 'TRIBUNAL_EPROC';
        return 'TRIBUNAL_PJE';
    }

    private resolvePdfImportSource(analysis?: Partial<FullProcessPdfAnalysis> | null) {
        const importSource = String(analysis?.importSource || '').trim();
        if (importSource) return importSource;

        const courtSystem = this.normalizeText(analysis?.courtSystem);
        if (courtSystem.includes('EPROC')) return 'EPROC_PROCESS_PDF';
        if (courtSystem.includes('PJE')) return 'PJE_PROCESS_PDF';
        return 'TRIBUNAL_PROCESS_PDF';
    }

    private buildPdfImportedTimelineKey(processCnj: string | null, document: PdfProcessDocument, analysis?: Partial<FullProcessPdfAnalysis> | null) {
        const normalizedCnj = this.normalizeCnj(processCnj) || 'SEM_CNJ';
        const importSource = this.resolvePdfImportSource(analysis);
        const referenceType = String(document?.referenceType || '').trim().toUpperCase();
        const baseId = String(document?.documentId || '').trim();
        const referenceCode = String(document?.referenceCode || '').trim();
        const eventSequence = String(document?.eventSequence || '').trim();

        if (baseId) {
            if (referenceType === 'EVENT') {
                return `${importSource}::${normalizedCnj}::EVENT::${baseId}::${eventSequence || referenceCode}`;
            }
            return `${importSource}::${normalizedCnj}::${baseId}`;
        }

        const signedAt = String(document?.signedAt || '').trim();
        const label = this.normalizeText(document?.label);
        const docType = this.normalizeText(document?.documentType);
        return `${importSource}::${normalizedCnj}::${signedAt}::${docType}::${label}`;
    }

    private buildPdfTimelineTitle(document: PdfProcessDocument) {
        const type = String(document?.documentType || '').trim();
        if (type) return type;

        const label = String(document?.label || '').trim();
        if (!label) return 'Documento processual';

        return label.length > 120 ? `${label.slice(0, 117)}...` : label;
    }

    private buildPdfTimelineDescription(document: PdfProcessDocument) {
        const sections: string[] = [];
        const content = String(document?.contentText || '').trim();
        const label = String(document?.label || '').trim();
        const signedAt = String(document?.signedAt || '').trim();
        const eventNumber = String(document?.documentId || '').trim();
        const referenceType = String(document?.referenceType || '').trim().toUpperCase();

        if (referenceType === 'EVENT' && eventNumber) {
            sections.push(`Evento: ${eventNumber}`);
        }

        if (document?.referenceCode) {
            sections.push(`Referencia do tribunal: ${document.referenceCode}`);
        }

        if (document?.eventSequence) {
            sections.push(`Sequencia do evento: ${document.eventSequence}`);
        }

        if (document?.actorName) {
            sections.push(`Lancado por: ${document.actorName}`);
        }

        if (label && (!content || !content.startsWith(label))) {
            sections.push(`${referenceType === 'EVENT' ? 'Descricao do evento' : 'Documento'}: ${label}`);
        }

        if (signedAt) {
            sections.push(`Assinado em: ${new Date(signedAt).toLocaleString('pt-BR')}`);
        }

        if (content) {
            sections.push(content);
        }

        if (document?.deadlineCandidates?.length) {
            const deadlineSummary = document.deadlineCandidates
                .slice(0, 3)
                .map((candidate) => {
                    if (candidate.fatalDate) {
                        return `Prazo identificado: ${new Date(candidate.fatalDate).toLocaleString('pt-BR')}`;
                    }
                    if (candidate.deadlineDays) {
                        return `Prazo identificado: ${candidate.deadlineDays} dia(s)`;
                    }
                    return candidate.excerpt;
                })
                .join(' | ');

            if (deadlineSummary) {
                sections.push(deadlineSummary);
            }
        }

        return sections.filter(Boolean).join('\n\n').trim();
    }

    private pickPdfFatalDate(document: PdfProcessDocument) {
        const explicit = (document?.deadlineCandidates || []).find((candidate) => candidate.fatalDate);
        return explicit?.fatalDate || null;
    }

    private resolvePdfTimelineCandidates(analysis: FullProcessPdfAnalysis) {
        const preferred = analysis.proceduralActs.filter((document) => document.contentText || document.documentType);
        if (preferred.length > 0) {
            return preferred;
        }

        return analysis.documents.filter((document) => document.contentText || document.label);
    }

    private shouldUsePdfOnlyAnalysis(analysis?: Partial<FullProcessPdfAnalysis> | null) {
        const courtSystem = this.normalizeText(analysis?.courtSystem);
        return courtSystem.includes('EPROC');
    }

    private buildPdfReferenceLabel(document: PdfProcessDocument) {
        const referenceType = document?.referenceType === 'EVENT' ? 'Evento' : 'ID';
        const referenceValue = String(document?.documentId || '').trim();
        if (!referenceValue) return null;
        return `${referenceType} ${referenceValue}${document?.referenceCode ? ` (${document.referenceCode})` : ''}`;
    }

    private async getOptionalCnjTimelineStatus(id: string, tenantId: string) {
        try {
            return await this.getCnjTimelineImportStatus(id, tenantId);
        } catch (_error) {
            return null;
        }
    }

    private async buildPdfDrxSummary(tenantId: string, process: { title?: string | null; cnj?: string | null }, analysis: FullProcessPdfAnalysis, cnjStatus: TimelineImportStatus | null) {
        try {
            const openItems = this.resolvePdfTimelineCandidates(analysis)
                .filter((document) => document.deadlineCandidates?.length || document.documentType || document.contentText)
                .slice(0, 8);
            const pdfOnlyAnalysis = this.shouldUsePdfOnlyAnalysis(analysis);
            const promptLines = [
                `Processo: ${String(process?.title || process?.cnj || 'Processo judicial').trim()}`,
                process?.cnj ? `CNJ: ${process.cnj}` : '',
                analysis.courtSystem ? `Sistema processual detectado: ${analysis.courtSystem}` : '',
                analysis.class ? `Classe: ${analysis.class}` : '',
                analysis.vars ? `Orgao/Vara: ${analysis.vars}` : '',
                analysis.documents.length ? `Documentos identificados no PDF: ${analysis.documents.length}` : '',
                analysis.proceduralActs.length ? `Atos processuais relevantes: ${analysis.proceduralActs.length}` : '',
                analysis.deadlineCandidates.length ? `Candidatos de prazo: ${analysis.deadlineCandidates.length}` : '',
                !pdfOnlyAnalysis && cnjStatus?.totalAvailableCount ? `Movimentos oficiais no DataJud: ${cnjStatus.totalAvailableCount}` : '',
                pdfOnlyAnalysis ? 'A leitura deste processo deve ser feita exclusivamente pelo PDF disponibilizado, sem depender de consulta externa ao CNJ/DataJud.' : '',
                'Atos de destaque:',
                ...openItems.map((document) => {
                    const line = [
                        document.signedAt ? new Date(document.signedAt).toLocaleDateString('pt-BR') : '',
                        this.buildPdfTimelineTitle(document),
                        this.buildPdfReferenceLabel(document),
                    ]
                        .filter(Boolean)
                        .join(' - ');
                    return `- ${line}`;
                }),
                'Responda em portugues e em tom operacional.',
                'Entregue, nesta ordem:',
                '1. Resumo geral do processo.',
                '2. Fase atual e leitura estrategica.',
                '3. Andamentos ou eventos em aberto que exigem atencao imediata.',
                '4. Acao recomendada pelo escritorio no curto prazo.',
                '5. Peca adequada, se houver, com justificativa objetiva.',
                '6. Riscos de prazo, prova ou estrategia.',
                'Se nao houver peca cabivel neste momento, diga expressamente que nao ha peca imediata recomendada.',
                pdfOnlyAnalysis ? 'Nao presuma existencia de andamento externo alem do que esta efetivamente no PDF.' : '',
            ].filter(Boolean);

            const result = await this.drxClawService.runPlayground(tenantId, {
                scenario: 'Integracao PDF completo do processo + DataJud',
                prompt: promptLines.join('\n'),
                forceSkillIds: [PROCESS_PDF_SKILL_ID],
            });

            return {
                mode: String(result?.mode || '').trim() || null,
                provider: String(result?.provider || '').trim() || null,
                model: String(result?.model || '').trim() || null,
                answer: String(result?.answer || '').trim() || null,
                error: String(result?.error || '').trim() || null,
                matchedSkills: Array.isArray(result?.matchedSkills)
                    ? result.matchedSkills
                          .map((skill: any) => ({
                              id: String(skill?.id || '').trim(),
                              name: String(skill?.name || '').trim(),
                          }))
                          .filter((skill: { id: string; name: string }) => skill.id && skill.name)
                    : [],
            };
        } catch (error: any) {
            return {
                mode: null,
                provider: null,
                model: null,
                answer: null,
                error: String(error?.message || 'Falha ao gerar parecer do DrX-Claw.'),
                matchedSkills: [],
            };
        }
    }

    private buildTimelineImportActionLabel(status: {
        canImport: boolean;
        newMovementCount: number;
        totalAvailableCount: number;
    }) {
        if (!status.canImport) {
            return 'Busca CNJ indisponivel';
        }

        if (status.newMovementCount > 0) {
            return `Importar ${status.newMovementCount} andamento(s) novo(s)`;
        }

        if (status.totalAvailableCount > 0) {
            return 'Verificar novos andamentos no CNJ';
        }

        return 'Buscar andamentos no CNJ';
    }

    private buildBlockedTimelineImportStatus(
        cnj: string | null,
        importedTimelineCount: number,
        code: TimelineImportReasonCode,
    ): TimelineImportStatus {
        return {
            canImport: false,
            reasonCode: code,
            message: this.mapTimelineImportReason(code),
            actionLabel: 'Busca CNJ indisponivel',
            checkedAt: new Date().toISOString(),
            cnj,
            totalAvailableCount: 0,
            importedTimelineCount,
            newMovementCount: 0,
            lastSourceUpdateAt: null,
            sourceSystem: null,
            sourceCourt: null,
            isProcessSaved: true,
        };
    }

    private async getTimelineImportProcessContext(id: string, tenantId: string) {
        const process = await this.prisma.process.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                tenantId: true,
                cnj: true,
                title: true,
                category: true,
                court: true,
                courtSystem: true,
                metadata: true,
                responsibleLawyer: true,
            },
        });

        if (!process) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        const existingTimelines = await this.prisma.processTimeline.findMany({
            where: { processId: id },
            select: {
                id: true,
                title: true,
                date: true,
                displayId: true,
                metadata: true,
            },
        });

        return { process, existingTimelines };
    }

    async getCnjTimelineImportStatus(id: string, tenantId: string): Promise<TimelineImportStatus> {
        const { process, existingTimelines } = await this.getTimelineImportProcessContext(id, tenantId);
        const normalizedCnj = this.normalizeCnj(process.cnj);
        const importedTimelineCount = existingTimelines.filter((item) => {
            const metadata =
                item?.metadata &&
                typeof item.metadata === 'object' &&
                !Array.isArray(item.metadata)
                    ? (item.metadata as Record<string, any>)
                    : {};

            return metadata.importSource === 'DATAJUD';
        }).length;

        if (process.category !== 'JUDICIAL') {
            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'PROCESS_NOT_JUDICIAL');
        }

        if (!normalizedCnj) {
            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'CNJ_MISSING');
        }

        if (normalizedCnj.length !== 20) {
            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'CNJ_INVALID');
        }

        const config = await this.integrationsService.getEffectiveConfig(tenantId);
        if (!config?.enabled || config?.provider !== 'DATAJUD' || !config?.datajud?.enabled) {
            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'DATAJUD_DISABLED');
        }

        if (!String(config?.datajud?.apiKey || '').trim()) {
            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'API_KEY_MISSING');
        }

        try {
            const imported = await this.integrationsService.importByCnj(tenantId, normalizedCnj);
            const raw = imported?.metadata?.raw && typeof imported.metadata.raw === 'object'
                ? imported.metadata.raw
                : {};
            const rawMovements = Array.isArray(raw?.movimentos) ? raw.movimentos : [];
            const nivelSigilo = Number(imported?.metadata?.nivelSigilo ?? raw?.nivelSigilo ?? 0);

            if (nivelSigilo > 0) {
                return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'PROCESS_UNDER_SEAL');
            }

            const existingKeys = new Set(
                existingTimelines.map((item) => this.getExistingTimelineKey(normalizedCnj, item)),
            );
            const newMovementCount = rawMovements.filter(
                (movement: any) => !existingKeys.has(this.buildImportedTimelineKey(normalizedCnj, movement)),
            ).length;

            const status: TimelineImportStatus = {
                canImport: true,
                reasonCode: 'READY',
                message:
                    newMovementCount > 0
                        ? `O CNJ retornou ${rawMovements.length} andamento(s); ${newMovementCount} ainda nao estao na linha do tempo do processo.`
                        : `Os ${rawMovements.length} andamento(s) oficiais ja foram verificados. A busca segue disponivel para capturar novidades.`,
                actionLabel: this.buildTimelineImportActionLabel({
                    canImport: true,
                    newMovementCount,
                    totalAvailableCount: rawMovements.length,
                }),
                checkedAt: new Date().toISOString(),
                cnj: normalizedCnj,
                totalAvailableCount: rawMovements.length,
                importedTimelineCount,
                newMovementCount,
                lastSourceUpdateAt: String(imported?.metadata?.dataHoraUltimaAtualizacao || raw?.dataHoraUltimaAtualizacao || '') || null,
                sourceSystem: String(raw?.sistema?.nome || imported?.courtSystem || process.courtSystem || '').trim() || null,
                sourceCourt: String(raw?.tribunal || process.court || '').trim() || null,
                isProcessSaved: true,
            };

            return status;
        } catch (error: any) {
            if (error instanceof NotFoundException) {
                return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'PROCESS_NOT_FOUND_AT_CNJ');
            }

            return this.buildBlockedTimelineImportStatus(normalizedCnj, importedTimelineCount, 'CNJ_UNAVAILABLE');
        }
    }

    async importCnjTimelines(id: string, tenantId: string) {
        const { process, existingTimelines } = await this.getTimelineImportProcessContext(id, tenantId);
        const normalizedCnj = this.normalizeCnj(process.cnj);

        if (!normalizedCnj || normalizedCnj.length !== 20) {
            throw new BadRequestException('Salve um numero CNJ valido antes de importar os andamentos oficiais.');
        }

        const status = await this.getCnjTimelineImportStatus(id, tenantId);
        if (!status.canImport) {
            throw new BadRequestException(status.message);
        }

        const imported = await this.integrationsService.importByCnj(tenantId, normalizedCnj);
        const raw = imported?.metadata?.raw && typeof imported.metadata.raw === 'object'
            ? imported.metadata.raw
            : {};
        const rawMovements = Array.isArray(raw?.movimentos) ? raw.movimentos : [];
        const existingKeys = new Set(
            existingTimelines.map((item) => this.getExistingTimelineKey(normalizedCnj, item)),
        );
        const timelineOrigin = this.inferTimelineOrigin(
            String(raw?.sistema?.nome || imported?.courtSystem || process.courtSystem || ''),
        );
        const nowIso = new Date().toISOString();

        const newTimelineEntries = rawMovements
            .slice()
            .sort((a: any, b: any) => {
                const left = new Date(String(a?.dataHora || '')).getTime();
                const right = new Date(String(b?.dataHora || '')).getTime();
                return left - right;
            })
            .filter((movement: any) => {
                const key = this.buildImportedTimelineKey(normalizedCnj, movement);
                if (existingKeys.has(key)) {
                    return false;
                }
                existingKeys.add(key);
                return true;
            })
            .map((movement: any) => {
                const externalKey = this.buildImportedTimelineKey(normalizedCnj, movement);
                const eventDate = this.parseDate(movement?.dataHora) || new Date();

                return {
                    processId: id,
                    title: String(movement?.nome || 'Movimento CNJ').trim() || 'Movimento CNJ',
                    description: this.buildMovementTimelineDescription(movement),
                    date: eventDate,
                    type: 'MOVEMENT',
                    source: 'CNJ_DATAJUD',
                    origin: timelineOrigin,
                    displayId: String(movement?.codigo ?? '').trim() || null,
                    category: 'REGISTRO',
                    status: 'PENDENTE',
                    priority: 'MEDIA',
                    requesterName: 'CNJ / DataJud',
                    responsibleName: process.responsibleLawyer || null,
                    metadata: {
                        importSource: 'DATAJUD',
                        externalKey,
                        movementCode: movement?.codigo ?? null,
                        movementName: String(movement?.nome || '').trim() || null,
                        orgaoJulgador: movement?.orgaoJulgador || null,
                        complementosTabelados: Array.isArray(movement?.complementosTabelados)
                            ? movement.complementosTabelados
                            : [],
                        importedAt: nowIso,
                        raw: movement,
                    },
                };
            });

        if (newTimelineEntries.length > 0) {
            await this.prisma.processTimeline.createMany({
                data: newTimelineEntries,
            });
        }

        const currentMetadata =
            process.metadata && typeof process.metadata === 'object' && !Array.isArray(process.metadata)
                ? { ...process.metadata }
                : {};

        await this.prisma.process.update({
            where: { id },
            data: {
                lastCrawledAt: new Date(),
                metadata: {
                    ...currentMetadata,
                    raw,
                    cnjTimelineImport: {
                        source: 'DATAJUD',
                        importedAt: nowIso,
                        importedCount: newTimelineEntries.length,
                        totalAvailableCount: rawMovements.length,
                        skippedCount: rawMovements.length - newTimelineEntries.length,
                        lastSourceUpdateAt:
                            String(imported?.metadata?.dataHoraUltimaAtualizacao || raw?.dataHoraUltimaAtualizacao || '') || null,
                        sourceSystem:
                            String(raw?.sistema?.nome || imported?.courtSystem || process.courtSystem || '').trim() || null,
                    },
                },
            },
        });

        return {
            success: true,
            processId: id,
            cnj: normalizedCnj,
            importedCount: newTimelineEntries.length,
            skippedCount: rawMovements.length - newTimelineEntries.length,
            totalAvailableCount: rawMovements.length,
            message:
                newTimelineEntries.length > 0
                    ? `${newTimelineEntries.length} andamento(s) oficial(is) foram adicionados sem alterar o historico ja existente.`
                    : 'Nenhum novo andamento foi encontrado para importar. O historico atual foi preservado.',
        };
    }

    private async upsertProcessFromPdfAnalysis(
        tenantId: string,
        analysis: FullProcessPdfAnalysis,
        originalFileName?: string | null,
    ) {
        const normalizedCnj = this.normalizeCnj(analysis.cnj);
        if (!normalizedCnj) {
            throw new BadRequestException('Nao foi possivel localizar um numero CNJ no PDF para cadastrar ou atualizar o processo automaticamente.');
        }

        const existing = await this.prisma.process.findFirst({
            where: { tenantId, cnj: normalizedCnj },
            select: {
                id: true,
                title: true,
                code: true,
                description: true,
                folder: true,
                court: true,
                courtSystem: true,
                vars: true,
                district: true,
                status: true,
                area: true,
                subject: true,
                class: true,
                distributionDate: true,
                judge: true,
                value: true,
                parties: true,
                metadata: true,
            },
        });

        const normalizedStatus = this.normalizeLifecycleStatus(analysis.status, existing?.status || 'ATIVO');
        const mergedMetadata = this.buildProcessMetadata(
            {
                ...(existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
                    ? existing.metadata
                    : {}),
                pdfCoverImport: {
                    source: this.resolvePdfImportSource(analysis),
                    importedAt: new Date().toISOString(),
                    originalFileName: originalFileName || null,
                    pageCount: analysis.pageCount,
                    textLength: analysis.textLength,
                    timelineReferenceType: analysis.timelineReferenceType,
                },
            },
            analysis.status,
            normalizedStatus,
        );

        const code = existing?.code || (await this.buildProcessCode(tenantId, { category: 'JUDICIAL', cnj: normalizedCnj } as CreateProcessDto));
        const processData = {
            tenantId,
            cnj: normalizedCnj,
            category: 'JUDICIAL',
            title: analysis.title || existing?.title || `Processo ${normalizedCnj}`,
            code,
            description: analysis.description || existing?.description || undefined,
            folder: existing?.folder || undefined,
            court: analysis.court || existing?.court || undefined,
            courtSystem: analysis.courtSystem || existing?.courtSystem || undefined,
            npu: normalizedCnj,
            vars: analysis.vars || existing?.vars || undefined,
            district: analysis.district || existing?.district || undefined,
            status: normalizedStatus,
            area: analysis.area || existing?.area || undefined,
            subject: analysis.subject || existing?.subject || undefined,
            class: analysis.class || existing?.class || undefined,
            distributionDate: this.parseDate(analysis.distributionDate) || existing?.distributionDate || undefined,
            judge: analysis.judge || existing?.judge || undefined,
            value: this.parseMoneyValue(analysis.value) ?? existing?.value ?? undefined,
            parties: analysis.parts?.length ? analysis.parts : (existing?.parties as any[] | undefined) || [],
            metadata: mergedMetadata,
        };

        const process = await this.prisma.process.upsert({
            where: {
                tenantId_cnj: {
                    tenantId,
                    cnj: normalizedCnj,
                },
            },
            update: processData,
            create: processData,
        });

        if ((Array.isArray(processData.parties) && processData.parties.length > 0) || this.isInformativeJudgeName(processData.judge)) {
            await this.syncImportedProcessParties(process.id, tenantId, processData.parties as any[], processData.judge);
        }

        await this.syncMicrosoftFolder(tenantId, process.id);
        return {
            processId: process.id,
            processAction: existing ? 'UPDATED' : 'CREATED',
        };
    }

    private async upsertPdfDrxGuidanceTimeline(
        processId: string,
        process: { responsibleLawyer?: string | null },
        analysis: FullProcessPdfAnalysis,
        drxSummary: { answer: string | null },
    ) {
        const answer = String(drxSummary?.answer || '').trim();
        if (!answer) return null;

        const externalKey = `DRX_PDF_GUIDANCE::${this.resolvePdfImportSource(analysis)}`;
        const existingEntries = await this.prisma.processTimeline.findMany({
            where: {
                processId,
                source: 'DRX_CLAW',
            },
            select: {
                id: true,
                metadata: true,
                status: true,
            },
        });

        const existing = existingEntries.find((item) => {
            const metadata =
                item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
                    ? (item.metadata as Record<string, any>)
                    : {};
            return metadata.externalKey === externalKey;
        });

        const fatalDate = analysis.deadlineCandidates.find((candidate) => candidate.fatalDate)?.fatalDate || null;
        const data = {
            title: 'DrX-Claw: resumo e proximo passo',
            description: answer,
            date: new Date(),
            type: 'MOVEMENT',
            source: 'DRX_CLAW',
            origin: 'IA',
            category: 'ACAO',
            status: existing?.status || 'PENDENTE',
            priority: fatalDate ? 'ALTA' : 'MEDIA',
            fatalDate: fatalDate ? new Date(fatalDate) : null,
            requesterName: 'DrX-Claw',
            responsibleName: process.responsibleLawyer || null,
            metadata: {
                externalKey,
                importSource: this.resolvePdfImportSource(analysis),
                analysisSource: 'PROCESS_PDF',
                updatedAt: new Date().toISOString(),
            },
        };

        if (existing) {
            return this.prisma.processTimeline.update({
                where: { id: existing.id },
                data,
            });
        }

        return this.prisma.processTimeline.create({
            data: {
                processId,
                ...data,
            },
        });
    }

    private async importProcessPdfDossierFromAnalysis(
        id: string,
        tenantId: string,
        analysis: FullProcessPdfAnalysis,
        originalFileName?: string | null,
    ): Promise<PdfDossierImportResult> {
        const { process, existingTimelines } = await this.getTimelineImportProcessContext(id, tenantId);
        const normalizedCnj = this.normalizeCnj(process.cnj || analysis.cnj);
        const timelineOrigin = this.inferTimelineOrigin(analysis.courtSystem || process.courtSystem || process.court);
        const pdfOnlyAnalysis = this.shouldUsePdfOnlyAnalysis(analysis);
        const cnjStatus = pdfOnlyAnalysis ? null : await this.getOptionalCnjTimelineStatus(id, tenantId);
        const importCandidates = this.resolvePdfTimelineCandidates(analysis);
        const existingKeys = new Set(
            existingTimelines.map((item) => this.getExistingTimelineKey(normalizedCnj || '', item)),
        );
        const nowIso = new Date().toISOString();
        const importSource = this.resolvePdfImportSource(analysis);
        const requesterLabel = analysis.courtSystem === 'Eproc' ? 'Eproc / PDF integral' : analysis.courtSystem === 'PJe' ? 'PJe / PDF integral' : 'Tribunal / PDF integral';

        const newTimelineEntries = importCandidates
            .filter((document) => {
                const externalKey = this.buildPdfImportedTimelineKey(normalizedCnj || analysis.cnj || null, document, analysis);
                if (existingKeys.has(externalKey)) {
                    return false;
                }
                existingKeys.add(externalKey);
                return true;
            })
            .map((document) => {
                const externalKey = this.buildPdfImportedTimelineKey(normalizedCnj || analysis.cnj || null, document, analysis);
                const eventDate =
                    this.parseDate(document.signedAt) ||
                    this.parseDate(analysis.distributionDate) ||
                    new Date();
                const fatalDate = this.pickPdfFatalDate(document);

                return {
                    processId: id,
                    title: this.buildPdfTimelineTitle(document),
                    description: this.buildPdfTimelineDescription(document),
                    date: eventDate,
                    type: 'FILE',
                    source: importSource,
                    origin: timelineOrigin,
                    displayId: String(document.documentId || '').trim() || null,
                    category: 'REGISTRO',
                    status: 'PENDENTE',
                    priority: fatalDate ? 'ALTA' : 'MEDIA',
                    fatalDate: fatalDate ? new Date(fatalDate) : null,
                    requesterName: requesterLabel,
                    responsibleName: process.responsibleLawyer || null,
                    metadata: {
                        importSource,
                        externalKey,
                        externalDocumentId: document.referenceType === 'EVENT' ? null : String(document.documentId || '').trim() || null,
                        externalEventNumber: document.referenceType === 'EVENT' ? String(document.documentId || '').trim() || null : null,
                        referenceType: document.referenceType || null,
                        referenceCode: document.referenceCode || null,
                        eventSequence: document.eventSequence || null,
                        actorName: document.actorName || null,
                        documentType: document.documentType || null,
                        signedAt: document.signedAt || null,
                        pageHint: document.pageHint || null,
                        deadlineCandidates: document.deadlineCandidates || [],
                        importedAt: nowIso,
                        originalFileName: originalFileName || null,
                        raw: {
                            documentId: document.documentId,
                            label: document.label,
                            documentType: document.documentType || null,
                            signedAt: document.signedAt || null,
                            pageHint: document.pageHint || null,
                            referenceType: document.referenceType || null,
                            referenceCode: document.referenceCode || null,
                            eventSequence: document.eventSequence || null,
                            actorName: document.actorName || null,
                        },
                    },
                };
            });

        if (newTimelineEntries.length > 0) {
            await this.prisma.processTimeline.createMany({
                data: newTimelineEntries,
            });
        }

        const drxSummary = await this.buildPdfDrxSummary(tenantId, process, analysis, cnjStatus);
        const currentMetadata =
            process.metadata && typeof process.metadata === 'object' && !Array.isArray(process.metadata)
                ? { ...process.metadata }
                : {};
        const explicitFatalDateCount = analysis.deadlineCandidates.filter((candidate) => candidate.fatalDate).length;

        await this.prisma.process.update({
            where: { id },
            data: {
                court: analysis.court || undefined,
                courtSystem: analysis.courtSystem || undefined,
                vars: analysis.vars || undefined,
                district: analysis.district || undefined,
                subject: analysis.subject || undefined,
                class: analysis.class || undefined,
                distributionDate: this.parseDate(analysis.distributionDate),
                judge: analysis.judge || undefined,
                value: this.parseMoneyValue(analysis.value),
                parties: analysis.parts?.length ? analysis.parts : undefined,
                lastCrawledAt: new Date(),
                metadata: {
                    ...currentMetadata,
                    pdfDossierImport: {
                        source: importSource,
                        sourceSystem: analysis.courtSystem || null,
                        importedAt: nowIso,
                        originalFileName: originalFileName || null,
                        importedCount: newTimelineEntries.length,
                        skippedCount: importCandidates.length - newTimelineEntries.length,
                        totalCandidateCount: importCandidates.length,
                        pageCount: analysis.pageCount,
                        textLength: analysis.textLength,
                        ocrStatus: analysis.ocrStatus,
                        documentCount: analysis.documents.length,
                        proceduralActCount: analysis.proceduralActs.length,
                        deadlineCount: analysis.deadlineCandidates.length,
                        explicitFatalDateCount,
                        cnjMovementCount: cnjStatus?.totalAvailableCount || 0,
                        pdfOnlyAnalysis,
                        detectedCnj: analysis.cnj || null,
                        timelineReferenceType: analysis.timelineReferenceType,
                        drxSummary,
                        lastAnalysisExcerpt: analysis.rawTextExcerpt.slice(0, 1200),
                    },
                },
            },
        });

        if ((analysis.parts?.length || 0) > 0 || this.isInformativeJudgeName(analysis.judge)) {
            await this.syncImportedProcessParties(id, tenantId, analysis.parts as any[], analysis.judge);
        }

        await this.upsertPdfDrxGuidanceTimeline(id, process, analysis, drxSummary);

        return {
            success: true,
            processId: id,
            originalFileName: originalFileName || null,
            importedCount: newTimelineEntries.length,
            skippedCount: importCandidates.length - newTimelineEntries.length,
            totalCandidateCount: importCandidates.length,
            deadlineCount: analysis.deadlineCandidates.length,
            explicitFatalDateCount,
            cnjMovementCount: cnjStatus?.totalAvailableCount || 0,
            cnjImportStatus: cnjStatus,
            drxSummary,
            analysis: {
                cnj: analysis.cnj,
                pageCount: analysis.pageCount,
                textLength: analysis.textLength,
                ocrStatus: analysis.ocrStatus,
                documentCount: analysis.documents.length,
                proceduralActCount: analysis.proceduralActs.length,
            },
            message:
                newTimelineEntries.length > 0
                    ? `${newTimelineEntries.length} andamento(s) enriquecido(s) a partir do PDF do processo (${analysis.courtSystem || 'tribunal'}), sem sobrescrever o historico existente.${pdfOnlyAnalysis ? ' Analise realizada somente pelo PDF.' : ''}`
                    : `Nenhum novo documento processual foi identificado para importar. Os registros ja existentes foram preservados.${pdfOnlyAnalysis ? ' Analise realizada somente pelo PDF.' : ''}`,
        };
    }

    async importProcessPdfAndUpsertProcess(
        tenantId: string,
        fileBuffer: Buffer,
        originalFileName?: string | null,
    ) {
        const analysis = await this.pdfService.analyzeFullProcessPdf(fileBuffer);
        const upsertResult = await this.upsertProcessFromPdfAnalysis(tenantId, analysis, originalFileName);
        const importResult = await this.importProcessPdfDossierFromAnalysis(upsertResult.processId, tenantId, analysis, originalFileName);
        const process = await this.findOne(upsertResult.processId, tenantId);

        return {
            ...importResult,
            processAction: upsertResult.processAction,
            process,
            message:
                upsertResult.processAction === 'CREATED'
                    ? `Processo cadastrado a partir do PDF e sincronizado com partes, andamentos e leitura do DrX-Claw. ${importResult.message}`
                    : `Processo atualizado a partir do PDF e sincronizado com partes, andamentos e leitura do DrX-Claw. ${importResult.message}`,
        };
    }

    async importProcessPdfDossier(
        id: string,
        tenantId: string,
        fileBuffer: Buffer,
        originalFileName?: string | null,
    ): Promise<PdfDossierImportResult> {
        const analysis = await this.pdfService.analyzeFullProcessPdf(fileBuffer);
        return this.importProcessPdfDossierFromAnalysis(id, tenantId, analysis, originalFileName);
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

        const aktivTerms = ['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE', 'POLO ATIVO'];
        if (aktivTerms.some(term => normalized.includes(term))) {
            if (normalized.includes('AUTORA')) return 'AUTORA';
            if (normalized.includes('REQUERENTE')) return 'REQUERENTE';
            if (normalized.includes('EXEQUENTE')) return 'EXEQUENTE';
            if (normalized.includes('RECLAMANTE')) return 'RECLAMANTE';
            return 'AUTOR';
        }

        const passivTerms = ['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO', 'POLO PASSIVO'];
        if (passivTerms.some(term => normalized.includes(term))) {
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

    private mergeImportedPartyInputs(parties: ImportedProcessPartyInput[]) {
        const merged = new Map<string, ImportedProcessPartyInput>();

        for (const party of parties) {
            const normalizedName = this.normalizeText(party?.name);
            const normalizedDocument = this.normalizeDocument(party?.document);
            if (!normalizedName && !normalizedDocument) continue;

            const roleName = this.normalizeImportedRole(party?.type);
            const pole = this.inferImportedPole(roleName);
            const key = pole && !this.isLawyerRole(roleName)
                ? `${normalizedDocument || normalizedName}::${pole}`
                : `${normalizedDocument || normalizedName}::${roleName}`;
            const existing = merged.get(key);
            const representedNames = new Map<string, string>();

            for (const candidate of [...(existing?.representedNames || []), ...(party?.representedNames || [])]) {
                const normalizedCandidate = this.normalizeText(candidate);
                if (normalizedCandidate && !representedNames.has(normalizedCandidate)) {
                    representedNames.set(normalizedCandidate, String(candidate).trim());
                }
            }

            merged.set(key, {
                ...(existing || {}),
                ...party,
                name: String(party?.name || existing?.name || '').trim(),
                type: roleName,
                document: existing?.document || party?.document || null,
                email: existing?.email || party?.email || null,
                phone: existing?.phone || party?.phone || null,
                oab: existing?.oab || party?.oab || null,
                representedNames: Array.from(representedNames.values()),
                isClient: party?.isClient ?? existing?.isClient,
                isOpposing: party?.isOpposing ?? existing?.isOpposing,
            });
        }

        return Array.from(merged.values());
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
        party?: ImportedProcessPartyInput,
        notes?: string,
    ) {
        console.log(`Upserting Imported Process Party: ContactId=${contactId}, Role=${roleName}`);
        const role = await this.ensureRole(tenantId, roleName);
        const flags = this.resolveImportedPartyFlags(role.name, party);
        const qualificationName =
            flags.isClient ? 'CLIENTE' : flags.isOpposing ? 'CONTRARIO' : this.getQualificationNameForRole(role.name);
        const qualification = qualificationName
            ? await this.ensureQualification(tenantId, qualificationName)
            : null;
        const inferredPole = this.inferImportedPole(role.name);

        const data = {
            qualificationId: qualification?.id || null,
            isClient: flags.isClient,
            isOpposing: flags.isOpposing,
            notes: notes || undefined,
        };

        const existingSamePole =
            inferredPole && !this.isLawyerRole(role.name)
                ? await this.prisma.processParty.findFirst({
                      where: {
                          processId,
                          contactId,
                          role: {
                              category: inferredPole === 'ACTIVE' ? 'POLO_ATIVO' : 'POLO_PASSIVO',
                          },
                      },
                      include: {
                          role: {
                              select: {
                                  id: true,
                                  name: true,
                              },
                          },
                      },
                      orderBy: { createdAt: 'asc' },
                  })
                : null;

        if (existingSamePole) {
            // Verificar se já existe outro registro com exatamente a mesma tríade (processo, contato, role alvo)
            // para evitar colisão na constraint única durante a alteração de papel (role)
            const targetExisting = await this.prisma.processParty.findUnique({
                where: {
                    processId_contactId_roleId: {
                        processId,
                        contactId,
                        roleId: role.id,
                    },
                },
            });

            if (targetExisting && targetExisting.id !== existingSamePole.id) {
                // Se o alvo já existe, removemos o registro redundante do mesmo polo
                // e atualizamos o registro do alvo com os novos dados
                console.log(`Resolving collision for party update: deleting ${existingSamePole.id}, updating ${targetExisting.id}`);
                await this.prisma.processParty.delete({ where: { id: existingSamePole.id } });
                return this.prisma.processParty.update({
                    where: { id: targetExisting.id },
                    data,
                });
            }

            return this.prisma.processParty.update({
                where: { id: existingSamePole.id },
                data: {
                    roleId: role.id,
                    ...data,
                },
            });
        }

        // Se estivermos mudando de polo, remover registros antigos deste contato em outros polos principais
        if (inferredPole && !this.isLawyerRole(role.name)) {
            await this.prisma.processParty.deleteMany({
                where: {
                    processId,
                    contactId,
                    role: {
                        category: { in: ['POLO_ATIVO', 'POLO_PASSIVO'] }
                    }
                }
            });
        }

        return this.prisma.processParty.upsert({
            where: {
                processId_contactId_roleId: {
                    processId,
                    contactId,
                    roleId: role.id,
                },
            },
            update: data,
            create: {
                tenantId,
                processId,
                contactId,
                roleId: role.id,
                qualificationId: qualification?.id || undefined,
                isClient: flags.isClient,
                isOpposing: flags.isOpposing,
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
        const principalRefs = refs.filter(ref => !this.isLawyerRole(ref.roleName) && ref.pole);
        const lawyerRefs = refs.filter(ref => this.isLawyerRole(ref.roleName));

        for (const lawyer of lawyerRefs) {
            const explicitTargets = lawyer.representedNames
                .map(name => this.matchImportedPartyRef(principalRefs, name))
                .filter(Boolean) as ImportedPartySyncRef[];

            let targets = explicitTargets;

            if (targets.length === 0) {
                const inferredPole = this.inferImportedPole(lawyer.roleName);
                if (inferredPole) {
                    targets = principalRefs.filter(ref => ref.pole === inferredPole);
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

    private async collapseImportedPrincipalDuplicates(processId: string) {
        const processParties = await this.prisma.processParty.findMany({
            where: { processId },
            include: {
                role: {
                    select: {
                        name: true,
                        category: true,
                    },
                },
                representativeLinks: {
                    select: {
                        representativePartyId: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        const grouped = new Map<string, typeof processParties>();
        for (const party of processParties) {
            if (this.isLawyerRole(party.role?.name)) continue;

            const normalizedCategory = this.normalizeText(party.role?.category);
            if (!['POLO_ATIVO', 'POLO_PASSIVO'].includes(normalizedCategory)) continue;

            const key = `${party.contactId}::${normalizedCategory}`;
            const current = grouped.get(key) || [];
            current.push(party);
            grouped.set(key, current);
        }

        for (const duplicates of grouped.values()) {
            if (duplicates.length <= 1) continue;

            const [primary, ...rest] = duplicates;

            for (const duplicate of rest) {
                for (const link of duplicate.representativeLinks) {
                    await this.prisma.processPartyRepresentation.upsert({
                        where: {
                            partyId_representativePartyId: {
                                partyId: primary.id,
                                representativePartyId: link.representativePartyId,
                            },
                        },
                        update: {},
                        create: {
                            tenantId: duplicate.tenantId,
                            processId,
                            partyId: primary.id,
                            representativePartyId: link.representativePartyId,
                        },
                    });
                }

                await this.prisma.processPartyRepresentation.deleteMany({
                    where: { partyId: duplicate.id },
                });

                await this.prisma.processParty.delete({
                    where: { id: duplicate.id },
                });
            }
        }
    }

    private async syncImportedProcessParties(
        processId: string,
        tenantId: string,
        parties: any[] = [],
        judgeName?: string,
    ) {
        const safeParties = this.mergeImportedPartyInputs((Array.isArray(parties) ? parties : []) as ImportedProcessPartyInput[]);
        console.log(`Syncing ${safeParties.length} imported parties for process ${processId}`);
        const syncedRefs: ImportedPartySyncRef[] = [];

        for (const party of safeParties) {
            const name = String(party?.name || '').trim();
            if (!name) {
                console.log(`Skipping party with no name: ${JSON.stringify(party)}`);
                continue;
            }

            const roleName = this.normalizeImportedRole(party?.type);
            console.log(`Processing imported party: name=${name}, role=${roleName}, type=${party?.type}`);

            const contactId = await this.findOrCreateImportedContact(
                tenantId,
                name,
                roleName,
                party?.document,
                party?.phone,
                party?.email,
            );

            if (!contactId) {
                console.warn(`Could not create/find contact for party ${name}`);
                continue;
            }

            const processParty = await this.upsertImportedProcessParty(
                tenantId,
                processId,
                contactId,
                roleName,
                party,
                'Importado automaticamente via consulta/processo',
            );

            console.log(`Linked party ${name} (Contact: ${contactId}) to process as ${roleName}`);
            const flags = this.resolveImportedPartyFlags(roleName, party);

            syncedRefs.push({
                id: processParty.id,
                contactId,
                roleName,
                normalizedName: this.normalizeText(name),
                normalizedDocument: this.normalizeDocument(party?.document),
                representedNames: Array.isArray(party?.representedNames) ? party.representedNames : [],
                pole: this.inferImportedPole(roleName),
                isClient: flags.isClient,
                isOpposing: flags.isOpposing,
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
                    undefined,
                    'Magistrado importado automaticamente via consulta/processo',
                );

                syncedRefs.push({
                    id: judgeParty.id,
                    contactId: judgeContactId,
                    roleName: 'MAGISTRADO',
                    normalizedName: this.normalizeText(String(judgeName).trim()),
                    normalizedDocument: null,
                    representedNames: [],
                    pole: null,
                    isClient: false,
                    isOpposing: false,
                });
            }
        }

        await this.linkImportedRepresentations(tenantId, processId, syncedRefs);
        await this.collapseImportedPrincipalDuplicates(processId);
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
        if (data.category === 'JUDICIAL' && !data.cnj) {
            throw new BadRequestException('CNJ e obrigatorio para processos judiciais.');
        }
        if (data.category === 'EXTRAJUDICIAL' && !data.title) {
            throw new BadRequestException('Titulo e obrigatorio para casos.');
        }

        const tenantId = await this.resolveTenantId(data.tenantId);
        const code = await this.buildProcessCode(tenantId, data);
        const normalizedStatus = this.normalizeLifecycleStatus(data.status, 'ATIVO');
        const processMetadata = this.buildProcessMetadata(data.metadata, data.status, normalizedStatus);

        let finalWorkflowId = data.workflowId?.trim() || null;
        if (!finalWorkflowId) {
            const defaultWorkflow = await this.prisma.workflow.findFirst({
                where: { tenantId, isDefault: true, isActive: true },
                select: { id: true },
            });
            if (defaultWorkflow) finalWorkflowId = defaultWorkflow.id;
        }

        const inputParties = Array.isArray(data.parties) ? data.parties : [];
        const hasClientInParties = inputParties.some(p => p.isClient || String(p.type || '').toUpperCase().includes('CLIENTE'));
        
        const processData: any = {
            tenantId,
            workflowId: finalWorkflowId || null,
            cnj: this.normalizeCnj(data.cnj),
            category: data.category,
            title: data.title || `Processo ${this.normalizeCnj(data.cnj) || data.cnj}`,
            code,
            description: data.description,
            folder: data.folder,
            localFolder: data.localFolder,
            court: data.court,
            courtSystem: data.courtSystem,
            npu: this.normalizeCnj(data.cnj),
            vars: data.vars,
            district: data.district,
            status: normalizedStatus,
            area: data.area,
            subject: data.subject,
            class: data.class,
            distributionDate: this.parseDate(data.distributionDate),
            judge: data.judge,
            value: this.parseMoneyValue(data.value),
            metadata: processMetadata,
            parties: Array.isArray(data.parties) ? data.parties : [],
        };

        try {
            const process =
                data.category === 'JUDICIAL' && data.cnj
                    ? await this.prisma.process.upsert({
                        where: { 
                            tenantId_cnj: {
                                tenantId,
                                cnj: processData.cnj!
                            }
                        },
                        update: {
                            cnj: processData.cnj,
                            category: processData.category,
                            title: processData.title,
                            code: processData.code,
                            description: processData.description,
                            folder: processData.folder,
                            localFolder: processData.localFolder,
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
                            metadata: processData.metadata,
                        },
                        create: processData,
                    })
                    : await this.prisma.process.create({
                        data: processData,
                    });

        // Registrar andamento automático de criação
        await this.timelineService.createSystemTimeline(
            process.id,
            'Abertura do Processo',
            `Processo cadastrado no sistema com status inicial: ${process.status}.`,
            { action: 'CREATE', method: data.category === 'JUDICIAL' && data.cnj ? 'UPSERT' : 'CREATE' }
        );

        if (process.workflowId) {
            await this.timelineService.triggerNextWorkflowSteps(
                process.id,
                process.workflowId,
                0,
                'Sistema (Auto)'
            );
        }

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
            console.error('Error creating/upserting process:', error);
            throw error;
        }
    }

    async findAll(params: {
        tenantId: string,
        search?: string,
        includedTags?: string,
        excludedTags?: string,
        status?: string,
        advancedFilter?: string,
        updatedFrom?: string,
        updatedTo?: string,
    }) {
        if (!params.tenantId) {
            throw new BadRequestException('Tenant ID is required');
        }
        const { tenantId, search, includedTags, excludedTags, status, advancedFilter, updatedFrom, updatedTo } = params;

        const where: any = { tenantId };

        const parseDateEdge = (raw?: string, edge: 'start' | 'end' = 'start') => {
            const value = String(raw || '').trim();
            if (!value) return null;
            let dt: Date;
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                dt = edge === 'start'
                    ? new Date(`${value}T00:00:00.000Z`)
                    : new Date(`${value}T23:59:59.999Z`);
            } else {
                dt = new Date(value);
            }
            return Number.isFinite(dt.getTime()) ? dt : null;
        };

        if (search) {
            where.OR = [
                { cnj: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { court: { contains: search, mode: 'insensitive' } },
                { courtSystem: { contains: search, mode: 'insensitive' } },
                { vars: { contains: search, mode: 'insensitive' } },
                { district: { contains: search, mode: 'insensitive' } },
                { judge: { contains: search, mode: 'insensitive' } },
                { responsibleLawyer: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { area: { contains: search, mode: 'insensitive' } },
                { folder: { contains: search, mode: 'insensitive' } },
                { localFolder: { contains: search, mode: 'insensitive' } },
                {
                    processParties: {
                        some: {
                            contact: {
                                name: { contains: search, mode: 'insensitive' },
                            },
                        },
                    },
                },
            ];
        }

        if (status && status !== 'ALL') {
            if (status === 'ATIVO') {
                where.NOT = {
                    status: {
                        in: ['INATIVO', 'SUSPENSO', 'ARQUIVADO', 'ENCERRADO'],
                    },
                };
            } else if (status === 'INATIVO') {
                where.status = {
                    in: ['INATIVO', 'SUSPENSO', 'ARQUIVADO', 'ENCERRADO'],
                };
            } else {
                where.status = this.normalizeLifecycleStatus(status, status);
            }
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

        if (advancedFilter) {
            const advancedWhere = buildAdvancedProcessWhere(advancedFilter);
            if (advancedWhere) {
                if (!where.AND) where.AND = [];
                where.AND.push(advancedWhere);
            }
        }

        if (updatedFrom || updatedTo) {
            const from = parseDateEdge(updatedFrom, 'start');
            const to = parseDateEdge(updatedTo, 'end');
            if (from || to) {
                if (!where.AND) where.AND = [];
                where.AND.push({
                    updatedAt: {
                        ...(from ? { gte: from } : {}),
                        ...(to ? { lte: to } : {}),
                    },
                });
            }
        }

        const rawProcesses = await this.prisma.process.findMany({
            where,
            include: {
                tags: { include: { tag: true } },
                processParties: {
                    include: {
                        contact: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                whatsapp: true,
                            },
                        },
                        role: true,
                        qualification: true,
                    },
                },
                timeline: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return rawProcesses.map(p => {
            const clientParty = p.processParties.find(cp => cp.isClient) || p.processParties[0];
            return {
                ...p,
                client: clientParty?.contact?.name || 'S/ CLIENTE',
            };
        });
    }

    async findOne(id: string, tenantId: string) {
        const process = await this.prisma.process.findFirst({
            where: { id, tenantId },
            include: {
                tags: { include: { tag: true } },
                processParties: {
                    include: {
                        contact: {
                            include: {
                                additionalContacts: true,
                            },
                        },
                        role: true,
                        qualification: true,
                        representativeLinks: {
                            include: {
                                representativeParty: {
                                    include: {
                                        contact: true,
                                        role: true,
                                    },
                                },
                            },
                        },
                    },
                },
                timeline: {
                    orderBy: { date: 'desc' },
                    include: {
                        tags: {
                            include: {
                                tag: true
                            }
                        }
                    }
                },
                workflow: {
                    include: {
                        steps: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!process) throw new NotFoundException('Processo nao encontrado');

        const clientParty = process.processParties.find(cp => cp.isClient) || process.processParties[0];

        return {
            ...process,
            client: clientParty?.contact?.name || 'S/ CLIENTE',
        };
    }

    async update(id: string, data: Partial<CreateProcessDto>, tenantId: string) {
        const existing = await this.prisma.process.findFirst({ 
            where: { id, tenantId },
            include: { processParties: true }
        });
        if (!existing) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        const inputParties = Array.isArray(data.parties) ? data.parties : [];
        const hasClientInParties = inputParties.some(p => p.isClient || String(p.type || '').toUpperCase().includes('CLIENTE'));
        const hasClientInExisting = existing.processParties.some(p => p.isClient);
        
        if (!hasClientInParties && !hasClientInExisting) {
            throw new BadRequestException('O processo deve manter ao menos um Cliente Principal vinculado nas Partes.');
        }

        const updateData: any = {};
        let statusChanged = false;

        if (data.title !== undefined) updateData.title = data.title;
        if (data.cnj !== undefined) {
            updateData.cnj = this.normalizeCnj(data.cnj);
            updateData.npu = this.normalizeCnj(data.cnj);
        }
        if (data.category !== undefined) updateData.category = data.category;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.folder !== undefined) updateData.folder = data.folder;
        if (data.localFolder !== undefined) updateData.localFolder = data.localFolder;
        if (data.court !== undefined) updateData.court = data.court;
        if (data.courtSystem !== undefined) updateData.courtSystem = data.courtSystem;
        if (data.vars !== undefined) updateData.vars = data.vars;
        if (data.district !== undefined) updateData.district = data.district;
        
        if (data.status !== undefined) {
            const nextStatus = this.normalizeLifecycleStatus(data.status, existing.status || 'ATIVO');
            if (nextStatus !== existing.status) {
                updateData.status = nextStatus;
                statusChanged = true;
            }
        }
        
        let lawyerChanged = false;
        if (data.responsibleLawyer !== undefined && data.responsibleLawyer !== existing.responsibleLawyer) {
            updateData.responsibleLawyer = data.responsibleLawyer;
            lawyerChanged = true;
        }

        if (data.area !== undefined) updateData.area = data.area;
        if (data.subject !== undefined) updateData.subject = data.subject;
        if (data.class !== undefined) updateData.class = data.class;
        if (data.judge !== undefined) updateData.judge = data.judge;
        // Removido updateData.parties para evitar erro no Prisma, as partes são processadas via syncImportedProcessParties
        // if (data.parties !== undefined) updateData.parties = data.parties;
        if (data.metadata !== undefined || data.status !== undefined) {
            const nextStatus =
                updateData.status ||
                this.normalizeLifecycleStatus(existing.status, 'ATIVO');
            const baseMetadata = data.metadata !== undefined ? data.metadata : existing.metadata;
            updateData.metadata = this.buildProcessMetadata(
                baseMetadata,
                data.status,
                nextStatus,
            );
        }
        
        // Removido contactId para centralizar em Partes
        // if (data.contactId !== undefined) updateData.contactId = data.contactId;

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

            // Registrar andamentos automáticos de auditoria
            if (statusChanged) {
                await this.timelineService.createSystemTimeline(
                    id,
                    'Alteração de Status',
                    `O status do processo foi alterado de "${existing.status}" para "${updateData.status}".`,
                    { oldStatus: existing.status, newStatus: updateData.status }
                );
            }

            if (lawyerChanged) {
                await this.timelineService.createSystemTimeline(
                    id,
                    'Responsável Alterado',
                    `Advogado responsável alterado de "${existing.responsibleLawyer || 'Nenhum'}" para "${updateData.responsibleLawyer}".`,
                    { oldLawyer: existing.responsibleLawyer, newLawyer: updateData.responsibleLawyer }
                );
            }

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
            console.error('Error updating process:', error);
            throw error;
        }
    }

    async remove(id: string, tenantId: string) {
        const existing = await this.prisma.process.findFirst({ where: { id, tenantId } });
        if (!existing) {
            throw new NotFoundException(`Processo nao encontrado (ID: ${id})`);
        }

        await this.prisma.processTimeline.deleteMany({ where: { processId: id } });

        const deleted = await this.prisma.process.delete({ where: { id } });
        return { success: true, deleted: { id: deleted.id, title: deleted.title } };
    }

    async getFilterOptions(tenantId: string) {
        const [categories, statuses, areas] = await Promise.all([
            this.prisma.process.findMany({
                where: { tenantId, category: { not: '' } },
                select: { category: true },
                distinct: ['category'],
            }),
            this.prisma.process.findMany({
                where: { tenantId, status: { not: '' } },
                select: { status: true },
                distinct: ['status'],
            }),
            this.prisma.process.findMany({
                where: { tenantId, area: { not: null } },
                select: { area: true },
                distinct: ['area'],
            }),
        ]);

        return {
            categories: categories.map(c => c.category).filter(Boolean),
            statuses: statuses.map(s => s.status).filter(Boolean),
            areas: areas.map(a => a.area).filter(Boolean),
        };
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

    async createLocalFolder(processId: string, tenantId: string, requestedPath: string) {
        const process = await this.prisma.process.findFirst({ where: { id: processId, tenantId } });
        if (!process) throw new NotFoundException('Processo não encontrado');
        if (!requestedPath) throw new BadRequestException('Caminho não fornecido');

        const fs = require('fs');
        console.log(`[LOCAL_FOLDER] Tentativa de criar/vincular: ${requestedPath}`);
        
        if (!fs.existsSync(requestedPath)) {
            try {
                fs.mkdirSync(requestedPath, { recursive: true });
                console.log(`[LOCAL_FOLDER] Pasta criada fisicamente.`);
            } catch (e: any) {
                console.error(`[LOCAL_FOLDER] Erro mkdirSync: ${e.message}`);
                throw new BadRequestException(`Erro ao criar pasta: ${e.message}`);
            }
        } else {
            console.log(`[LOCAL_FOLDER] Pasta já existe fisicamente.`);
        }

        const updated = await this.prisma.process.update({
            where: { id: processId },
            data: { localFolder: requestedPath }
        });
        
        console.log(`[LOCAL_FOLDER] Sucesso ao atualizar DB: ${updated.localFolder}`);
        return { success: true, localFolder: updated.localFolder, message: 'Pasta local vinculada com sucesso!' };
    }

    async openLocalFolder(processId: string, tenantId: string) {
        const process = await this.prisma.process.findFirst({ where: { id: processId, tenantId } });
        if (!process) throw new NotFoundException('Processo não encontrado');
        
        console.log(`[LOCAL_FOLDER] Abrindo pasta: ${process.localFolder}`);
        if (!process.localFolder) throw new BadRequestException('Pasta local não configurada neste processo (DB vazio)');

        const fs = require('fs');
        if (!fs.existsSync(process.localFolder)) {
            console.warn(`[LOCAL_FOLDER] Pasta não existe no disco: ${process.localFolder}`);
            throw new BadRequestException('A pasta física não foi encontrada no computador ou no drive de rede Z:.');
        }

        const { spawn } = require('child_process');
        try {
            const subprocess = spawn('explorer.exe', [process.localFolder], {
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            });
            subprocess.unref();
            return { success: true, message: 'Pasta aberta!' };
        } catch (e: any) {
            console.error('[LOCAL_FOLDER] Erro spawn explorer.exe:', e);
            throw new BadRequestException(`Falha ao disparar explorer: ${e.message}`);
        }
    }

    async pickLocalFolder() {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            // PowerShell folder picker dialog - TopMost garante que a janela não fique escondida
            const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecione a pasta do processo'; $f.SelectedPath = 'Z:\\'; $f.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; [void]$f.ShowDialog($form); $f.SelectedPath"`;
            
            exec(command, (error: any, stdout: string) => {
                if (error) {
                    console.error('[LOCAL_FOLDER] Picker error:', error);
                    resolve({ success: false, message: 'Erro ao abrir o seletor de pastas do Windows.' });
                    return;
                }
                const result = stdout.trim();
                if (!result) {
                    resolve({ success: false, message: 'Nenhuma pasta selecionada.' });
                } else {
                    resolve({ success: true, path: result });
                }
            });
        });
    }
}
