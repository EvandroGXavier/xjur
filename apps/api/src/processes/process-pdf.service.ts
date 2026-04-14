import { Injectable } from '@nestjs/common';
import { extractTextFromPdfBuffer, type PdfTextParseOptions } from '../common/pdf-parse.util';

type LegacyImportedParty = {
    name: string;
    type: string;
    document?: string;
    rg?: string;
    birthDate?: string;
    motherName?: string;
    fatherName?: string;
    profession?: string;
    nationality?: string;
    civilStatus?: string;
    address?: string;
    qualificationText?: string;
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

const DOCUMENT_TYPE_DEFINITIONS = [
    { type: 'Peticao inicial', aliases: ['Petição Inicial', 'PETIÇÃO INICIAL'] },
    { type: 'Peticao', aliases: ['Petição', 'PETIÇÃO'] },
    { type: 'Manifestacao', aliases: ['Manifestação', 'MANIFESTAÇÃO'] },
    { type: 'Despacho', aliases: ['Despacho'] },
    { type: 'Decisao', aliases: ['Decisão', 'DECISÃO', 'Outras Decisões', 'DECISAO DE SANEAMENTO E DE ORGANIZACAO DO PROCESSO'] },
    { type: 'Sentenca', aliases: ['Sentença', 'SENTENÇA'] },
    { type: 'Certidao', aliases: ['Certidão', 'CERTIDÃO', 'Certidão de Triagem', 'Certidão de Oficial de Justiça', 'Juntada de Certidão', 'Expedição de Certidão'] },
    { type: 'Mandado', aliases: ['Mandado', 'Mandado Digitalizado', 'Juntada de Mandado'] },
    { type: 'Citacao', aliases: ['Citação', 'CITACAO'] },
    { type: 'Intimacao', aliases: ['Intimação', 'INTIMAÇÃO'] },
    { type: 'Guia', aliases: ['Guia', 'Guias de Recolhimento/ Deposito/ Custas'] },
    { type: 'Comprovante', aliases: ['Comprovante', 'Comprovante de Pagamento', 'Comprovante de pagamento', 'Comprovante de pagamento de custas'] },
    { type: 'Procuracao', aliases: ['Procuração', 'PROCURAÇÃO'] },
    { type: 'Documento de Comprovacao', aliases: ['Documento de Comprovação'] },
    { type: 'Documento de Identificacao', aliases: ['Documento de Identificação'] },
    { type: 'Comprovante de Endereco', aliases: ['Comprovante de Endereço'] },
    { type: 'Declaracao de Hipossuficiencia', aliases: ['Declaração de Hipossuficiência'] },
    { type: 'Comprovante de Rendimento', aliases: ['Comprovante de Rendimento', 'Comprovante de Rendimento (Outros)'] },
    { type: 'Aviso de Recebimento', aliases: ['Aviso de Recebimento'] },
    { type: 'Substabelecimento', aliases: ['Substabelecimento'] },
    { type: 'Impugnacao', aliases: ['Impugnação ao Cumprimento de Sentença', 'EXCEÇÃO DE PRÉ-EXECUTIVIDADE'] },
    { type: 'Ato ordinatorio', aliases: ['Ato Ordinatório Praticado Documento Encaminhado a Disponibilizacao no Diar'] },
    { type: 'Outros Documentos', aliases: ['Outros Documentos'] },
    { type: 'Documento', aliases: ['Documento', 'Formal de Partilha', 'Termo', 'Ata', 'Ofício', 'Comunicacao'] },
];

const EPROC_EVENT_CODE_LABELS: Record<string, string> = {
    INIC1: 'Peticao inicial',
    PET1: 'Peticao',
    MANIF1: 'Manifestacao',
    CONTEST: 'Contestacao',
    CONTESTACAO: 'Contestacao',
    CONTRAZ1: 'Contrarrazoes',
    IMPUGNA: 'Impugnacao',
    RECURSO: 'Recurso',
    SENT1: 'Sentenca',
    DESPADEC: 'Despacho/Decisao',
    DECISAO: 'Decisao',
    MANIF: 'Manifestacao',
    CERT: 'Certidao',
    CERTIDAO1: 'Certidao',
    CERTDIST1: 'Certidao',
    CERTRIAG1: 'Certidao',
    ATOORD1: 'Ato ordinatorio',
    OUTDOC1: 'Outros Documentos',
};

const CNJ_CAPTURE_PATTERN = String.raw`(\d{7}\s*-\s*\d{2}\s*\.\s*\d{4}\s*\.\s*\d\s*\.\s*\d{2}\s*\.\s*\d{4}|\d{20})`;
const CNJ_REGEX = new RegExp(String.raw`(?<!\d)${CNJ_CAPTURE_PATTERN}(?!\d)`, 'gi');
const CNJ_PREFERRED_PATTERNS = [
    new RegExp(String.raw`N(?:u|\u00fa)mero(?:\s+do)?(?:\s+processo)?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
    new RegExp(String.raw`N[\u00ba\u00b0o]\s*(?:do\s+processo)?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
    new RegExp(String.raw`PROCESSO\s*N[\u00ba\u00b0o]?\s*[:\-]?\s*${CNJ_CAPTURE_PATTERN}`, 'i'),
];
const PDF_PREVIEW_FIRST_PAGES = 12;
const PDF_PREVIEW_PJE_PAGE_BUDGET = 16;
const PDF_PREVIEW_OCR_PAGE_BUDGET = 5;
const CIVIL_STATUS_TERMS = [
    'SOLTEIRO',
    'SOLTEIRA',
    'CASADO',
    'CASADA',
    'DIVORCIADO',
    'DIVORCIADA',
    'VIUVO',
    'VIUVA',
    'SEPARADO',
    'SEPARADA',
    'UNIAO ESTAVEL',
    'CONVIVENTE',
];

@Injectable()
export class ProcessPdfService {
    async extractDataFromPdf(fileBuffer: Buffer): Promise<ExtractedProcessData> {
        const analysis = await this.analyzePreviewProcessPdf(fileBuffer);

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

    async quickExtractCnj(fileBuffer: Buffer): Promise<string | undefined> {
        const coverParsed = await this.extractPdfText(fileBuffer, { first: 1 });
        return this.extractCnj(this.normalizeExtractedText(coverParsed.text));
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
        const qualificationSources = this.collectPartyQualificationSources(normalizedText, documents, courtSystem);
        const metadata = {
            ...this.buildMetadataSummary(normalizedText, parsed.pageCount, parsed.textLength, courtSystem, documents),
            analysisMode: 'FULL',
            cnjConsulted: false,
            qualificationSourceCount: qualificationSources.length,
        };
        const deadlineCandidates = this.extractDeadlineCandidatesSafe(normalizedText, documents);
        const proceduralActs = documents.filter((document) => this.isProceduralAct(document));
        const parts = this.enrichPartiesWithQualificationSources(
            this.extractPartiesPreferred(normalizedText, courtSystem),
            qualificationSources,
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

    private async analyzePreviewProcessPdf(fileBuffer: Buffer): Promise<FullProcessPdfAnalysis> {
        const coverParsed = await this.extractPdfText(fileBuffer, { first: 1 });
        const coverText = this.normalizeExtractedText(coverParsed.text);
        const courtSystem = this.detectCourtSystem(coverText);
        const previewPageBudget = courtSystem === 'PJe' ? PDF_PREVIEW_PJE_PAGE_BUDGET : PDF_PREVIEW_FIRST_PAGES;
        const selectedPageCount = Math.min(coverParsed.pageCount || previewPageBudget, previewPageBudget);
        const parsed =
            selectedPageCount <= 1
                ? coverParsed
                : await this.extractPdfText(fileBuffer, {
                      first: selectedPageCount,
                  });

        let normalizedText = this.normalizeExtractedText(parsed.text);
        let lines = normalizedText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        let documents = this.extractDocuments(lines, normalizedText, courtSystem);
        let parts = this.extractPartiesPreferred(normalizedText, courtSystem);
        let ocrStatus = parsed.ocrStatus;

        if (courtSystem === 'PJe' && this.shouldTryPreviewOcr(normalizedText, parts, selectedPageCount)) {
            const extraOcrText = await this.tryPreviewOcr(fileBuffer, selectedPageCount);
            if (extraOcrText) {
                normalizedText = this.normalizeExtractedText(`${normalizedText}\n\n${extraOcrText}`);
                lines = normalizedText
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                documents = this.extractDocuments(lines, normalizedText, courtSystem);
                parts = this.extractPartiesPreferred(normalizedText, courtSystem);
                ocrStatus = 'SUCCESS';
            }
        }

        const qualificationSources = this.collectPartyQualificationSources(normalizedText, documents, courtSystem);
        const enrichedParts = this.enrichPartiesWithQualificationSources(parts, qualificationSources);
        const coverSource = coverText || normalizedText;
        const cnj = this.extractCnj(coverSource) || this.extractCnj(normalizedText);
        const processClass = this.extractProcessClassPreferred(coverSource) || this.extractProcessClassPreferred(normalizedText);
        const title = processClass && cnj ? `${processClass} - ${cnj}` : processClass || cnj || 'Processo importado via PDF';
        const deadlineCandidates = this.extractDeadlineCandidatesSafe(normalizedText, documents);
        const proceduralActs = documents.filter((document) => this.isProceduralAct(document));
        const metadata = {
            ...this.buildMetadataSummary(normalizedText, parsed.pageCount, normalizedText.length, courtSystem, documents),
            analysisMode: 'PREVIEW',
            cnjConsulted: false,
            processedPageCount: selectedPageCount,
            qualificationSourceCount: qualificationSources.length,
            importStrategy:
                courtSystem === 'PJe'
                    ? 'PJE_FIRST_PAGE_PLUS_EARLY_QUALIFICATION'
                    : courtSystem === 'Eproc'
                      ? 'EPROC_EARLY_PAGES_PREVIEW'
                      : 'PDF_PREVIEW_FIRST_PAGES',
        };

        return {
            cnj,
            title,
            court: this.extractCourtEnhanced(coverSource) || this.extractCourtEnhanced(normalizedText),
            courtSystem,
            vars: this.extractCourtDivisionPreferred(coverSource) || this.extractCourtDivisionPreferred(normalizedText),
            district: this.extractDistrictEnhanced(coverSource) || this.extractDistrictEnhanced(normalizedText),
            status: this.extractStatus(coverSource || normalizedText),
            area: this.extractArea(processClass, coverSource || normalizedText),
            subject: this.extractSubjectPreferred(coverSource) || this.extractSubjectPreferred(normalizedText),
            class: processClass,
            distributionDate:
                this.extractDistributionDateEnhanced(coverSource) || this.extractDistributionDateEnhanced(normalizedText),
            judge: this.extractJudgePreferred(coverSource) || this.extractJudgePreferred(normalizedText),
            value: this.extractValue(coverSource) ?? this.extractValue(normalizedText),
            description: this.buildDescription(normalizedText, documents),
            parts: enrichedParts,
            pageCount: parsed.pageCount,
            textLength: normalizedText.length,
            hasSelectableText: parsed.textLength > 100,
            ocrStatus,
            rawTextExcerpt: normalizedText.slice(0, 4000),
            documents,
            proceduralActs,
            deadlineCandidates,
            importSource: this.resolveImportSource(courtSystem),
            timelineReferenceType: courtSystem === 'Eproc' ? 'EVENT' : 'DOCUMENT_ID',
            metadata,
        };
    }

    private async extractPdfText(fileBuffer: Buffer, options: PdfTextParseOptions = {}): Promise<{ text: string; pageCount: number; textLength: number; ocrStatus: FullProcessPdfAnalysis['ocrStatus'] }> {
        let ocrStatus: FullProcessPdfAnalysis['ocrStatus'] = 'NOT_NEEDED';

        try {
            const parsed = await extractTextFromPdfBuffer(fileBuffer, options);
            let text = parsed.text || '';
            const pageCount = parsed.pageCount || 0;

            if (text.trim().length < 100 && pageCount > 0) {
                try {
                    // Tenta OCR nos primeiros 3 páginas (onde geralmente está a capa/partes)
                    const ocrText = await this.performOcr(fileBuffer, this.resolveOcrPageSelection(pageCount, options, 3));
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
                const ocrText = await this.performOcr(fileBuffer, this.resolveOcrPageSelection(0, options, 3));
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

    private resolveOcrPageSelection(pageCount: number, options: PdfTextParseOptions = {}, fallbackLimit = 3) {
        if (Array.isArray(options.partial) && options.partial.length > 0) {
            return options.partial.filter((page) => Number(page) > 0);
        }

        if (typeof options.first === 'number' && typeof options.last === 'number') {
            const start = Math.max(1, options.first);
            const end = Math.max(start, options.last);
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        }

        if (typeof options.first === 'number' && options.first > 0) {
            return Array.from({ length: options.first }, (_, index) => index + 1);
        }

        if (typeof options.last === 'number' && options.last > 0 && pageCount > 0) {
            const start = Math.max(pageCount - options.last + 1, 1);
            return Array.from({ length: pageCount - start + 1 }, (_, index) => start + index);
        }

        return Array.from({ length: fallbackLimit }, (_, index) => index + 1);
    }

    private shouldTryPreviewOcr(text: string, parties: LegacyImportedParty[], selectedPageCount: number) {
        if (selectedPageCount <= 1) return false;
        const nonLawyerParties = (parties || []).filter((party) => !this.isLawyerType(party.type));
        if (nonLawyerParties.length === 0) return false;

        const cpfMatches = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || [];
        const richParties = nonLawyerParties.filter(
            (party) => party.document || party.phone || party.email || party.qualificationText || party.address,
        );

        return richParties.length === 0 || cpfMatches.length < Math.min(nonLawyerParties.length, 2);
    }

    private async tryPreviewOcr(fileBuffer: Buffer, selectedPageCount: number) {
        const ocrPages = Array.from({ length: Math.min(selectedPageCount, PDF_PREVIEW_OCR_PAGE_BUDGET) }, (_, index) => index + 2).filter(
            (page) => page > 1,
        );
        if (ocrPages.length === 0) {
            return '';
        }

        try {
            const ocrText = await this.performOcr(fileBuffer, ocrPages);
            return ocrText.trim().length > 120 ? ocrText : '';
        } catch (error) {
            console.error('[ProcessPdfService] Preview OCR Error:', error);
            return '';
        }
    }

    private async performOcr(buffer: Buffer, pageSelection: number | number[]): Promise<string> {
        const pdfImgConvert = require('pdf-img-convert');
        const { createWorker } = require('tesseract.js');
        const pageNumbers = Array.isArray(pageSelection)
            ? pageSelection.filter((page) => Number(page) > 0)
            : Array.from({ length: Math.max(1, pageSelection) }, (_, index) => index + 1);

        // Converter PDF para imagens (array de Buffers)
        const images = await pdfImgConvert.convert(buffer, {
            width: 1200,
            page_numbers: pageNumbers,
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

        const normalizedEprocLines = this.extractEprocPartiesSectionLines(text);
        if (normalizedEprocLines.length > 0) {
            let pendingRoles: string[] = [];
            let roleIndex = 0;

            for (const line of normalizedEprocLines) {
                const normalizedLine = this.normalizeLooseText(line);

                if (normalizedLine.includes('PROCURADOR')) {
                    pendingRoles = [];
                    roleIndex = 0;
                    continue;
                }

                const roleTokens = Array.from(
                    normalizedLine.matchAll(/\b(AUTOR|AUTORA|REU|REQUERENTE|REQUERIDO|REQUERIDA|EXECUTADO|EXECUTADA|EXEQUENTE|PERITO|TERCEIRO)\b/gi),
                ).map((match) => this.normalizePartyType(match[1]));
                if (roleTokens.length > 0 && !line.includes('(')) {
                    pendingRoles = roleTokens;
                    roleIndex = 0;
                    continue;
                }

                const documentMatch = line.match(/\(([\d\.\-\/]+)\)/);
                if (!documentMatch) {
                    continue;
                }

                const name = line.replace(/\([\d\.\-\/]+\)(?:\s*-\s*Pessoa\b[^\n]*)?/i, '').trim();
                const role = pendingRoles[roleIndex] || 'PARTE';
                pushParty(name, role, documentMatch[1]);
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

    private extractPartiesPreferred(text: string, courtSystem?: string | null) {
        if (courtSystem === 'PJe') {
            const pjeBlockParties = this.extractPjePartyLawyerBlock(text);
            return this.compactImportedParties(
                this.mergeImportedParties(
                    ...(pjeBlockParties.length > 0 ? [] : [this.extractParties(text)]),
                    pjeBlockParties,
                    this.extractPjeTriageParticipants(text, pjeBlockParties),
                ),
            ).slice(0, 50);
        }

        if (courtSystem === 'Eproc') {
            const eprocParties = this.extractEprocPartiesAndLawyers(text);
            return this.compactImportedParties(
                this.mergeImportedParties(
                    ...(eprocParties.length > 0 ? [] : [this.extractParties(text)]),
                    eprocParties,
                ),
            ).slice(0, 50);
        }

        return this.compactImportedParties(this.extractParties(text)).slice(0, 50);
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

    private compactImportedParties(parties: LegacyImportedParty[]) {
        const compacted = new Map<string, LegacyImportedParty>();

        for (const party of parties || []) {
            const name = String(party?.name || '').replace(/\s+/g, ' ').trim();
            if (!name) continue;

            const normalizedName = this.normalizeLooseText(name);
            const normalizedDocument = String(party?.document || '').replace(/\D/g, '');
            const normalizedType = this.normalizePartyType(String(party?.type || 'PARTE'));
            const pole = this.inferPartyPole(normalizedType);
            const identity = normalizedName || normalizedDocument || 'UNKNOWN';
            const key = this.isLawyerType(normalizedType)
                ? `${identity}::LAWYER`
                : `${identity}::${pole || normalizedType}`;
            const existing = compacted.get(key);
            const representedNames = new Map<string, string>();

            for (const candidate of [...(existing?.representedNames || []), ...(party?.representedNames || [])]) {
                const normalizedCandidate = this.normalizeLooseText(candidate);
                if (normalizedCandidate && !representedNames.has(normalizedCandidate)) {
                    representedNames.set(normalizedCandidate, String(candidate).trim());
                }
            }

            compacted.set(key, {
                ...(existing || {}),
                ...party,
                name,
                type: this.choosePreferredPartyType(existing?.type, normalizedType),
                document: existing?.document || party?.document,
                oab: existing?.oab || party?.oab,
                representedNames: Array.from(representedNames.values()),
                isClient: party?.isClient ?? existing?.isClient,
                isOpposing: party?.isOpposing ?? existing?.isOpposing,
            });
        }

        return Array.from(compacted.values())
            .filter((party) => {
                const normalizedName = this.normalizeLooseText(party.name);
                if (!normalizedName) return false;
                if (normalizedName.endsWith(' E')) return false;
                if (normalizedName.includes('POR SEU')) return false;
                return true;
            });
    }

    private collectPartyQualificationSources(text: string, documents: PdfProcessDocument[], courtSystem?: string | null) {
        const preferredTypes =
            courtSystem === 'PJe'
                ? ['PETICAO INICIAL', 'CONTESTACAO', 'CERTIDAO', 'MANIFESTACAO']
                : ['PETICAO INICIAL', 'CONTESTACAO', 'PETICAO', 'MANIFESTACAO'];
        const sources = new Map<string, string>();

        const pushSource = (value?: string | null) => {
            const snippet = String(value || '').trim();
            if (!snippet) return;
            const key = this.normalizeLooseText(snippet.slice(0, 300));
            if (!key || sources.has(key)) return;
            sources.set(key, snippet);
        };

        for (const document of documents || []) {
            const normalizedType = this.normalizeLooseText(`${document.documentType || ''} ${document.label || ''}`);
            if (!document.contentText) continue;
            if (preferredTypes.some((term) => normalizedType.includes(term))) {
                pushSource(document.contentText.slice(0, 12000));
            }
        }

        pushSource(String(text || '').slice(0, 16000));

        return Array.from(sources.values()).slice(0, 8);
    }

    private enrichPartiesWithQualificationSources(parties: LegacyImportedParty[], sources: string[]) {
        let enriched = [...(parties || [])];

        for (const source of sources || []) {
            enriched = enriched.map((party) => this.enrichPartyWithQualificationSource(party, source));
        }

        return this.compactImportedParties(enriched).slice(0, 50);
    }

    private enrichPartyWithQualificationSource(party: LegacyImportedParty, sourceText: string) {
        if (!party?.name || !sourceText) {
            return party;
        }

        const snippet = this.findPartyQualificationSnippet(party.name, sourceText);
        if (!snippet) {
            return party;
        }

        const details = this.extractPartyQualificationDetailsSafe(snippet, party);
        if (!details.document && !details.rg && !details.phone && !details.email && !details.qualificationText && !details.address) {
            return party;
        }

        return {
            ...party,
            document: party.document || details.document,
            rg: party.rg || details.rg,
            birthDate: party.birthDate || details.birthDate,
            motherName: party.motherName || details.motherName,
            fatherName: party.fatherName || details.fatherName,
            profession: party.profession || details.profession,
            nationality: party.nationality || details.nationality,
            civilStatus: party.civilStatus || details.civilStatus,
            address: party.address || details.address,
            qualificationText: party.qualificationText || details.qualificationText,
            phone: party.phone || details.phone,
            email: party.email || details.email,
        };
    }

    private findPartyQualificationSnippet(name: string, sourceText: string) {
        const words = String(name || '')
            .split(/\s+/)
            .map((word) => word.trim())
            .filter((word) => word.length >= 2);
        if (words.length === 0) {
            return '';
        }

        const pattern = words.slice(0, Math.min(words.length, 6)).map((word) => this.escapeRegex(word)).join('\\s+');
        const match = sourceText.match(new RegExp(`${pattern}[\\s\\S]{0,520}`, 'i'));
        if (!match?.[0]) {
            return '';
        }

        const rawSnippet = match[0].replace(/\s+/g, ' ').trim();
        const stopMatch = rawSnippet.match(
            /\b(?:por seu advogado|vem(?:,|\s)|ajuizar|propor a presente|em face de|pede deferimento|assinado eletronicamente|documentos|num\.)\b/i,
        );

        if (stopMatch?.index && stopMatch.index > name.length + 30) {
            return rawSnippet.slice(0, stopMatch.index).trim();
        }

        return rawSnippet;
    }

    private extractPartyQualificationDetails(snippet: string) {
        const document = snippet.match(/\b(?:CPF|CNPJ)\s*(?:n[oº]\s*)?[:\-]?\s*([\d\.\-\/]+)/i)?.[1] ||
            snippet.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/)?.[1];
        const rg = snippet.match(/\bRG\s*(?:n[oº]\s*)?[:\-]?\s*([\d\.\-A-Z]+)/i)?.[1];
        const email = snippet.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
        const phone = snippet.match(/((?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]?\d{4})/)?.[1];
        const birthDate = snippet.match(/(?:nascid[oa]|nascimento)[^\d]{0,20}(\d{2}\/\d{2}\/\d{4})/i)?.[1];
        const parentMatch = snippet.match(/filh[oa]\s+de\s+([^,.;]+?)(?:\s+e\s+([^,.;]+))?(?:[,.;]|$)/i);
        const nationality = snippet.match(/\b(brasileir[oa]|argentin[oa]|portugues[ae]|italian[oa]|urugua[ií]a|paragua[ií]a)\b/i)?.[1];
        const civilStatus = CIVIL_STATUS_TERMS.find((term) => this.normalizeLooseText(snippet).includes(term)) || undefined;
        const address = snippet.match(
            /(?:resident[ea]\s+e\s+domiciliad[oa]|resident[ea]\s+na?|domiciliad[oa]\s+na?)\s+([^.;]{8,180})/i,
        )?.[1];
        const profession = this.extractPartyProfession(snippet, civilStatus);

        const qualificationText = [document, rg, nationality, civilStatus, profession, address, email, phone].some(Boolean)
            ? snippet.slice(0, 500)
            : undefined;

        return {
            document,
            rg,
            birthDate,
            motherName: parentMatch?.[1]?.trim(),
            fatherName: parentMatch?.[2]?.trim(),
            profession: profession?.trim(),
            nationality: nationality?.trim(),
            civilStatus,
            address: address?.trim(),
            qualificationText,
            phone: phone?.trim(),
            email: email?.trim(),
        };
    }

    private extractPartyQualificationDetailsSafe(snippet: string, party?: LegacyImportedParty) {
        const isLawyer = this.isLawyerType(party?.type || '');
        const baseDetails = this.extractPartyQualificationDetails(snippet);
        const safePhone = this.extractQualifiedPhone(snippet);

        return {
            ...baseDetails,
            document: isLawyer ? undefined : baseDetails.document,
            rg: isLawyer ? undefined : baseDetails.rg,
            birthDate: isLawyer ? undefined : baseDetails.birthDate,
            motherName: isLawyer ? undefined : baseDetails.motherName,
            fatherName: isLawyer ? undefined : baseDetails.fatherName,
            phone: safePhone?.trim(),
            qualificationText: [
                isLawyer ? undefined : baseDetails.document,
                isLawyer ? undefined : baseDetails.rg,
                baseDetails.nationality,
                baseDetails.civilStatus,
                baseDetails.profession,
                baseDetails.address,
                baseDetails.email,
                safePhone,
            ].some(Boolean)
                ? snippet.slice(0, 500)
                : undefined,
        };
    }

    private extractQualifiedPhone(snippet: string) {
        const labeledMatch = snippet.match(
            /\b(?:telefone|celular|fone|whatsapp|tel\.?)\s*[:\-]?\s*((?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-.\s]?\d{4})/i,
        )?.[1];
        if (labeledMatch) {
            return labeledMatch;
        }

        const genericMatch = snippet.match(/\b((?:\(?\d{2}\)?[\s-]+)?(?:9?\d{4})[-.\s]+\d{4})\b/);
        const candidate = genericMatch?.[1]?.trim();
        if (!candidate) {
            return undefined;
        }

        const digits = candidate.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 11) {
            return undefined;
        }

        return candidate;
    }

    private extractPartyProfession(snippet: string, civilStatus?: string) {
        const segments = String(snippet || '')
            .split(',')
            .map((segment) => segment.trim())
            .filter(Boolean);

        let seenQualificationLead = false;

        for (const segment of segments) {
            const normalizedSegment = this.normalizeLooseText(segment);

            if (
                normalizedSegment.includes('BRASILEIR') ||
                normalizedSegment.includes('ARGENTIN') ||
                normalizedSegment.includes('PORTUGUES') ||
                (civilStatus && normalizedSegment.includes(civilStatus))
            ) {
                seenQualificationLead = true;
                continue;
            }

            if (!seenQualificationLead) {
                continue;
            }

            if (/CPF|CNPJ|RG|RESIDENT|DOMICILIAD|EMAIL|TELEFONE|TEL\b/i.test(normalizedSegment)) {
                break;
            }

            if (/^[A-ZÀ-ÿ][A-ZÀ-ÿ\s]{2,80}$/i.test(segment) && !CIVIL_STATUS_TERMS.some((term) => normalizedSegment.includes(term))) {
                return segment;
            }
        }

        return undefined;
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
        let pendingSplitEntry: { name: string; document?: string } | null = null;

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

            const roleOnlyMatch = line.match(/^\((.+)\)$/);
            if (roleOnlyMatch && pendingSplitEntry) {
                const splitType = this.normalizePartyType(String(roleOnlyMatch[1] || '').trim());
                if (splitType) {
                    pushParty({
                        name: pendingSplitEntry.name,
                        type: splitType,
                        document: pendingSplitEntry.document,
                    });

                    if (this.isLawyerType(splitType)) {
                        readingLawyerGroup = true;
                    } else {
                        pendingPrincipalNames = [pendingSplitEntry.name];
                        readingLawyerGroup = false;
                    }
                }
                pendingSplitEntry = null;
                continue;
            }

            const splitEntryMatch = line.match(/^(.+?)\s+((?:\d{11}|\d{14}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}))$/);
            if (splitEntryMatch && !line.includes('(')) {
                pendingSplitEntry = {
                    name: String(splitEntryMatch[1] || '').replace(/\s+/g, ' ').trim(),
                    document: String(splitEntryMatch[2] || '').trim(),
                };
                continue;
            }

            const entryMatch = line.match(/^(.*?)\s+\((.+)\)$/);
            if (!entryMatch) {
                pendingSplitEntry = null;
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

            if (readingLawyerGroup || pendingPrincipalNames.length === 0) {
                pendingPrincipalNames = [name];
                readingLawyerGroup = false;
                continue;
            }

            pendingPrincipalNames = [...pendingPrincipalNames, name];
        }

        return Array.from(parties.values());
    }

    private extractPjeTriageParticipants(text: string, knownParties: LegacyImportedParty[]) {
        const triageBlocks = Array.from(
            String(text || '').matchAll(/CERTID[AÃ]O DE TRIAGEM[\s\S]{0,2000}?ASSUNTO:[^\n]+\n([\s\S]{0,600}?)Certifico que:/gi),
        );
        if (triageBlocks.length === 0) {
            return [];
        }

        const knownByName = new Map<string, LegacyImportedParty>();
        const clientNames: string[] = [];
        const opposingNames: string[] = [];

        for (const party of knownParties || []) {
            const normalizedName = this.normalizeLooseText(party?.name);
            if (!normalizedName) continue;
            knownByName.set(normalizedName, party);
            if (this.inferPartyPole(party.type) === 'POLO_ATIVO') {
                clientNames.push(party.name);
            }
            if (this.inferPartyPole(party.type) === 'POLO_PASSIVO') {
                opposingNames.push(party.name);
            }
        }

        const extracted: LegacyImportedParty[] = [];

        for (const block of triageBlocks) {
            const triageText = String(block[1] || '').replace(/\s*\n\s*/g, ' ');
            const entries = Array.from(
                triageText.matchAll(/([A-ZÃÃ‰ÃÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡][A-ZÃÃ‰ÃÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡\s]+?)\s+CPF:\s*([\d\.\-\/]+)/gi),
            ).map((match) => ({
                name: String(match[1] || '').replace(/\s+/g, ' ').trim(),
                document: String(match[2] || '').trim(),
            }));

            if (entries.length === 0) continue;

            const firstOpponentIndex = entries.findIndex((entry) => {
                const existing = knownByName.get(this.normalizeLooseText(entry.name));
                return this.inferPartyPole(existing?.type || '') === 'POLO_PASSIVO';
            });

            for (let index = 0; index < entries.length; index += 1) {
                const entry = entries[index];
                const existing = knownByName.get(this.normalizeLooseText(entry.name));

                if (existing) {
                    extracted.push({
                        ...existing,
                        document: existing.document || entry.document,
                    });
                    continue;
                }

                if (firstOpponentIndex > 0 && index > 0 && index < firstOpponentIndex && clientNames.length > 0) {
                    extracted.push({
                        name: entry.name,
                        type: 'ADVOGADO',
                        document: entry.document,
                        representedNames: clientNames,
                        isClient: true,
                    });
                    continue;
                }

                if (firstOpponentIndex >= 0 && index > firstOpponentIndex && opposingNames.length > 0) {
                    extracted.push({
                        name: entry.name,
                        type: 'ADVOGADO CONTRARIO',
                        document: entry.document,
                        representedNames: opposingNames,
                        isOpposing: true,
                    });
                }
            }
        }

        return extracted;
    }

    private extractEprocPartiesSectionLines(text: string) {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return [];

        const normalizedLines = lines.map((line) => this.normalizeLooseText(line));
        const startIndex = normalizedLines.findIndex((line) => line.includes('PARTES E REPRESENTANTES'));
        if (startIndex < 0) return [];

        const endIndex = normalizedLines.findIndex((line, index) => {
            if (index <= startIndex) return false;
            return (
                line.includes('INFORMACOES ADICIONAIS') ||
                line.startsWith('CHAVE PROCESSO') ||
                line.startsWith('ANEXOS ELETRONICOS') ||
                line.startsWith('PAGINA DE SEPARACAO') ||
                /^--\s*\d+\s+OF\s+\d+\s*--$/i.test(line)
            );
        });

        const sliceEnd = endIndex > startIndex ? endIndex : Math.min(lines.length, startIndex + 40);
        return lines.slice(startIndex + 1, sliceEnd);
    }

    private extractEprocPartiesAndLawyers(text: string) {
        const normalizedSectionLines = this.extractEprocPartiesSectionLines(text);
        if (normalizedSectionLines.length > 0) {
            const extracted: LegacyImportedParty[] = [];
            const headerLine = normalizedSectionLines.find((line) => {
                const normalized = this.normalizeLooseText(line);
                return normalized.includes('AUTOR') && normalized.includes('REU');
            });
            const sequentialRoles: string[] = [];
            if (headerLine) {
                const normalizedHeader = this.normalizeLooseText(headerLine);
                if (normalizedHeader.includes('AUTOR')) sequentialRoles.push('AUTOR');
                if (normalizedHeader.includes('REU')) sequentialRoles.push('REU');
            }

            let lastPrincipal: LegacyImportedParty | null = null;
            let currentRole: string | null = null;
            let sequentialRoleIndex = 0;

            for (const line of normalizedSectionLines) {
                const normalizedLine = this.normalizeLooseText(line);

                if (normalizedLine.includes('PROCURADOR')) {
                    continue;
                }

                if (
                    ['AUTOR', 'AUTORA', 'REU', 'REQUERENTE', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'EXEQUENTE', 'PERITO', 'TERCEIRO'].includes(
                        normalizedLine,
                    )
                ) {
                    currentRole = this.normalizePartyType(line);
                    continue;
                }

                const partyMatch = line.match(/^(.+?)\s+\(([\d\.\-\/]+)\)(?:\s*-\s*Pessoa\b.*)?$/i);
                if (partyMatch) {
                    const role = currentRole || sequentialRoles[sequentialRoleIndex] || 'PARTE';
                    const party: LegacyImportedParty = {
                        name: partyMatch[1].trim(),
                        type: role,
                        document: partyMatch[2],
                        representedNames: [],
                        isClient: this.inferPartyPole(role) === 'POLO_ATIVO' ? true : undefined,
                        isOpposing: this.inferPartyPole(role) === 'POLO_PASSIVO' ? true : undefined,
                    };
                    extracted.push(party);
                    lastPrincipal = party;
                    currentRole = null;
                    if (sequentialRoleIndex < sequentialRoles.length - 1) {
                        sequentialRoleIndex += 1;
                    }
                    continue;
                }

                const lawyerMatch = line.match(/^(.+?)\s+((?:OAB\/)?[A-Z]{2}\s*[\d\.\s]{4,12})$/i);
                if (lawyerMatch) {
                    const isOpposing = this.inferPartyPole(lastPrincipal?.type || '') === 'POLO_PASSIVO';
                    extracted.push({
                        name: lawyerMatch[1].trim(),
                        type: isOpposing ? 'ADVOGADO CONTRARIO' : 'ADVOGADO',
                        oab: lawyerMatch[2].replace(/^OAB\//i, '').replace(/[.\s]+/g, ''),
                        representedNames: lastPrincipal?.name ? [lastPrincipal.name] : [],
                        isClient: isOpposing ? undefined : true,
                        isOpposing: isOpposing ? true : undefined,
                    });
                }
            }

            return extracted;
        }
        const block = text.match(/Partes e Representantes([\s\S]*?)Informa[cÃ§][oÃµ]es Adicionais/i)?.[1];
        if (!block) return [];

        const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const extracted: LegacyImportedParty[] = [];
        const headerLine = lines.find((line) => {
            const normalized = this.normalizeLooseText(line);
            return normalized.includes('AUTOR') && normalized.includes('REU');
        });
        const sequentialRoles: string[] = [];
        if (headerLine) {
            const normalizedHeader = this.normalizeLooseText(headerLine);
            if (normalizedHeader.includes('AUTOR')) sequentialRoles.push('AUTOR');
            if (normalizedHeader.includes('REU')) sequentialRoles.push('REU');
        }

        let lastPrincipal: LegacyImportedParty | null = null;
        let currentRole: string | null = null;
        let sequentialRoleIndex = 0;

        for (const line of lines) {
            if (/^Procurador\(es\):$/i.test(line)) {
                continue;
            }

            if (/^(AUTOR(?:A)?|R[EÃ‰]U|REQUERENTE|REQUERIDO(?:A)?|EXECUTADO(?:A)?|EXEQUENTE|PERITO|TERCEIRO)$/i.test(line)) {
                currentRole = this.normalizePartyType(line);
                continue;
            }

            const partyMatch = line.match(/^(.+?)\s+\(([\d\.\-\/]+)\)\s*-\s*Pessoa/i);
            if (partyMatch) {
                const role = currentRole || sequentialRoles[sequentialRoleIndex] || 'PARTE';
                const party: LegacyImportedParty = {
                    name: partyMatch[1].trim(),
                    type: role,
                    document: partyMatch[2],
                    representedNames: [],
                    isClient: this.inferPartyPole(role) === 'POLO_ATIVO' ? true : undefined,
                    isOpposing: this.inferPartyPole(role) === 'POLO_PASSIVO' ? true : undefined,
                };
                extracted.push(party);
                lastPrincipal = party;
                currentRole = null;
                if (sequentialRoleIndex < sequentialRoles.length - 1) {
                    sequentialRoleIndex += 1;
                }
                continue;
            }

            const roleSpecificPartyMatch = line.match(/^(.+?)\s+\(([\d\.\-\/]+)\)$/);
            if (roleSpecificPartyMatch && currentRole) {
                const party: LegacyImportedParty = {
                    name: roleSpecificPartyMatch[1].trim(),
                    type: currentRole,
                    document: roleSpecificPartyMatch[2],
                    representedNames: [],
                };
                extracted.push(party);
                lastPrincipal = party;
                currentRole = null;
                continue;
            }

            const lawyerMatch = line.match(/^(.+?)\s+([A-Z]{2}\s*\d{4,6})$/i);
            if (lawyerMatch) {
                const isOpposing = this.inferPartyPole(lastPrincipal?.type || '') === 'POLO_PASSIVO';
                extracted.push({
                    name: lawyerMatch[1].trim(),
                    type: isOpposing ? 'ADVOGADO CONTRARIO' : 'ADVOGADO',
                    oab: lawyerMatch[2].replace(/\s+/g, ''),
                    representedNames: lastPrincipal?.name ? [lastPrincipal.name] : [],
                    isClient: isOpposing ? undefined : true,
                    isOpposing: isOpposing ? true : undefined,
                });
            }
        }

        return extracted;
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
        if (normalized.includes('PERITO')) return 'PERITO';
        if (normalized.includes('TERCEIRO')) return 'TERCEIRO';
        if (['ADVOGADO', 'ADVOGADA', 'PROCURADOR', 'PROCURADORA', 'DEFENSOR'].some((term) => normalized.includes(term))) {
            return normalized.includes('CONTRAR') ? 'ADVOGADO CONTRARIO' : 'ADVOGADO';
        }
        return 'PARTE';
    }

    private inferPartyPole(type?: string | null) {
        const normalized = this.normalizePartyType(String(type || 'PARTE'));
        if (['AUTOR', 'REQUERENTE', 'EXEQUENTE', 'APELANTE', 'INVENTARIANTE'].includes(normalized)) return 'POLO_ATIVO';
        if (['REU', 'REQUERIDO', 'EXECUTADO', 'APELADO'].includes(normalized)) return 'POLO_PASSIVO';
        return null;
    }

    private choosePreferredPartyType(existingType?: string | null, nextType?: string | null) {
        const priorities: Record<string, number> = {
            PARTE: 0,
            TERCEIRO: 1,
            AUTOR: 5,
            REQUERENTE: 5,
            EXEQUENTE: 6,
            INVENTARIANTE: 6,
            REU: 5,
            REQUERIDO: 5,
            EXECUTADO: 6,
            APELANTE: 4,
            APELADO: 4,
            PERITO: 7,
            ADVOGADO: 8,
            'ADVOGADO CONTRARIO': 8,
        };

        const normalizedExisting = this.normalizePartyType(String(existingType || 'PARTE'));
        const normalizedNext = this.normalizePartyType(String(nextType || 'PARTE'));
        return (priorities[normalizedNext] || 0) >= (priorities[normalizedExisting] || 0) ? normalizedNext : normalizedExisting;
    }

    private countDocumentLikeTokens(value: string) {
        return (String(value || '').match(/\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g) || []).length;
    }

    private extractDocuments(lines: string[], fullText: string, courtSystem?: string | null): PdfProcessDocument[] {
        if (courtSystem === 'Eproc') {
            return this.extractEprocDocuments(fullText);
        }

        const documents = new Map<string, PdfProcessDocument>(
            this.extractPjeCoverDocuments(lines).map((document) => [document.documentId, document]),
        );

        if (documents.size === 0) {
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
            const deadlineCandidates = this.extractDeadlineCandidatesSafe(contentText || '', [
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
                    this.inferEprocDocumentType(footer.referenceCode, separator?.label) ||
                    this.inferDocumentTypeFromLabel(baseDocument.label || this.buildEprocEventLabel(footer.eventNumber, footer.referenceCode, separator?.label)) ||
                    this.inferDocumentTypeFromLabel(cleanContent.slice(0, 240)) ||
                    this.inferDocumentTypeFromContent(cleanContent),
                contentText: mergedContent || null,
                contentPreview: mergedContent ? mergedContent.slice(0, 320) : null,
            });
        }

        for (const [eventNumber, document] of documents.entries()) {
            const deadlineCandidates = this.extractDeadlineCandidatesSafe(document.contentText || '', [
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
        if (normalized.includes('PETICAO')) return 'Peticao';
        if (normalized.includes('CONTRARRAZO')) return 'Contrarrazoes';
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

    private extractPjeCoverDocuments(lines: string[]) {
        const headerIndex = lines.findIndex((line) => /^Id\.\s*Data da Assinatura Documento Tipo$/i.test(line));
        if (headerIndex < 0) return [];

        const rows: string[] = [];
        let currentRow = '';

        for (const line of lines.slice(headerIndex + 1, headerIndex + 600)) {
            if (/^Num\.\s*\d{10,11}\s*-\s*P[aÃ¡]g\./i.test(line)) {
                break;
            }

            if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) {
                continue;
            }

            if (/^(\d{10,11})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(.+)$/.test(line)) {
                if (currentRow) {
                    rows.push(currentRow.trim());
                }
                currentRow = line.trim();
                continue;
            }

            if (!currentRow) {
                continue;
            }

            currentRow = `${currentRow} ${line.trim()}`.trim();
        }

        if (currentRow) {
            rows.push(currentRow.trim());
        }

        return rows
            .map((row) => {
                const match = row.match(/^(\d{10,11})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(.+)$/);
                if (!match) return null;

                const [, documentId, signedAtRaw, rawLabel] = match;
                const parsedLabel = this.parseDocumentLabel(rawLabel);

                return {
                    documentId,
                    referenceType: 'DOCUMENT_ID' as const,
                    signedAt: this.toIsoFromBrazilianDate(signedAtRaw),
                    label: parsedLabel.label,
                    documentType: parsedLabel.documentType,
                    contentText: null,
                    contentPreview: null,
                    deadlineCandidates: [],
                };
            })
            .filter(Boolean) as PdfProcessDocument[];
    }

    private parseDocumentLabel(rawLabel: string) {
        const cleanLabel = String(rawLabel || '').replace(/\s+/g, ' ').trim();
        const matchedAlias = this.findDocumentTypeAlias(cleanLabel, true);
        const documentType = matchedAlias?.type || this.inferDocumentTypeFromLabel(cleanLabel);
        const labelWithoutType = matchedAlias?.alias
            ? this.removeTrailingDocumentType(cleanLabel, matchedAlias.alias)
            : cleanLabel;

        return {
            label: labelWithoutType || cleanLabel,
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

    private inferDocumentTypeFromLabel(contentText?: string | null) {
        return this.findDocumentTypeAlias(contentText || '', false)?.type || null;
    }

    private findDocumentTypeAlias(contentText: string, suffixOnly: boolean) {
        const normalizedText = this.normalizeLooseText(contentText);
        if (!normalizedText) return null;

        const aliases = DOCUMENT_TYPE_DEFINITIONS.flatMap((definition) =>
            definition.aliases.map((alias) => ({
                alias,
                type: definition.type,
                normalizedAlias: this.normalizeLooseText(alias),
            })),
        ).sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length);

        return (
            aliases.find((candidate) =>
                suffixOnly ? normalizedText.endsWith(candidate.normalizedAlias) : normalizedText.includes(candidate.normalizedAlias),
            ) || null
        );
    }

    private escapeRegex(value: string) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private removeTrailingDocumentType(label: string, alias: string) {
        const directRemoval = String(label || '')
            .replace(new RegExp(`${this.escapeRegex(alias)}$`, 'i'), '')
            .replace(/[-–:\s]+$/g, '')
            .trim();

        if (directRemoval && directRemoval !== label) {
            return directRemoval;
        }

        const labelWords = String(label || '').trim().split(/\s+/);
        const aliasWords = String(alias || '').trim().split(/\s+/);
        if (labelWords.length > aliasWords.length) {
            return labelWords.slice(0, labelWords.length - aliasWords.length).join(' ').trim();
        }

        return String(label || '').trim();
    }

    private inferDocumentTypeFromContent(contentText: string) {
        const fromLabel = this.inferDocumentTypeFromLabel(contentText);
        if (fromLabel) return fromLabel;

        const normalized = this.normalizeLooseText(contentText);
        if (normalized.includes('INTIMA')) return 'Intimacao';
        if (normalized.includes('DESPACH')) return 'Despacho';
        if (normalized.includes('DECISAO')) return 'Decisao';
        if (normalized.includes('CERTIDAO')) return 'Certidao';
        if (normalized.includes('MANDADO')) return 'Mandado';
        if (normalized.includes('CITACAO')) return 'Citacao';
        if (normalized.includes('GUIA')) return 'Guia';
        if (normalized.includes('COMPROVANTE')) return 'Comprovante';
        if (normalized.includes('PROCURACAO')) return 'Procuracao';
        if (normalized.includes('AVISO DE RECEBIMENTO')) return 'Aviso de Recebimento';
        if (normalized.includes('SUBSTABELEC')) return 'Substabelecimento';
        if (normalized.includes('FORMAL DE PARTILHA')) return 'Formal de Partilha';
        if (normalized.includes('CONTESTA')) return 'Contestacao';
        if (normalized.includes('PETICAO INICIAL') || normalized.includes('PROPOR A PRESENTE')) return 'Peticao inicial';
        if (normalized.includes('MANIFESTA')) return 'Manifestacao';
        return null;
    }

    private extractDeadlineCandidatesSafe(text: string, documents: PdfProcessDocument[]) {
        const proceduralDocuments = (documents || []).filter((document) => this.isProceduralAct(document));
        const targetDocuments = proceduralDocuments.length > 0 ? proceduralDocuments : documents || [];
        const baseCandidates = this.extractDeadlineCandidates(text, targetDocuments);

        return baseCandidates.filter((candidate) => {
            if (proceduralDocuments.length > 0 && !candidate.sourceDocumentId) {
                return false;
            }

            return this.isLikelyProceduralDeadlineContext(candidate.excerpt, candidate.documentType || null);
        });
    }

    private extractDeadlineCandidates(text: string, documents: PdfProcessDocument[]) {
        const candidates: PdfDeadlineCandidate[] = [];
        const normalizedText = String(text || '');

        const collectCandidates = (sourceText: string, sourceDocumentId?: string | null, documentType?: string | null) => {
            const daysRegex = /prazo(?:\s+de)?\s+(\d{1,3}|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta|quarenta|quarenta e cinco|sessenta)(?:\s*\(([^)]*)\))?\s*dias?/gi;
            for (const match of sourceText.matchAll(daysRegex)) {
                candidates.push({
                    sourceDocumentId: sourceDocumentId || null,
                    documentType: documentType || null,
                    excerpt: this.safeExcerpt(sourceText, match.index ?? 0),
                    deadlineDays: this.parseDeadlineDays(match[1]),
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

    private parseDeadlineDays(rawValue?: string | null) {
        const normalized = this.normalizeLooseText(rawValue);
        const numeric = Number(String(rawValue || '').replace(/\D/g, ''));
        if (numeric > 0) {
            return numeric;
        }

        const mapping: Record<string, number> = {
            UM: 1,
            UMA: 1,
            DOIS: 2,
            DUAS: 2,
            TRES: 3,
            QUATRO: 4,
            CINCO: 5,
            SEIS: 6,
            SETE: 7,
            OITO: 8,
            NOVE: 9,
            DEZ: 10,
            QUINZE: 15,
            VINTE: 20,
            TRINTA: 30,
            QUARENTA: 40,
            'QUARENTA E CINCO': 45,
            SESSENTA: 60,
        };

        return mapping[normalized] || null;
    }

    private isLikelyProceduralDeadlineContext(excerpt: string, documentType?: string | null) {
        const normalizedExcerpt = this.normalizeLooseText(excerpt);
        const normalizedDocumentType = this.normalizeLooseText(documentType);

        if (
            [
                'SALARIO',
                'CBO',
                'TIPO DE CONTRATO',
                'ESTATUTO SOCIAL',
                'GARANTIA',
                'FORA DO ESTABELECIMENTO COMERCIAL',
                'DATAPREV',
                'HISTORICO LABORAL',
                'CTPS',
            ].some((term) => normalizedExcerpt.includes(term))
        ) {
            return false;
        }

        if (
            ['INTIM', 'DESPACH', 'DECISAO', 'SENTENCA', 'MANDADO', 'CERTIDAO', 'ATO ORDINATORIO', 'CITACAO'].some((term) =>
                normalizedDocumentType.includes(term),
            )
        ) {
            return true;
        }

        return ['INTIM', 'MANIFEST', 'CONTEST', 'PRAZO', 'AUDIENC', 'PERIC', 'LAUDO', 'JUNTAR', 'APRESENTAR', 'CITAR'].some((term) =>
            normalizedExcerpt.includes(term),
        );
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
        return ['INTIM', 'DESPACH', 'DECISAO', 'SENTENCA', 'CERTIDAO', 'MANDADO', 'FORMAL DE PARTILHA', 'COMUNICACAO', 'ATO ORDINATORIO', 'CITACAO'].some((token) =>
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
