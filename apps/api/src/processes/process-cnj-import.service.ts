import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProcessIntegrationsService } from './process-integrations.service';
import { ProcessNormalizationService } from './process-normalization.service';

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

@Injectable()
export class ProcessCnjImportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly integrationsService: ProcessIntegrationsService,
        private readonly normalization: ProcessNormalizationService,
    ) {}

    /** Busca apenas os dados do processo necessários para importação. Não carrega timelines. */
    // TODO: delegado para ProcessCnjImportService
    async getProcessForImport(id: string, tenantId: string) {
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

        return process;
    }

    /** Conta timelines importadas do DataJud usando COUNT no banco — sem carregar registros em memória. */
    // TODO: delegado para ProcessCnjImportService
    async getImportedTimelineCount(processId: string): Promise<number> {
        return this.prisma.processTimeline.count({
            where: {
                processId,
                metadata: {
                    path: ['importSource'],
                    equals: 'DATAJUD',
                },
            },
        });
    }

    /** Carrega apenas os campos necessários para construir o Set de chaves de deduplicação. */
    // TODO: delegado para ProcessCnjImportService
    async getExistingTimelineKeySet(processId: string, cnj: string): Promise<Set<string>> {
        const timelines = await this.prisma.processTimeline.findMany({
            where: { processId },
            select: {
                id: true,
                title: true,
                date: true,
                displayId: true,
                metadata: true,
            },
        });
        return new Set(timelines.map((item) => this.normalization.getExistingTimelineKey(cnj, item)));
    }

    /** @deprecated Use getProcessForImport() + getImportedTimelineCount() + getExistingTimelineKeySet() separadamente. */
    // TODO: delegado para ProcessCnjImportService
    async getTimelineImportProcessContext(id: string, tenantId: string) {
        const process = await this.getProcessForImport(id, tenantId);
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

    buildBlockedTimelineImportStatus(
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

    // TODO: delegado para ProcessCnjImportService
    async getOptionalCnjTimelineStatus(id: string, tenantId: string) {
        try {
            return await this.getCnjTimelineImportStatus(id, tenantId);
        } catch (_error) {
            return null;
        }
    }

    // TODO: delegado para ProcessCnjImportService
    async getCnjTimelineImportStatus(id: string, tenantId: string): Promise<TimelineImportStatus> {
        const process = await this.getProcessForImport(id, tenantId);
        const normalizedCnj = this.normalization.normalizeCnj(process.cnj);

        // COUNT no banco — zero carregamento de registros em memória para este check
        const importedTimelineCount = await this.getImportedTimelineCount(id);

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

            // Carrega chaves apenas quando há movimentos a comparar
            const existingKeys = await this.getExistingTimelineKeySet(id, normalizedCnj);
            const newMovementCount = rawMovements.filter(
                (movement: any) => !existingKeys.has(this.normalization.buildImportedTimelineKey(normalizedCnj, movement)),
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

    // TODO: delegado para ProcessCnjImportService
    async importCnjTimelines(id: string, tenantId: string) {
        // Valida processo e CNJ sem carregar timelines ainda
        const process = await this.getProcessForImport(id, tenantId);
        const normalizedCnj = this.normalization.normalizeCnj(process.cnj);

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

        // Carrega chaves de deduplicação somente quando há movimentos a processar
        const existingKeys = rawMovements.length > 0
            ? await this.getExistingTimelineKeySet(id, normalizedCnj)
            : new Set<string>();

        const timelineOrigin = this.normalization.inferTimelineOrigin(
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
                const key = this.normalization.buildImportedTimelineKey(normalizedCnj, movement);
                // Checa e registra em uma única passagem — sem recalcular no map
                if (existingKeys.has(key)) return false;
                existingKeys.add(key);
                return true;
            })
            .map((movement: any) => {
                // externalKey já foi calculado no filter; recalcula apenas aqui para o payload
                const externalKey = this.normalization.buildImportedTimelineKey(normalizedCnj, movement);
                const eventDate = this.normalization.parseDate(movement?.dataHora) || new Date();

                return {
                    processId: id,
                    title: String(movement?.nome || 'Movimento CNJ').trim() || 'Movimento CNJ',
                    description: this.normalization.buildMovementTimelineDescription(movement),
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
}
