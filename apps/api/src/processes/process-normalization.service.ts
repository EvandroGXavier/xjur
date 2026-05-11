import { Injectable } from '@nestjs/common';
import type { FullProcessPdfAnalysis, PdfProcessDocument } from './process-pdf.service';

@Injectable()
export class ProcessNormalizationService {
    public normalizeText(value?: string | null) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
    }

    public normalizeDocument(value?: string | null) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }

    public normalizeCnj(value?: string | null) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }

    public normalizeLifecycleStatus(value?: string | null, fallback = 'ATIVO') {
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

    public normalizeImportedRole(rawType?: string | null) {
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

    public isLawyerRole(roleName?: string | null) {
        const normalized = this.normalizeText(roleName);
        return ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some(term => normalized.includes(term));
    }

    public inferPoleFromRole(roleName?: string | null): 'ACTIVE' | 'PASSIVE' | null {
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

    public isInformativeJudgeName(value?: string | null) {
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

    public inferTimelineOrigin(systemName?: string | null) {
        const normalized = this.normalizeText(systemName);
        if (normalized.includes('EPROC')) return 'TRIBUNAL_EPROC';
        return 'TRIBUNAL_PJE';
    }

    public resolvePdfImportSource(analysis?: Partial<FullProcessPdfAnalysis> | null) {
        const importSource = String(analysis?.importSource || '').trim();
        if (importSource) return importSource;

        const courtSystem = this.normalizeText(analysis?.courtSystem);
        if (courtSystem.includes('EPROC')) return 'EPROC_PROCESS_PDF';
        if (courtSystem.includes('PJE')) return 'PJE_PROCESS_PDF';
        return 'TRIBUNAL_PROCESS_PDF';
    }

    public buildImportedTimelineKey(processCnj: string, movement: any) {
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

    public getExistingTimelineKey(processCnj: string, timeline: any) {
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

    public buildPdfImportedTimelineKey(processCnj: string | null, document: PdfProcessDocument, analysis?: Partial<FullProcessPdfAnalysis> | null) {
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

    public buildPdfTimelineTitle(document: PdfProcessDocument) {
        const type = String(document?.documentType || '').trim();
        if (type) return type;

        const label = String(document?.label || '').trim();
        if (!label) return 'Documento processual';

        return label.length > 120 ? `${label.slice(0, 117)}...` : label;
    }

    public buildPdfTimelineDescription(document: PdfProcessDocument) {
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

    public buildMovementTimelineDescription(movement: any) {
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

    public parseDate(value: any) {
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

    public parseMoneyValue(value: any) {
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

    public cleanOptionalText(value?: string | null) {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
}
