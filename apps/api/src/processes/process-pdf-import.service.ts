import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProcessPdfService } from './process-pdf.service';
import type { FullProcessPdfAnalysis, PdfProcessDocument } from './process-pdf.service';
import { DrxClawService } from '../drx-claw/drx-claw.service';
import { PROCESS_PDF_SKILL_ID } from '../drx-claw/drx-skill.constants';
import { ProcessNormalizationService } from './process-normalization.service';
import { ProcessCnjImportService } from './process-cnj-import.service';

type TimelineImportStatus = {
    canImport: boolean;
    reasonCode: string;
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

/**
 * Handles PDF-based process import operations.
 * Uses a setter injection pattern to avoid circular dependency with ProcessesService.
 */
@Injectable()
export class ProcessPdfImportService {
    /**
     * Setter-injected reference to ProcessesService callbacks.
     * Call setProcessesServiceCallbacks() from ProcessesService.onModuleInit().
     */
    private _syncImportedProcessParties: ((processId: string, tenantId: string, parties: any[], judgeName?: string) => Promise<void>) | null = null;
    private _syncMicrosoftFolder: ((tenantId: string, processId: string) => Promise<void>) | null = null;
    private _findOne: ((id: string, tenantId: string) => Promise<any>) | null = null;
    private _buildProcessCode: ((tenantId: string, data: any) => Promise<string>) | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: ProcessPdfService,
        private readonly drxClawService: DrxClawService,
        private readonly normalization: ProcessNormalizationService,
        private readonly cnjImportService: ProcessCnjImportService,
    ) {}

    setProcessesServiceCallbacks(callbacks: {
        syncImportedProcessParties: (processId: string, tenantId: string, parties: any[], judgeName?: string) => Promise<void>;
        syncMicrosoftFolder: (tenantId: string, processId: string) => Promise<void>;
        findOne: (id: string, tenantId: string) => Promise<any>;
        buildProcessCode: (tenantId: string, data: any) => Promise<string>;
    }) {
        this._syncImportedProcessParties = callbacks.syncImportedProcessParties;
        this._syncMicrosoftFolder = callbacks.syncMicrosoftFolder;
        this._findOne = callbacks.findOne;
        this._buildProcessCode = callbacks.buildProcessCode;
    }

    private resolvePdfTimelineCandidates(analysis: FullProcessPdfAnalysis) {
        const preferred = analysis.proceduralActs.filter((document) => document.contentText || document.documentType);
        if (preferred.length > 0) {
            return preferred;
        }

        return analysis.documents.filter((document) => document.contentText || document.label);
    }

    private shouldUsePdfOnlyAnalysis(analysis?: Partial<FullProcessPdfAnalysis> | null) {
        const courtSystem = this.normalization.normalizeText(analysis?.courtSystem);
        return courtSystem.includes('EPROC') || courtSystem.includes('PJE');
    }

    private buildPdfReferenceLabel(document: PdfProcessDocument) {
        const referenceType = document?.referenceType === 'EVENT' ? 'Evento' : 'ID';
        const referenceValue = String(document?.documentId || '').trim();
        if (!referenceValue) return null;
        return `${referenceType} ${referenceValue}${document?.referenceCode ? ` (${document.referenceCode})` : ''}`;
    }

    private pickPdfFatalDate(document: PdfProcessDocument) {
        const explicit = (document?.deadlineCandidates || []).find((candidate) => candidate.fatalDate);
        return explicit?.fatalDate || null;
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
                        this.normalization.buildPdfTimelineTitle(document),
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

    private async upsertPdfDrxGuidanceTimeline(
        processId: string,
        process: { responsibleLawyer?: string | null },
        analysis: FullProcessPdfAnalysis,
        drxSummary: { answer: string | null },
    ) {
        const answer = String(drxSummary?.answer || '').trim();
        if (!answer) return null;

        const externalKey = `DRX_PDF_GUIDANCE::${this.normalization.resolvePdfImportSource(analysis)}`;
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
                importSource: this.normalization.resolvePdfImportSource(analysis),
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

    // TODO: delegado para ProcessPdfImportService
    async upsertProcessFromPdfAnalysis(
        tenantId: string,
        analysis: FullProcessPdfAnalysis,
        originalFileName?: string | null,
    ) {
        const normalizedCnj = this.normalization.normalizeCnj(analysis.cnj);
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

        const normalizedStatus = this.normalization.normalizeLifecycleStatus(analysis.status, existing?.status || 'ATIVO');
        const mergedMetadata = this.buildProcessMetadata(
            {
                ...(existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
                    ? existing.metadata
                    : {}),
                pdfCoverImport: {
                    source: this.normalization.resolvePdfImportSource(analysis),
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

        if (!this._buildProcessCode) {
            throw new Error('ProcessPdfImportService: buildProcessCode callback not set. Call setProcessesServiceCallbacks() first.');
        }

        const code = existing?.code || (await this._buildProcessCode(tenantId, { category: 'JUDICIAL', cnj: normalizedCnj }));
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
            distributionDate: this.normalization.parseDate(analysis.distributionDate) || existing?.distributionDate || undefined,
            judge: analysis.judge || existing?.judge || undefined,
            value: this.normalization.parseMoneyValue(analysis.value) ?? existing?.value ?? undefined,
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

        if (this._syncImportedProcessParties && ((Array.isArray(processData.parties) && processData.parties.length > 0) || this.normalization.isInformativeJudgeName(processData.judge))) {
            await this._syncImportedProcessParties(process.id, tenantId, processData.parties as any[], processData.judge);
        }

        if (this._syncMicrosoftFolder) {
            await this._syncMicrosoftFolder(tenantId, process.id);
        }

        return {
            processId: process.id,
            processAction: existing ? 'UPDATED' : 'CREATED',
        };
    }

    private buildProcessMetadata(inputMetadata: any, rawStatus?: string | null, normalizedStatus?: string) {
        const metadata =
            inputMetadata && typeof inputMetadata === 'object' && !Array.isArray(inputMetadata)
                ? { ...inputMetadata }
                : {};

        const existingProceduralStatus = String(metadata.proceduralStatus || '').trim();
        const incomingRawStatus = String(rawStatus || '').trim();
        const rawLifecycleStatus = this.normalization.normalizeLifecycleStatus(incomingRawStatus, '');

        if (existingProceduralStatus) {
            metadata.proceduralStatus = existingProceduralStatus;
            return metadata;
        }

        if (incomingRawStatus && (!rawLifecycleStatus || rawLifecycleStatus !== normalizedStatus)) {
            metadata.proceduralStatus = incomingRawStatus;
        }

        return metadata;
    }

    // TODO: delegado para ProcessPdfImportService
    async importProcessPdfDossierFromAnalysis(
        id: string,
        tenantId: string,
        analysis: FullProcessPdfAnalysis,
        originalFileName?: string | null,
    ): Promise<PdfDossierImportResult> {
        const { process, existingTimelines } = await this.cnjImportService.getTimelineImportProcessContext(id, tenantId);
        const normalizedCnj = this.normalization.normalizeCnj(process.cnj || analysis.cnj);
        const timelineOrigin = this.normalization.inferTimelineOrigin(analysis.courtSystem || process.courtSystem || process.court);
        const pdfOnlyAnalysis = this.shouldUsePdfOnlyAnalysis(analysis);
        const cnjStatus = pdfOnlyAnalysis ? null : await this.cnjImportService.getOptionalCnjTimelineStatus(id, tenantId);
        const importCandidates = this.resolvePdfTimelineCandidates(analysis);
        const existingKeys = new Set(
            existingTimelines.map((item) => this.normalization.getExistingTimelineKey(normalizedCnj || '', item)),
        );
        const nowIso = new Date().toISOString();
        const importSource = this.normalization.resolvePdfImportSource(analysis);
        const requesterLabel = analysis.courtSystem === 'Eproc' ? 'Eproc / PDF integral' : analysis.courtSystem === 'PJe' ? 'PJe / PDF integral' : 'Tribunal / PDF integral';

        const newTimelineEntries = importCandidates
            .filter((document) => {
                const externalKey = this.normalization.buildPdfImportedTimelineKey(normalizedCnj || analysis.cnj || null, document, analysis);
                if (existingKeys.has(externalKey)) {
                    return false;
                }
                existingKeys.add(externalKey);
                return true;
            })
            .map((document) => {
                const externalKey = this.normalization.buildPdfImportedTimelineKey(normalizedCnj || analysis.cnj || null, document, analysis);
                const eventDate =
                    this.normalization.parseDate(document.signedAt) ||
                    this.normalization.parseDate(analysis.distributionDate) ||
                    new Date();
                const fatalDate = this.pickPdfFatalDate(document);

                return {
                    processId: id,
                    title: this.normalization.buildPdfTimelineTitle(document),
                    description: this.normalization.buildPdfTimelineDescription(document),
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
                distributionDate: this.normalization.parseDate(analysis.distributionDate),
                judge: analysis.judge || undefined,
                value: this.normalization.parseMoneyValue(analysis.value),
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

        if (this._syncImportedProcessParties && ((analysis.parts?.length || 0) > 0 || this.normalization.isInformativeJudgeName(analysis.judge))) {
            await this._syncImportedProcessParties(id, tenantId, analysis.parts as any[], analysis.judge);
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

    // TODO: delegado para ProcessPdfImportService
    async importProcessPdfAndUpsertProcess(
        tenantId: string,
        fileBuffer: Buffer,
        originalFileName?: string | null,
    ) {
        const analysis = await this.pdfService.analyzeFullProcessPdf(fileBuffer);
        const upsertResult = await this.upsertProcessFromPdfAnalysis(tenantId, analysis, originalFileName);
        const importResult = await this.importProcessPdfDossierFromAnalysis(upsertResult.processId, tenantId, analysis, originalFileName);

        if (!this._findOne) {
            throw new Error('ProcessPdfImportService: findOne callback not set. Call setProcessesServiceCallbacks() first.');
        }

        const process = await this._findOne(upsertResult.processId, tenantId);

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

    // TODO: delegado para ProcessPdfImportService
    async importProcessPdfDossier(
        id: string,
        tenantId: string,
        fileBuffer: Buffer,
        originalFileName?: string | null,
    ): Promise<PdfDossierImportResult> {
        const analysis = await this.pdfService.analyzeFullProcessPdf(fileBuffer);
        return this.importProcessPdfDossierFromAnalysis(id, tenantId, analysis, originalFileName);
    }
}
