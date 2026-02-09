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
    title?: string;
    status?: string;
}

@Injectable()
export class ProcessPdfService {

    async extractDataFromPdf(fileBuffer: Buffer): Promise<ExtractedProcessData> {
        try {
            const data = await pdf(fileBuffer);
            const text = data.text;

            if (!text || text.length < 50) {
                throw new BadRequestException('O PDF parece estar vazio ou não contém texto selecionável (imagem escaneada). Tente um arquivo "nascido digital" (ex: exportado do PJe).');
            }

            // Normalização básica de quebras de linha/espaços excessivos
            const normalizedText = text.replace(/\s+/g, ' ');

            // 1. Extração de CNJ (Regex padrão BR)
            // Procura: NNNNNNN-DD.AAAA.J.TR.OOOO
            const cnjMatch = text.match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
            const cnj = cnjMatch ? cnjMatch[0] : undefined;

            // 2. Extração de Tribunal
            let court = undefined;
            if (normalizedText.includes('TRIBUNAL DE JUSTIÇA DO ESTADO DE MINAS GERAIS') || normalizedText.includes('TJMG')) court = 'TJMG';
            if (normalizedText.includes('TRIBUNAL REGIONAL FEDERAL DA 1ª REGIÃO') || normalizedText.includes('TRF1')) court = 'TRF1';
            if (normalizedText.includes('TRIBUNAL REGIONAL DO TRABALHO DA 3ª REGIÃO') || normalizedText.includes('TRT3')) court = 'TRT3';

            // 3. Extração de Valor da Causa
            // Procura: "Valor da causa: R$ 1.234,56" ou "Dá-se à causa o valor de..."
            let value = undefined;
            const valueMatch = text.match(/(?:valor\s+da\s+causa|v\.\s*causa)[:\s]*R?\$?\s*([\d\.]+,\d{2})/i);
            
            if (valueMatch && valueMatch[1]) {
                const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
                value = parseFloat(valueStr);
            }

            // 4. Extração de Partes (Heurística Simples)
            // Tenta achar padrões comuns em petições iniciais:
            // "AUTOR: Fulano de Tal"
            // "RÉU: Ciclano de Tal"
            const parts = [];

            const authorMatch = text.match(/(?:AUTOR|REQUERENTE|EXEQUENTE|IMPETRANTE|RECLAMANTE)[:\s]+([A-ZÀ-Ú\s]+)(?:,|\s+CPF|\s+CNPJ)/i);
            if (authorMatch && authorMatch[1]) {
                parts.push({
                    name: authorMatch[1].trim(),
                    type: 'AUTOR'
                });
            }

            const defendantMatch = text.match(/(?:RÉU|REQUERIDO|EXECUTADO|IMPETRADO|RECLAMADO)[:\s]+([A-ZÀ-Ú\s]+)(?:,|\s+CPF|\s+CNPJ)/i);
            if (defendantMatch && defendantMatch[1]) {
                parts.push({
                    name: defendantMatch[1].trim(),
                    type: 'RÉU'
                });
            }

            // 5. Status
            // Assume novo/distribuído se for petição inicial
            const status = 'DISTRIBUÍDO';

            return {
                cnj,
                description: text.substring(0, 500) + '...', // Preview do texto
                parts,
                value,
                distributionDate: new Date(), // Data atual da extração como "Distribuição" aproximada se não achar
                court,
                title: cnj ? `Processo Importado ${cnj}` : 'Novo Processo (PDF Importado)',
                status
            };

        } catch (error) {
            console.error('Erro ao ler PDF:', error);
            throw new BadRequestException('Erro ao processar o arquivo PDF: ' + error.message);
        }
    }
}
