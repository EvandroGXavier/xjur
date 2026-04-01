import { Injectable } from '@nestjs/common';
import { extractTextFromPdfBuffer } from '../common/pdf-parse.util';

type LegacyImportedParty = {
    name: string;
    type: string;
    document?: string;
    email?: string;
    phone?: string;
    oab?: string;
    representedNames?: string[];
    isClient?: boolean;
    isOpposing?: boolean;
};

export type ExtractedProcessData = {
    cnj?: string;
    title?: string;
    court?: string;
    courtSystem?: string;
    vars?: string;
    district?: string;
    status?: string;
    area?: string;
    subject?: string;
    class?: string;
    distributionDate?: string;
    judge?: string;
    value?: number;
    description?: string;
    metadata?: Record<string, any>;
    parts: LegacyImportedParty[];
    textLength: number;
    pageCount: number;
};

export type PdfDeadlineCandidate = {
    sourceDocumentId?: string | null;
    documentType?: string | null;
    excerpt: string;
    deadlineDays?: number | null;
    fatalDate?: string | null;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type PdfProcessDocument = {
    documentId: string;
    referenceType?: 'DOCUMENT_ID' | 'EVENT';
    referenceCode?: string | null;
    eventSequence?: string | null;
    actorName?: string | null;
    signedAt?: string | null;
    label: string;
    documentType?: string | null;
    pageHint?: number | null;
    contentText?: string | null;
    contentPreview?: string | null;
    deadlineCandidates: PdfDeadlineCandidate[];
};

export type FullProcessPdfAnalysis = {
    cnj?: string;
    title?: string;
    court?: string;
    courtSystem?: string;
    vars?: string;
    district?: string;
    status?: string;
    area?: string;
    subject?: string;
    class?: string;
    distributionDate?: string;
    judge?: string;
    value?: number;
    description?: string;
    parts: LegacyImportedParty[];
    pageCount: number;
    textLength: number;
    hasSelectableText: boolean;
    ocrStatus: 'NOT_NEEDED' | 'REQUIRED_NOT_IMPLEMENTED' | 'SUCCESS' | 'FAILED_LOW_QUALITY' | 'ERROR';
    rawTextExcerpt: string;
    documents: PdfProcessDocument[];
    proceduralActs: PdfProcessDocument[];
    deadlineCandidates: PdfDeadlineCandidate[];
    importSource: string;
    timelineReferenceType: 'DOCUMENT_ID' | 'EVENT';
    metadata: Record<string, any>;
};

const DOCUMENT_TYPE_HINTS = [
    'Intimacao',
    'Intimação',
    'Despacho',
    'Decisao',
    'Decisão',
    'Sentenca',
    'Sentença',
    'Certidao',
    'Certidão',
    'Mandado',
    'Peticao',
    'Petição',
    'Manifestacao',
    'Manifestação',
    'Comprovante',
    'Oficio',
    'Ofício',
    'Comunicacao',
    'Comunicação',
    'Formal de Partilha',
    'Termo',
    'Ata',
    'Documento',
];

const EPROC_EVENT_CODE_LABELS: Record<string, string> = {
    INIC1: 'Peticao inicial',
    CONTEST: 'Contestacao',
    CONTESTACAO: 'Contestacao',
    IMPUGNA: 'Impugnacao',
    RECURSO: 'Recurso',
    SENT1: 'Sentenca',
    DESPADEC: 'Despacho/Decisao',
    DECISAO: 'Decisao',
    MANIF: 'Manifestacao',
    CERT: 'Certidao',
};

const CNJ_CAPTURE_PATTERN = String.raw`(\d{7}\s*-\s*\d{2}\s*\.\s*\d{4}\s*\.\s*\d\s*\.\s*\d{2}\s*\.\s*\d{4}|\d{20})`;
const CNJ_REGEX = new RegExp(String.raw`(?<!\d)${CNJ_CAPTURE_PATTERN}(?!\d)`, 'gi');
const CNJ_PREFERRED_PATTERNS = [
    new RegExp(String.raw`N(?:u|\u00fa)mero(?:\s+do)?(?:\s+processo)?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
    new RegExp(String.raw`N[\u00ba\u00b0o]\s*(?:do\s+processo)?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
    new RegExp(String.raw`PROCESSO\s*N[\u00ba\u00b0o]?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
];

@Injectable()
export class ProcessPdfService {
    async extractDataFromPdf(fileBuffer: Buffer): Promise<ExtractedProcessData> {
        const analysis = await this.analyzeFullProcessPdf(fileBuffer);

        return {
            cnj: analysis.cnj,
            title: analysis.title,
            court: analysis.court,
            courtSystem: analysis.courtSystem,
            vars: analysis.vars,
            district: analysis.district,
            status: analysis.status,
            area: analysis.area,
            subject: analysis.subject,
            class: analysis.class,
            distributionDate: analysis.distributionDate,
            judge: analysis.judge,
            value: analysis.value,
            description: analysis.description,
            metadata: analysis.metadata,
            parts: analysis.parts,
            textLength: analysis.textLength,
            pageCount: analysis.pageCount,
        };
    }

    async analyzeFullProcessPdf(fileBuffer: Buffer): Promise<FullProcessPdfAnalysis> {
        const parsed = await this.extractPdfText(fileBuffer);
        const normalizedText = this.normalizeExtractedText(parsed.text);
        const lines = normalizedText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const cnj = this.extractCnj(normalizedText);
        const courtSystem = this.detectCourtSystem(normalizedText);
        const processClass = this.extractProcessClassPreferred(normalizedText);
        const title = processClass && cnj ? `${processClass} - ${cnj}` : processClass || cnj || 'Processo importado via PDF';
        const documents = this.extractDocuments(lines, normalizedText, courtSystem);
        const metadata = this.buildMetadataSummary(normalizedText, parsed.pageCount, parsed.textLength, courtSystem, documents);
        const deadlineCandidates = this.extractDeadlineCandidates(normalizedText, documents);
        const proceduralActs = documents.filter((document) => this.isProceduralAct(document));
        const parts = this.mergeImportedParties(
            this.extractParties(normalizedText),
            this.extractPjePartyLawyerBlock(normalizedText),
        );
        const description = this.buildDescription(normalizedText, documents);
        const importSource = this.resolveImportSource(courtSystem);
        const timelineReferenceType = courtSystem === 'Eproc' ? 'EVENT' : 'DOCUMENT_ID';

        return {
            cnj,
            title,
            court: this.extractCourtEnhanced(normalizedText),
            courtSystem,
            vars: this.extractCourtDivisionPreferred(normalizedText),
            district: this.extractDistrictEnhanced(normalizedText),
            status: this.extractStatus(normalizedText),
            area: this.extractArea(processClass, normalizedText),
            subject: this.extractSubjectPreferred(normalizedText),
            class: processClass,
            distributionDate: this.extractDistributionDateEnhanced(normalizedText),
            judge: this.extractJudgePreferred(normalizedText),
            value: this.extractValue(normalizedText),
            description,
            parts,
            pageCount: parsed.pageCount,
            textLength: parsed.textLength,
            hasSelectableText: parsed.textLength > 100,
            ocrStatus: parsed.ocrStatus,
            rawTextExcerpt: normalizedText.slice(0, 4000),
            documents,
            proceduralActs,
            deadlineCandidates,
            importSource,
            timelineReferenceType,
            metadata,
        };
    }

    private async extractPdfText(fileBuffer: Buffer): Promise<{ text: string; pageCount: number; textLength: number; ocrStatus: FullProcessPdfAnalysis['ocrStatus'] }> {
        let ocrStatus: FullProcessPdfAnalysis['ocrStatus'] = 'NOT_NEEDED';

        try {
            const parsed = await extractTextFromPdfBuffer(fileBuffer);
            let text = parsed.text || '';
            const pageCount = parsed.pageCount || 0;

            if (text.trim().length < 100 && pageCount > 0) {
                try {
                    // Tenta OCR nos primeiros 3 páginas (onde geralmente está a capa/partes)
                    const ocrText = await this.performOcr(fileBuffer, Math.min(pageCount, 3));
                    if (ocrText.trim().length > 50) {
                        text = ocrText;
                        ocrStatus = 'SUCCESS';
                    } else {
                        ocrStatus = 'FAILED_LOW_QUALITY';
                    }
                } catch (ocrErr) {
                    console.error('[ProcessPdfService] OCR Error:', ocrErr);
                    ocrStatus = 'ERROR';
                }
            }

            return {
                text,
                pageCount,
                textLength: text.length,
                ocrStatus,
            };
        } catch (err) {
            console.error('[ProcessPdfService] PDF Parse Error:', err);
            try {
                const ocrText = await this.performOcr(fileBuffer, 3);
                if (ocrText.trim().length > 50) {
                    return {
                        text: ocrText,
                        pageCount: 0,
                        textLength: ocrText.length,
                        ocrStatus: 'SUCCESS',
                    };
                }

                return {
                    text: '',
                    pageCount: 0,
                    textLength: 0,
                    ocrStatus: 'FAILED_LOW_QUALITY',
                };
            } catch (ocrErr) {
                console.error('[ProcessPdfService] OCR Fallback Error:', ocrErr);
            }

            return {
                text: '',
                pageCount: 0,
                textLength: 0,
                ocrStatus: 'ERROR',
            };
        }
    }

    private async performOcr(buffer: Buffer, limitPages: number): Promise<string> {
        const pdfImgConvert = require('pdf-img-convert');
        const { createWorker } = require('tesseract.js');

        // Converter PDF para imagens (array de Buffers)
        const images = await pdfImgConvert.convert(buffer, {
            width: 1200,
            page_numbers: Array.from({ length: limitPages }, (_, i) => i + 1),
        });

        let fullText = '';
        const worker = await createWorker('por'); // Português Brasil

        for (const image of images) {
            const {
                data: { text },
            } = await worker.recognize(image);
            fullText += text + '\n';
        }

        await worker.terminate();
        return fullText;
    }

    private normalizeExtractedText(text: string) {
        return String(text || '')
            .replace(/\r/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private normalizeLooseText(value?: string | null) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s/-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    private toIsoFromBrazilianDate(value?: string | null) {
        const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
        if (!match) return null;

        const [, day, month, year, hour = '00', minute = '00'] = match;
        return `${year}-${month}-${day}T${hour}:${minute}:00`;
    }

    private extractCnj(text: string) {
        const preferredWindow = String(text || '').slice(0, 20000);
        const prioritizedSources = [preferredWindow, text];

        for (const source of prioritizedSources) {
            for (const pattern of CNJ_PREFERRED_PATTERNS) {
                const match = source.match(pattern);
                const normalized = this.normalizeCnjCandidate(match?.[1]);
                if (normalized) {
                    return normalized;
                }
            }
        }

        const frequencies = new Map<string, { count: number; firstIndex: number }>();
        for (const match of String(text || '').matchAll(CNJ_REGEX)) {
            const normalized = this.normalizeCnjCandidate(match[1]);
            if (!normalized) continue;
            const current = frequencies.get(normalized);
            frequencies.set(normalized, {
                count: (current?.count || 0) + 1,
                firstIndex: current?.firstIndex ?? match.index ?? Number.MAX_SAFE_INTEGER,
            });
        }

        if (frequencies.size === 0) {
            return undefined;
        }

        return Array.from(frequencies.entries())
            .sort((left, right) => {
                if (right[1].count !== left[1].count) {
                    return right[1].count - left[1].count;
                }
                return left[1].firstIndex - right[1].firstIndex;
            })[0]?.[0];
    }

    private normalizeCnjCandidate(value?: string | null) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length === 20 ? digits : undefined;
    }

    private detectCourtSystem(text: string) {
        const normalized = this.normalizeLooseText(text);
        if (
            normalized.includes('CAPA PROCESSO') ||
            normalized.includes('PAGINA DE SEPARACAO') ||
            normalized.includes('SEQUENCIA EVENTO') ||
            normalized.includes('EVENTO 1')
        ) {
            return 'Eproc';
        }
        if (normalized.includes('PJE')) return 'PJe';
        if (normalized.includes('EPROC')) return 'Eproc';
        if (normalized.includes('PROJUDI')) return 'Projudi';
        return 'PDF Import';
    }

    private resolveImportSource(courtSystem?: string | null) {
        const normalized = this.normalizeLooseText(courtSystem);
        if (normalized.includes('EPROC')) return 'EPROC_PROCESS_PDF';
        if (normalized.includes('PJE')) return 'PJE_PROCESS_PDF';
        return 'TRIBUNAL_PROCESS_PDF';
    }

    private extractCourt(text: string) {
        const upper = this.normalizeLooseText(text);
        if (upper.includes('TRIBUNAL DE JUSTICA DO ESTADO DE MINAS GERAIS')) return 'TJMG';
        if (upper.includes('TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO')) return 'TJSP';
        if (upper.includes('TRIBUNAL REGIONAL FEDERAL')) {
            const match = upper.match(/TRIBUNAL REGIONAL FEDERAL DA (\d+) REGIAO/);
            return match ? `TRF${match[1]}` : 'TRF';
        }

        const match = text.match(/PODER JUDICI[AÁ]RIO DO ESTADO DE ([^\n]+)/i);
        if (match) return match[1].trim();
        return undefined;
    }

    private extractCourtDivision(text: string) {
        const match =
            text.match(/Comarca de ([^\n/]+)\s*\/\s*([^\n]+)/i) ||
            text.match(/Vara:\s*([^\n]+)/i);
        if (!match) return undefined;

        if (match.length >= 3) {
            return `${match[1].trim()} / ${match[2].trim()}`;
        }

        return match[1].trim();
    }

    private extractDistrict(text: string) {
        const match = text.match(/Comarca de ([^\n/]+)/i);
        return match ? match[1].trim() : undefined;
    }

    private extractProcessClass(text: string) {
        const match =
            text.match(/CLASSE:\s*\[?([^\]\n]+)\]?\s*([^\n]*)/i) ||
            text.match(/Classe Processual\s*:\s*([^\n]+)/i);
        if (!match) return undefined;

        return [match[1], match[2]]
            .filter(Boolean)
            .join(' ')
            .replace(/\(\d+\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractSubject(text: string) {
        const match = text.match(/ASSUNTO:\s*([^\n]+)/i);
        return match ? match[1].trim() : undefined;
    }

    private extractStatus(text: string) {
        const normalized = this.normalizeLooseText(text);
        if (normalized.includes('ARQUIVADO')) return 'ARQUIVADO';
        if (normalized.includes('SUSPENSO')) return 'SUSPENSO';
        return 'ATIVO';
    }

    private extractArea(processClass?: string, text?: string) {
        const normalized = this.normalizeLooseText(`${processClass || ''} ${text || ''}`);
        if (normalized.includes('FAMILIA') || normalized.includes('SUCESS')) return 'Familia';
        if (normalized.includes('TRABALH')) return 'Trabalhista';
        if (normalized.includes('CRIM')) return 'Criminal';
        if (normalized.includes('TRIBUT')) return 'Tributario';
        if (normalized.includes('PREVID')) return 'Previdenciario';
        if (normalized.includes('ADMINISTRAT')) return 'Administrativo';
        return 'Civel';
    }

    private extractDistributionDate(text: string) {
        const match =
            text.match(/ajuizado em\s+(\d{2}\/\d{2}\/\d{4})/i) ||
            text.match(/distribu[ií]do em\s+(\d{2}\/\d{2}\/\d{4})/i);

        return match?.[1];
    }

    private extractJudge(text: string) {
        const match =
            text.match(/Magistrado(?:\(a\))?:\s*([^\n]+)/i) ||
            text.match(/Ju[ií]z(?:a)?(?: de Direito)?:\s*([^\n]+)/i) ||
            text.match(/\n([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{8,})\n(?:Ju[ií]z|Ju[ií]za|Assinado eletronicamente)/i);

        return match?.[1]?.trim();
    }

    private extractValue(text: string) {
        const match =
            text.match(/valor da causa[:\s]*R\$\s*([\d\.\,]+)/i) ||
            text.match(/R\$\s*([\d\.\,]{4,})/i);
        if (!match) return undefined;

        const normalized = match[1].replace(/\./g, '').replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private extractParties(text: string): LegacyImportedParty[] {
        const lines = text.split(/\r?\n/);
        const parties = new Map<string, LegacyImportedParty>();

        const pushParty = (
            name: string,
            type: string,
            document?: string,
            options?: {
                representedNames?: string[];
                isClient?: boolean;
                isOpposing?: boolean;
            },
        ) => {
            const cleanName = String(name || '').replace(/\s+/g, ' ').trim();
            if (!cleanName || cleanName.length < 3) return;

            const normalizedDocument = String(document || '').replace(/\D/g, '');
            const key = `${this.normalizeLooseText(cleanName)}::${type}::${normalizedDocument}`;
            const existing = parties.get(key);
            const representedNames = new Map<string, string>();

            for (const candidate of [...(existing?.representedNames || []), ...(options?.representedNames || [])]) {
                const normalizedCandidate = this.normalizeLooseText(candidate);
                if (normalizedCandidate && !representedNames.has(normalizedCandidate)) {
                    representedNames.set(normalizedCandidate, String(candidate).trim());
                }
            }

            parties.set(key, {
                ...(existing || {}),
                name: cleanName,
                type,
                document: existing?.document || document,
                representedNames: Array.from(representedNames.values()),
                isClient: options?.isClient ?? existing?.isClient,
                isOpposing: options?.isOpposing ?? existing?.isOpposing,
            });
        };

        for (const line of lines) {
            const partyMatch = line.match(/^(AUTOR(?:A)?|REQUERENTE|INVENTARIANTE|REQUERIDO(?:A)?|R[EÉ]U|EXECUTADO(?:A)?|EXEQUENTE|APELANTE|APELADO)\s*[:\-]\s*(.+)$/i);
            if (partyMatch) {
                const type = this.normalizePartyType(partyMatch[1]);
                const content = partyMatch[2].trim();
                const documentMatch = content.match(/\b(CPF|CNPJ)\s*[:\-]?\s*([\d\.\-\/]+)/i);
                const name = content.replace(/\b(CPF|CNPJ)\s*[:\-]?\s*[\d\.\-\/]+/gi, '').trim();
                pushParty(name, type, documentMatch?.[2]);
                continue;
            }

            const inlineMatch = line.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{6,})\s+CPF[:\s]+([\d\.\-]+)/i);
            if (inlineMatch) {
                pushParty(inlineMatch[1], 'PARTE', inlineMatch[2]);
            }
        }

        const eprocBlock = text.match(/Partes e Representantes([\s\S]*?)Informa[cç][oõ]es Adicionais/i)?.[1];
        if (eprocBlock) {
            const eprocLines = eprocBlock
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            let pendingRoles: string[] = [];
            let roleIndex = 0;

            for (const line of eprocLines) {
                if (/^Procurador\(es\):$/i.test(line)) {
                    pendingRoles = [];
                    roleIndex = 0;
                    continue;
                }

                const roleTokens = Array.from(
                    line.matchAll(/\b(AUTOR(?:A)?|R[EÉ]U|REQUERENTE|REQUERIDO(?:A)?|EXECUTADO(?:A)?|EXEQUENTE|PERITO|TERCEIRO)\b/gi),
                ).map((match) => this.normalizePartyType(match[1]));
                if (roleTokens.length > 0 && !line.match(/\(/)) {
                    pendingRoles = roleTokens;
                    roleIndex = 0;
                    continue;
                }

                if (!/\((?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\)/.test(line)) {
                    continue;
                }

                const documentMatch = line.match(/\(([\d\.\-\/]+)\)/);
                const name = line.replace(/\([\d\.\-\/]+\)\s*-\s*Pessoa\s+[^\n]+/i, '').trim();
                const role = pendingRoles[roleIndex] || 'PARTE';
                pushParty(name, role, documentMatch?.[1]);
                if (pendingRoles.length > 1 && roleIndex < pendingRoles.length - 1) {
                    roleIndex += 1;
                }
            }
        }

        return Array.from(parties.values())
            .filter((party) => {
                const normalizedName = this.normalizeLooseText(party.name);
                if (!normalizedName) return false;
                if (normalizedName.endsWith(' E')) return false;
                if (normalizedName.includes('POR SEU')) return false;
                return true;
            })
            .slice(0, 30);
    }

    private mergeImportedParties(...collections: LegacyImportedParty[][]) {
        const merged = new Map<string, LegacyImportedParty>();

        for (const collection of collections) {
            for (const party of collection || []) {
                const name = String(party?.name || '').replace(/\s+/g, ' ').trim();
                if (!name) continue;

                const normalizedDocument = String(party?.document || '').replace(/\D/g, '');
                const normalizedType = this.normalizePartyType(String(party?.type || 'PARTE'));
                const key = `${this.normalizeLooseText(name)}::${normalizedType}::${normalizedDocument}`;
                const existing = merged.get(key);
                const representedNames = new Map<string, string>();

                for (const candidate of [...(existing?.representedNames || []), ...(party?.representedNames || [])]) {
                    const normalizedCandidate = this.normalizeLooseText(candidate);
                    if (normalizedCandidate && !representedNames.has(normalizedCandidate)) {
                        representedNames.set(normalizedCandidate, String(candidate).trim());
                    }
                }

                merged.set(key, {
                    ...(existing || {}),
                    ...party,
                    name,
                    type: normalizedType,
                    document: existing?.document || party?.document,
                    representedNames: Array.from(representedNames.values()),
                    isClient: party?.isClient ?? existing?.isClient,
                    isOpposing: party?.isOpposing ?? existing?.isOpposing,
                });
            }
        }

        return Array.from(merged.values());
    }

    private extractPjePartyLawyerBlock(text: string): LegacyImportedParty[] {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const headerIndex = lines.findIndex((line) => /Partes\s+Advogados/i.test(line));
        if (headerIndex < 0) {
            return [];
        }

        const sectionLines = lines.slice(headerIndex + 1, headerIndex + 80);
        const parties = new Map<string, LegacyImportedParty>();
        let pendingPrincipalNames: string[] = [];
        let readingLawyerGroup = false;

        const pushParty = (party: LegacyImportedParty) => {
            const normalizedName = this.normalizeLooseText(party.name);
            const normalizedDocument = String(party.document || '').replace(/\D/g, '');
            const normalizedType = this.normalizePartyType(party.type);
            const key = `${normalizedName}::${normalizedType}::${normalizedDocument}`;
            const existing = parties.get(key);
            const representedNames = new Map<string, string>();

            for (const candidate of [...(existing?.representedNames || []), ...(party.representedNames || [])]) {
                const normalizedCandidate = this.normalizeLooseText(candidate);
                if (normalizedCandidate && !representedNames.has(normalizedCandidate)) {
                    representedNames.set(normalizedCandidate, String(candidate).trim());
                }
            }

            parties.set(key, {
                ...(existing || {}),
                ...party,
                type: normalizedType,
                representedNames: Array.from(representedNames.values()),
            });
        };

        for (const line of sectionLines) {
            if (/^(Documentos|Id\.\s*Data|Num\.)/i.test(line)) {
                break;
            }

            const entryMatch = line.match(/^(.*?)\s+\(([^)]+)\)$/);
            if (!entryMatch) {
                continue;
            }

            const name = String(entryMatch[1] || '').replace(/\s+/g, ' ').trim();
            const type = this.normalizePartyType(String(entryMatch[2] || '').trim());
            if (!name || !type) {
                continue;
            }

            if (this.isLawyerType(type)) {
                pushParty({
                    name,
                    type,
                    representedNames: pendingPrincipalNames,
                });
                readingLawyerGroup = true;
                continue;
            }

            pushParty({ name, type });

            if (readingLawyerGroup) {
                pendingPrincipalNames = [name];
                readingLawyerGroup = false;
                continue;
            }

            pendingPrincipalNames = [...pendingPrincipalNames, name];
        }

        return Array.from(parties.values());
    }

    private isLawyerType(type: string) {
        const normalized = this.normalizeLooseText(type);
        return ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some((term) => normalized.includes(term));
    }

    private normalizePartyType(type: string) {
        const normalized = this.normalizeLooseText(type);
        if (normalized.includes('AUTOR')) return 'AUTOR';
        if (normalized.includes('REQUERENTE')) return 'REQUERENTE';
        if (normalized.includes('INVENTARIANTE')) return 'INVENTARIANTE';
        if (normalized.includes('EXEQUENTE')) return 'EXEQUENTE';
        if (normalized.includes('REU')) return 'REU';
        if (normalized.includes('REQUERIDO')) return 'REQUERIDO';
        if (normalized.includes('EXECUTADO')) return 'EXECUTADO';
        if (normalized.includes('APELANTE')) return 'APELANTE';
        if (normalized.includes('APELADO')) return 'APELADO';
        if (['ADVOGADO', 'ADVOGADA', 'PROCURADOR', 'PROCURADORA', 'DEFENSOR'].some((term) => normalized.includes(term))) {
            return normalized.includes('CONTRAR') ? 'ADVOGADO CONTRARIO' : 'ADVOGADO';
        }
        return 'PARTE';
    }

    private extractDocuments(lines: string[], fullText: string, courtSystem?: string | null): PdfProcessDocument[] {
        if (courtSystem === 'Eproc') {
            return this.extractEprocDocuments(fullText);
        }

        const documents = new Map<string, PdfProcessDocument>();

        for (const line of lines) {
            const match = line.match(/^(\d{10,11})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(.+)$/);
            if (!match) continue;

            const [, documentId, signedAtRaw, rawLabel] = match;
            const parsedLabel = this.parseDocumentLabel(rawLabel);
            const signedAt = this.toIsoFromBrazilianDate(signedAtRaw);

            if (!documents.has(documentId)) {
                documents.set(documentId, {
                    documentId,
                    referenceType: 'DOCUMENT_ID',
                    signedAt,
                    label: parsedLabel.label,
                    documentType: parsedLabel.documentType,
                    contentText: null,
                    contentPreview: null,
                    deadlineCandidates: [],
                });
            }
        }

        const contentByDocument = this.extractDocumentContents(fullText);
        for (const [documentId, contentInfo] of contentByDocument.entries()) {
            const existing = documents.get(documentId) || {
                documentId,
                referenceType: 'DOCUMENT_ID',
                label: contentInfo.inferredLabel || `Documento ${documentId}`,
                documentType: contentInfo.inferredType || null,
                signedAt: null,
                deadlineCandidates: [],
            };

            const contentText = contentInfo.contentText || null;
            const deadlineCandidates = this.extractDeadlineCandidates(contentText || '', [
                {
                    ...existing,
                    contentText,
                    contentPreview: contentText ? contentText.slice(0, 320) : null,
                    deadlineCandidates: [],
                },
            ]).filter((item) => item.sourceDocumentId === documentId);

            documents.set(documentId, {
                ...existing,
                pageHint: contentInfo.pageHint,
                contentText,
                contentPreview: contentText ? contentText.slice(0, 320) : null,
                deadlineCandidates,
            });
        }

        return Array.from(documents.values())
            .sort((left, right) => {
                const leftTime = left.signedAt ? new Date(left.signedAt).getTime() : 0;
                const rightTime = right.signedAt ? new Date(right.signedAt).getTime() : 0;
                return leftTime - rightTime;
            })
            .slice(0, 500);
    }

    private extractEprocDocuments(fullText: string): PdfProcessDocument[] {
        const pages = this.extractPages(fullText);
        const separatorMetadata = new Map<string, { label?: string | null; signedAt?: string | null; actorName?: string | null; eventSequence?: string | null }>();
        const documents = new Map<string, PdfProcessDocument>();

        for (const page of pages) {
            if (/P[ÁA]GINA DE SEPARA[CÇ][AÃ]O/i.test(page.content)) {
                const metadata = this.extractEprocSeparatorMetadata(page.content);
                if (metadata?.eventNumber) {
                    separatorMetadata.set(metadata.eventNumber, {
                        label: metadata.label,
                        signedAt: metadata.signedAt,
                        actorName: metadata.actorName,
                        eventSequence: metadata.eventSequence,
                    });
                }
                continue;
            }

            const footer = this.extractEprocFooter(page.content);
            if (!footer?.eventNumber) {
                continue;
            }

            const separator = separatorMetadata.get(footer.eventNumber);
            const baseDocument = documents.get(footer.eventNumber) || {
                documentId: footer.eventNumber,
                referenceType: 'EVENT' as const,
                referenceCode: footer.referenceCode || null,
                eventSequence: separator?.eventSequence || null,
                actorName: separator?.actorName || null,
                signedAt: separator?.signedAt || null,
                label: this.buildEprocEventLabel(footer.eventNumber, footer.referenceCode, separator?.label),
                documentType: this.inferEprocDocumentType(footer.referenceCode, separator?.label),
                pageHint: page.pageNumber,
                contentText: null,
                contentPreview: null,
                deadlineCandidates: [],
            };

            const cleanContent = this.cleanEprocPageContent(page.content);
            const mergedContent = baseDocument.contentText
                ? `${baseDocument.contentText}\n\n${cleanContent}`.trim()
                : cleanContent;

            documents.set(footer.eventNumber, {
                ...baseDocument,
                pageHint: Math.min(baseDocument.pageHint || page.pageNumber, page.pageNumber),
                referenceCode: baseDocument.referenceCode || footer.referenceCode || null,
                label:
                    baseDocument.label ||
                    this.buildEprocEventLabel(footer.eventNumber, footer.referenceCode, separator?.label),
                documentType:
                    baseDocument.documentType ||
                    this.inferDocumentTypeFromContent(cleanContent) ||
                    this.inferEprocDocumentType(footer.referenceCode, separator?.label),
                contentText: mergedContent || null,
                contentPreview: mergedContent ? mergedContent.slice(0, 320) : null,
            });
        }

        for (const [eventNumber, document] of documents.entries()) {
            const deadlineCandidates = this.extractDeadlineCandidates(document.contentText || '', [
                {
                    ...document,
                    deadlineCandidates: [],
                },
            ]).filter((item) => item.sourceDocumentId === eventNumber);

            documents.set(eventNumber, {
                ...document,
                deadlineCandidates,
            });
        }

        return Array.from(documents.values())
            .sort((left, right) => {
                const leftEvent = Number(left.documentId || 0) || 0;
                const rightEvent = Number(right.documentId || 0) || 0;
                return leftEvent - rightEvent;
            })
            .slice(0, 500);
    }

    private extractPages(fullText: string) {
        const matches = Array.from(fullText.matchAll(/--\s*(\d+)\s+of\s+(\d+)\s*--/gi));
        const pages: Array<{ pageNumber: number; content: string }> = [];

        for (let index = 0; index < matches.length; index += 1) {
            const current = matches[index];
            const next = matches[index + 1];
            const pageNumber = Number(current[1] || 0) || index + 1;
            const start = (current.index ?? 0) + current[0].length;
            const end = next?.index ?? fullText.length;
            const content = fullText.slice(start, end).trim();

            if (content) {
                pages.push({ pageNumber, content });
            }
        }

        return pages;
    }

    private extractEprocSeparatorMetadata(pageContent: string) {
        const lines = pageContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const eventNumber = lines.find((line) => /^Evento\s+\d+$/i.test(line))?.match(/\d+/)?.[0];
        const lastLabelIndex = lines.reduce((acc, line, index) => {
            if (/^(Evento:|Data:|Usu[áa]rio:|Processo:|Sequ[êe]ncia Evento:)$/i.test(line)) {
                return index;
            }
            return acc;
        }, -1);

        const values = lastLabelIndex >= 0 ? lines.slice(lastLabelIndex + 1) : [];
        return {
            eventNumber,
            label: values[0] || null,
            signedAt: this.toIsoFromBrazilianDate(values[1] || null),
            actorName: values[2] || null,
            eventSequence: values[4] || null,
        };
    }

    private extractEprocFooter(pageContent: string) {
        const matches = Array.from(
            pageContent.matchAll(
                /Processo\s+\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\/[A-Z]{2},\s*Evento\s+(\d+),\s*([A-Z0-9_]+),\s*P[aá]gina\s+(\d+)/gi,
            ),
        );
        const match = matches[matches.length - 1];
        if (!match) return null;

        return {
            eventNumber: String(match[1] || '').trim(),
            referenceCode: String(match[2] || '').trim() || null,
            pageNumber: Number(match[3] || 0) || null,
        };
    }

    private buildEprocEventLabel(eventNumber: string, referenceCode?: string | null, separatorLabel?: string | null) {
        const referenceLabel = this.expandEprocReferenceCode(referenceCode);
        const rawReferenceCode = String(referenceCode || '').trim();
        const cleanSeparatorLabel = String(separatorLabel || '')
            .replace(/_+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (referenceLabel && cleanSeparatorLabel) {
            return `Evento ${eventNumber} - ${referenceLabel} (${cleanSeparatorLabel})`;
        }
        if (referenceLabel) {
            return `Evento ${eventNumber} - ${referenceLabel}`;
        }
        if (rawReferenceCode && cleanSeparatorLabel) {
            return `Evento ${eventNumber} - ${cleanSeparatorLabel} (${rawReferenceCode})`;
        }
        if (rawReferenceCode) {
            return `Evento ${eventNumber} - ${rawReferenceCode}`;
        }
        if (cleanSeparatorLabel) {
            return `Evento ${eventNumber} - ${cleanSeparatorLabel}`;
        }
        return `Evento ${eventNumber}`;
    }

    private expandEprocReferenceCode(referenceCode?: string | null) {
        const normalized = this.normalizeLooseText(referenceCode);
        if (!normalized) return null;
        return EPROC_EVENT_CODE_LABELS[normalized] || null;
    }

    private inferEprocDocumentType(referenceCode?: string | null, separatorLabel?: string | null) {
        const fromCode = this.expandEprocReferenceCode(referenceCode);
        if (fromCode) return fromCode;

        const normalized = this.normalizeLooseText(separatorLabel);
        if (normalized.includes('CERTIDAO')) return 'Certidao';
        if (normalized.includes('DISTRIBUID')) return 'Distribuicao';
        if (normalized.includes('CITACAO')) return 'Citacao';
        if (normalized.includes('INTIM')) return 'Intimacao';
        if (normalized.includes('DECISAO')) return 'Decisao';
        if (normalized.includes('DESPACH')) return 'Despacho';
        if (normalized.includes('CONCLUSAO')) return 'Conclusao';
        if (normalized.includes('JUNTADA')) return 'Juntada';
        return null;
    }

    private cleanEprocPageContent(pageContent: string) {
        return String(pageContent || '')
            .replace(/Processo\s+\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\/[A-Z]{2},\s*Evento\s+\d+,\s*[A-Z0-9_]+,\s*P[aá]gina\s+\d+/gi, '')
            .replace(/\b\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\s+[^\n]*Editor de Rich Text[^\n]*/gi, '')
            .replace(/https?:\/\/\S+/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private parseDocumentLabel(rawLabel: string) {
        const cleanLabel = String(rawLabel || '').replace(/\s+/g, ' ').trim();
        const normalized = this.normalizeLooseText(cleanLabel);
        const documentType =
            DOCUMENT_TYPE_HINTS.find((hint) => normalized.endsWith(this.normalizeLooseText(hint))) ||
            DOCUMENT_TYPE_HINTS.find((hint) => normalized.includes(this.normalizeLooseText(hint))) ||
            null;

        return {
            label: cleanLabel,
            documentType,
        };
    }

    private extractDocumentContents(fullText: string) {
        const matches = Array.from(fullText.matchAll(/Num\.\s*(\d{10,11})\s*-\s*P[aá]g\.\s*(\d+)/gi));
        const contentByDocument = new Map<string, { pageHint?: number | null; contentText: string; inferredLabel?: string | null; inferredType?: string | null }>();

        for (let index = 0; index < matches.length; index += 1) {
            const current = matches[index];
            const next = matches[index + 1];
            const documentId = current[1];
            const pageHint = Number(current[2] || 0) || null;
            const start = current.index ?? 0;
            const end = next?.index ?? fullText.length;
            const block = fullText.slice(start, end);
            const contentText = this.cleanDocumentBlock(block, documentId);

            if (!contentText) continue;

            const existing = contentByDocument.get(documentId);
            const mergedContent = existing?.contentText
                ? `${existing.contentText}\n\n${contentText}`.trim()
                : contentText;

            contentByDocument.set(documentId, {
                pageHint: existing?.pageHint || pageHint,
                contentText: mergedContent,
                inferredLabel: existing?.inferredLabel || this.inferDocumentLabelFromContent(contentText),
                inferredType: existing?.inferredType || this.inferDocumentTypeFromContent(contentText),
            });
        }

        return contentByDocument;
    }

    private cleanDocumentBlock(block: string, documentId: string) {
        return String(block || '')
            .replace(new RegExp(`Num\\.\\s*${documentId}\\s*-\\s*P[aá]g\\.\\s*\\d+`, 'gi'), '')
            .replace(/Assinado eletronicamente por:[\s\S]*?(?=\n{2,}|https?:\/\/|$)/gi, '')
            .replace(/https?:\/\/\S+/gi, '')
            .replace(/Poder Judici[aá]rio do Estado de [^\n]+/gi, '')
            .replace(/Justi[cç]a de [^\n]+/gi, '')
            .replace(/Comarca de [^\n]+/gi, '')
            .replace(/Rua:[^\n]+/gi, '')
            .replace(/PROCESSO N[oº].*?(?=\n)/gi, '')
            .replace(/CLASSE:.*?(?=\n)/gi, '')
            .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private inferDocumentLabelFromContent(contentText: string) {
        const firstLine = String(contentText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean);
        return firstLine ? firstLine.slice(0, 140) : null;
    }

    private inferDocumentTypeFromContent(contentText: string) {
        const normalized = this.normalizeLooseText(contentText);
        if (normalized.includes('INTIMA')) return 'Intimacao';
        if (normalized.includes('DESPACH')) return 'Despacho';
        if (normalized.includes('DECISAO')) return 'Decisao';
        if (normalized.includes('CERTIDAO')) return 'Certidao';
        if (normalized.includes('MANDADO')) return 'Mandado';
        if (normalized.includes('FORMAL DE PARTILHA')) return 'Formal de Partilha';
        if (normalized.includes('CONTESTA')) return 'Contestacao';
        if (normalized.includes('PETICAO INICIAL') || normalized.includes('PROPOR A PRESENTE')) return 'Peticao inicial';
        if (normalized.includes('MANIFESTA')) return 'Manifestacao';
        return null;
    }

    private extractDeadlineCandidates(text: string, documents: PdfProcessDocument[]) {
        const candidates: PdfDeadlineCandidate[] = [];
        const normalizedText = String(text || '');

        const collectCandidates = (sourceText: string, sourceDocumentId?: string | null, documentType?: string | null) => {
            const daysRegex = /prazo(?:\s+de)?\s+(\d{1,3})\s*\(([^)]*)\)?\s*dias?/gi;
            for (const match of sourceText.matchAll(daysRegex)) {
                candidates.push({
                    sourceDocumentId: sourceDocumentId || null,
                    documentType: documentType || null,
                    excerpt: this.safeExcerpt(sourceText, match.index ?? 0),
                    deadlineDays: Number(match[1]),
                    fatalDate: this.extractExplicitFatalDateNear(sourceText, match.index ?? 0),
                    confidence: this.extractExplicitFatalDateNear(sourceText, match.index ?? 0) ? 'HIGH' : 'MEDIUM',
                });
            }

            const explicitRegex = /(prazo|ate|até)[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})(?:\s*(?:as|às)?\s*(\d{2}:\d{2}))?/gi;
            for (const match of sourceText.matchAll(explicitRegex)) {
                const fatalDate = this.toIsoFromBrazilianDate(
                    `${match[2]}${match[3] ? ` ${match[3]}` : ''}`,
                );
                if (!fatalDate) continue;

                candidates.push({
                    sourceDocumentId: sourceDocumentId || null,
                    documentType: documentType || null,
                    excerpt: this.safeExcerpt(sourceText, match.index ?? 0),
                    deadlineDays: null,
                    fatalDate,
                    confidence: 'HIGH',
                });
            }
        };

        collectCandidates(normalizedText, null, null);
        for (const document of documents) {
            if (!document.contentText) continue;
            collectCandidates(document.contentText, document.documentId, document.documentType || null);
        }

        return candidates.slice(0, 200);
    }

    private extractExplicitFatalDateNear(text: string, startIndex: number) {
        const window = text.slice(startIndex, startIndex + 200);
        const match = window.match(/(\d{2}\/\d{2}\/\d{4})(?:\s*(?:as|às)?\s*(\d{2}:\d{2}))?/i);
        if (!match) return null;
        return this.toIsoFromBrazilianDate(`${match[1]}${match[2] ? ` ${match[2]}` : ''}`);
    }

    private safeExcerpt(text: string, index: number) {
        const start = Math.max(index - 40, 0);
        const end = Math.min(index + 180, text.length);
        return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }

    private isProceduralAct(document: PdfProcessDocument) {
        const normalized = this.normalizeLooseText(`${document.documentType || ''} ${document.label}`);
        return ['INTIM', 'DESPACH', 'DECISAO', 'SENTENCA', 'CERTIDAO', 'MANDADO', 'FORMAL DE PARTILHA', 'COMUNICACAO'].some((token) =>
            normalized.includes(token),
        );
    }

    private buildDescription(text: string, documents: PdfProcessDocument[]) {
        if (documents.length > 0) {
            const firstWithContent = documents.find((document) => document.contentText);
            if (firstWithContent?.contentText) {
                return firstWithContent.contentText.slice(0, 1200);
            }
        }

        return text.slice(0, 1200);
    }

    private extractCourtEnhanced(text: string) {
        return this.extractCourt(text) || (/\b\d{7}-\d{2}\.\d{4}\.8\.13\.\d{4}\b/.test(text) ? 'TJMG' : undefined);
    }

    private extractCourtDivisionEnhanced(text: string) {
        return (
            this.extractCourtDivision(text) ||
            text.match(/Orgao Julgador:\s*([^\n]+)/i)?.[1]?.trim() ||
            text.match(/Orgao Julgador:\s*\n\s*([^\n]+)/i)?.[1]?.trim() ||
            text.match(/Ju[ií]zo da ([^\n]+)/i)?.[1]?.trim()
        );
    }

    private extractDistrictEnhanced(text: string) {
        return this.extractDistrict(text) || text.match(/Ju[ií]zo da [^\n]+ da Comarca de ([^\n]+)/i)?.[1]?.trim();
    }

    private extractProcessClassEnhanced(text: string) {
        return this.extractProcessClass(text) || text.match(/Classe da a[cç][aã]o:\s*([^\n]+)/i)?.[1]?.trim();
    }

    private extractSubjectEnhanced(text: string) {
        return (
            this.extractSubject(text) ||
            text.match(/Assuntos[\s\S]{0,160}?\n\d+\s+([^\n\t]+)\t/i)?.[1]?.trim()
        );
    }

    private extractDistributionDateEnhanced(text: string) {
        return (
            this.extractDistributionDate(text) ||
            text.match(/Data de autua[cç][aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
        );
    }

    private extractJudgeEnhanced(text: string) {
        return this.extractJudge(text) || text.match(/Juiz\(a\):\s*([^\n]+)/i)?.[1]?.trim();
    }

    private extractCourtDivisionPreferred(text: string) {
        return (
            text.match(/Orgao Julgador:\s*([^\n]+)/i)?.[1]?.trim() ||
            text.match(/Orgao Julgador:\s*\n\s*([^\n]+)/i)?.[1]?.trim() ||
            this.extractCourtDivisionEnhanced(text)
        );
    }

    private extractProcessClassPreferred(text: string) {
        return text.match(/Classe da a[cç][aã]o:\s*([^\n]+)/i)?.[1]?.trim() || this.extractProcessClassEnhanced(text);
    }

    private extractSubjectPreferred(text: string) {
        return (
            text.match(/Assuntos[\s\S]{0,160}?\n\d+\s+([^\n\t]+)\t/i)?.[1]?.trim() ||
            this.extractSubjectEnhanced(text)
        );
    }

    private extractJudgePreferred(text: string) {
        return text.match(/Juiz\(a\):\s*([^\n]+)/i)?.[1]?.trim() || this.extractJudgeEnhanced(text);
    }

    private buildMetadataSummary(
        text: string,
        pageCount: number,
        textLength: number,
        courtSystem?: string | null,
        documents: PdfProcessDocument[] = [],
    ) {
        const documentIds =
            documents.length > 0
                ? documents.map((item) => item.documentId).filter(Boolean).slice(0, 200)
                : Array.from(new Set((text.match(/\b\d{10,11}\b/g) || []).filter((item) => item.length >= 10))).slice(0, 200);
        return {
            importSource: this.resolveImportSource(courtSystem),
            courtSystem: courtSystem || null,
            timelineReferenceType: courtSystem === 'Eproc' ? 'EVENT' : 'DOCUMENT_ID',
            pageCount,
            textLength,
            documentIds,
            containsSelectableText: textLength > 0,
        };
    }
}
