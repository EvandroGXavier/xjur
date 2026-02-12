import { Injectable, BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');

export interface ExtractedProcessData {
    cnj?: string;
    description?: string;
    parts?: Array<{ name: string; type: string; document?: string }>;
    value?: number;
    distributionDate?: Date;
    court?: string;
    vars?: string;
    district?: string;
    area?: string;
    judge?: string;
    title?: string;
    status?: string;
}

@Injectable()
export class ProcessPdfService {

    async extractDataFromPdf(fileBuffer: Buffer): Promise<ExtractedProcessData> {
        try {
            const data = await pdf(fileBuffer);
            const text: string = data.text;

            console.log('=== PDF EXTRACTION DEBUG ===');
            console.log('Total chars:', text?.length);
            console.log('First 300 chars:', text?.substring(0, 300));

            if (!text || text.length < 20) {
                throw new BadRequestException('O PDF parece estar vazio ou não contém texto selecionável (imagem escaneada). Tente um arquivo "nascido digital" (ex: exportado do PJe).');
            }

            // Normalização: converter quebras de linha/tabs em espaço, colapsar espaços múltiplos
            const normalizedText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
            // Versão em uppercase para buscas case-insensitive
            const upperText = normalizedText.toUpperCase();

            // 1. Extração de CNJ (Regex padrão BR)
            // Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
            const cnjMatch = text.match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
            const cnj = cnjMatch ? cnjMatch[0] : undefined;

            // 2. Extração de Tribunal (ampla)
            let court: string | undefined = undefined;
            const tribunalPatterns: [RegExp, string][] = [
                [/TRIBUNAL\s+DE\s+JUSTI[CÇ]A\s+DO\s+ESTADO\s+DE\s+MINAS\s+GERAIS/i, 'TJMG'],
                [/TRIBUNAL\s+DE\s+JUSTI[CÇ]A\s+DO\s+ESTADO\s+DE\s+S[AÃ]O\s+PAULO/i, 'TJSP'],
                [/TRIBUNAL\s+DE\s+JUSTI[CÇ]A\s+DO\s+ESTADO\s+DO\s+RIO\s+DE\s+JANEIRO/i, 'TJRJ'],
                [/TRIBUNAL\s+DE\s+JUSTI[CÇ]A\s+DO\s+ESTADO\s+DO\s+PARAN[AÁ]/i, 'TJPR'],
                [/TRIBUNAL\s+DE\s+JUSTI[CÇ]A\s+DO\s+DISTRITO\s+FEDERAL/i, 'TJDFT'],
                [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+DA\s+1[ªa]\s+REGI[AÃ]O/i, 'TRF1'],
                [/TRIBUNAL\s+REGIONAL\s+DO\s+TRABALHO\s+DA\s+3[ªa]\s+REGI[AÃ]O/i, 'TRT3'],
                [/\bTJMG\b/, 'TJMG'], [/\bTJSP\b/, 'TJSP'], [/\bTJRJ\b/, 'TJRJ'],
                [/\bTJPR\b/, 'TJPR'], [/\bTJDFT\b/, 'TJDFT'],
                [/\bTRF1\b/, 'TRF1'], [/\bTRF2\b/, 'TRF2'], [/\bTRF3\b/, 'TRF3'],
                [/\bTRT3\b/, 'TRT3'], [/\bTRT2\b/, 'TRT2'], [/\bTRT15\b/, 'TRT15'],
                [/\bSTJ\b/, 'STJ'], [/\bSTF\b/, 'STF'],
                [/PODER\s+JUDICI[AÁ]RIO/i, 'PODER JUDICIÁRIO'],
            ];
            for (const [pattern, name] of tribunalPatterns) {
                if (pattern.test(normalizedText)) {
                    court = name;
                    break;
                }
            }

            // 3. Extração de Valor da Causa (múltiplos padrões)
            let value: number | undefined = undefined;
            const valuePatterns = [
                /(?:valor\s+da\s+causa|v(?:alor)?\.?\s*(?:da)?\s*causa)[:\s]*R?\$?\s*([\d.,]+)/i,
                /(?:d[aá](?:-se)?)\s+[àa]\s+causa\s+(?:o\s+)?valor\s+de\s+R?\$?\s*([\d.,]+)/i,
                /R\$\s*([\d.]+,\d{2})/i,
                /(?:atribu[ií](?:do|mos?)?\s+(?:[àa]\s+causa\s+)?(?:o\s+)?valor\s+de)\s+R?\$?\s*([\d.,]+)/i,
                /(?:valor)\s*(?:[:=])\s*R?\$?\s*([\d.,]+)/i,
            ];
            for (const pattern of valuePatterns) {
                const match = normalizedText.match(pattern);
                if (match && match[1]) {
                    const raw = match[1].trim();
                    // Detectar formato BR (1.234,56) vs EN (1,234.56)
                    const hasBRFormat = /\d+\.\d{3}/.test(raw) || raw.includes(',');
                    let parsed: number;
                    if (hasBRFormat) {
                        parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
                    } else {
                        parsed = parseFloat(raw);
                    }
                    if (!isNaN(parsed) && parsed > 0) {
                        value = parsed;
                        break;
                    }
                }
            }

            // 4. Extração de Partes (Heurísticas AMPLAS)
            const parts: Array<{ name: string; type: string; document?: string }> = [];

            // Helper: extrair nome limpo (até encontrar pontuação, quebra, ou padrão inválido)
            const cleanName = (raw: string): string => {
                return raw
                    .replace(/[\r\n\t]/g, ' ')
                    .replace(/\s{2,}/g, ' ')
                    .replace(/^\s*[:\-–—]\s*/, '') // Remove : ou - inicial
                    .replace(/\s*(?:,|\.|\bCPF\b|\bCNPJ\b|\bINSCRI[CÇ][AÃ]O\b|\bRG\b|\bBRASILEIR[OA]\b|\bNACIONALIDADE\b|\bRESIDENTE\b|\bPORTADOR\b|\bPROFISS[AÃ]O\b).*$/i, '')
                    .trim();
            };

            // Autor / Polo Ativo
            const authorPatterns = [
                /(?:AUTOR(?:A)?|REQUERENTE|EXEQUENTE|IMPETRANTE|RECLAMANTE|APELANTE|AGRAVANTE|PROMOVENTE|EMBARGANTE)\s*[:\-–—]?\s*([^\n\r]{3,80})/i,
                /(?:POLO\s+ATIVO)\s*[:\-–—]?\s*([^\n\r]{3,80})/i,
            ];
            for (const pattern of authorPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    const name = cleanName(match[1]);
                    if (name.length >= 3 && name.length <= 80) {
                        // Extrair CPF/CNPJ se existir perto
                        const docMatch = text.substring(text.indexOf(match[0]), text.indexOf(match[0]) + 200)
                            .match(/(?:CPF|CNPJ)[:\s]*(\d[\d.\-\/]+)/i);
                        parts.push({
                            name,
                            type: 'AUTOR',
                            document: docMatch ? docMatch[1].replace(/[.\-\/]/g, '') : undefined,
                        });
                        break;
                    }
                }
            }

            // Réu / Polo Passivo
            const defendantPatterns = [
                /(?:R[EÉ](?:U|A)|REQUERIDO(?:A)?|EXECUTADO(?:A)?|IMPETRADO(?:A)?|RECLAMADO(?:A)?|APELADO(?:A)?|AGRAVADO(?:A)?|PROMOVIDO(?:A)?|EMBARGADO(?:A)?)\s*[:\-–—]?\s*([^\n\r]{3,80})/i,
                /(?:POLO\s+PASSIVO)\s*[:\-–—]?\s*([^\n\r]{3,80})/i,
            ];
            for (const pattern of defendantPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    const name = cleanName(match[1]);
                    if (name.length >= 3 && name.length <= 80) {
                        const docMatch = text.substring(text.indexOf(match[0]), text.indexOf(match[0]) + 200)
                            .match(/(?:CPF|CNPJ)[:\s]*(\d[\d.\-\/]+)/i);
                        parts.push({
                            name,
                            type: 'RÉU',
                            document: docMatch ? docMatch[1].replace(/[.\-\/]/g, '') : undefined,
                        });
                        break;
                    }
                }
            }

            // 5. Vara / Órgão Julgador
            let vars: string | undefined = undefined;
            const varaMatch = normalizedText.match(/(\d+[ªºa]?\s*Vara\s+(?:C[ií]vel|Criminal|(?:do\s+)?Trabalho|Federal|da\s+Faz[.\s]*P[uú]b(?:lica)?|de\s+Fam[ií]lia)[^\n,;]*)/i);
            if (varaMatch) vars = varaMatch[1].trim();

            // 6. Comarca
            let district: string | undefined = undefined;
            const comarcaMatch = normalizedText.match(/(?:Comarca|Foro)\s+(?:de|do|da)\s+([A-ZÀ-Úa-zà-ú\s]+?)(?:\s*[-–—]|\s*$|\s+(?:Estado|UF|\d|Processo|Autos))/i);
            if (comarcaMatch) district = comarcaMatch[1].trim();

            // 7. Juiz
            let judge: string | undefined = undefined;
            const judgeMatch = normalizedText.match(/(?:Ju[ií]z(?:a)?|Magistrad[oa]|Dr[.\s]*(?:a)?)[:\s]*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,5})/i);
            if (judgeMatch) judge = judgeMatch[1].trim();

            // 8. Área
            let area: string | undefined = undefined;
            if (/\b(?:c[ií]vel|obriga[cç][aã]o|cobran[cç]a|indeniza[cç][aã]o|consumidor|dano\s+moral|despejo)\b/i.test(normalizedText)) area = 'Cível';
            else if (/\b(?:trabalhi?sta|reclama[cç][aã]o|CLT|empregad|FGTS|rescis[aã]o)\b/i.test(normalizedText)) area = 'Trabalhista';
            else if (/\b(?:criminal|penal|den[uú]ncia|crime|furto|roubo|homic[ií]dio)\b/i.test(normalizedText)) area = 'Criminal';
            else if (/\b(?:fam[ií]lia|div[oó]rcio|alimentos|guarda|pens[aã]o)\b/i.test(normalizedText)) area = 'Família';
            else if (/\b(?:tribut[aá]ri|fiscal|imposto|ICMS|ISS|IPTU)\b/i.test(normalizedText)) area = 'Tributário';
            else if (/\b(?:previdenci[aá]ri|INSS|aposentadoria|benef[ií]cio)\b/i.test(normalizedText)) area = 'Previdenciário';

            // 9. Data de Distribuição
            let distributionDate: Date | undefined = undefined;
            const dateMatch = normalizedText.match(/(?:distribu[ií](?:do|da|[cç][aã]o))\s*(?:em)?\s*[:\s]*(\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4})/i);
            if (dateMatch) {
                const [d, m, y] = dateMatch[1].split(/[\/\.\-]/);
                distributionDate = new Date(`${y}-${m}-${d}`);
            }

            // 10. Status
            const status = 'ATIVO';

            // 11. Título inteligente
            let title = 'Novo Processo (PDF Importado)';
            if (cnj && parts.length > 0) {
                title = `${parts[0].name} - ${cnj}`;
            } else if (cnj) {
                title = `Processo ${cnj}`;
            } else if (parts.length >= 2) {
                title = `${parts[0].name} vs ${parts[1].name}`;
            } else if (parts.length === 1) {
                title = `Processo - ${parts[0].name}`;
            }

            const result: ExtractedProcessData = {
                cnj,
                description: text.substring(0, 800).replace(/\s{2,}/g, ' ').trim() + (text.length > 800 ? '...' : ''),
                parts,
                value,
                distributionDate,
                court,
                vars,
                district,
                area,
                judge,
                title,
                status
            };

            console.log('=== PDF EXTRACTION RESULT ===');
            console.log('CNJ:', cnj);
            console.log('Court:', court);
            console.log('Value:', value);
            console.log('Parts:', JSON.stringify(parts));
            console.log('Vars:', vars);
            console.log('District:', district);
            console.log('Area:', area);
            console.log('Judge:', judge);
            console.log('Title:', title);

            return result;

        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            console.error('Erro ao ler PDF:', error);
            throw new BadRequestException('Erro ao processar o arquivo PDF: ' + error.message);
        }
    }
}
