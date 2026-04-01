import { extractTextFromPdfBuffer } from '../common/pdf-parse.util';
import { ProcessPdfService } from './process-pdf.service';

jest.mock('../common/pdf-parse.util', () => ({
    extractTextFromPdfBuffer: jest.fn(),
}));

describe('ProcessPdfService', () => {
    const service = new ProcessPdfService();
    const mockedExtractTextFromPdfBuffer = extractTextFromPdfBuffer as jest.MockedFunction<typeof extractTextFromPdfBuffer>;

    beforeEach(() => {
        mockedExtractTextFromPdfBuffer.mockReset();
    });

    it('detects CNJ correctly for PJe PDFs', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 252,
            text: [
                '20/03/2026',
                'Numero: 5057484-07.2022.8.13.0024',
                'Classe: [CIVEL] EXECUCAO DE TITULO EXTRAJUDICIAL',
                'Orgao julgador: 16a Vara Civel da Comarca de Belo Horizonte',
                'PJe - Processo Judicial Eletronico',
                'Partes Advogados',
                'IZABELLA RIZCK DE MAGALHAES (EXEQUENTE)',
                'Processo relacionado 5057476-30.2022.8.13.0024',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.cnj).toBe('50574840720228130024');
        expect(analysis.courtSystem).toBe('PJe');
        expect(analysis.pageCount).toBe(252);
    });

    it('prioritizes the labeled process number for eproc PDFs', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 268,
            text: [
                'Referencia cruzada 5057484-07.2022.8.13.0024',
                'CAPA PROCESSO',
                'PROCESSO',
                'N\u00BA 1044734-36.2025.8.13.0024',
                'N\u00BA do processo 1044734-36.2025.8.13.0024',
                'Classe da acao: PROCEDIMENTO COMUM CIVEL',
                'PAGINA DE SEPARACAO',
                'Evento 1',
                'Processo 1044734-36.2025.8.13.0024/MG, Evento 1, INIC1, Pagina 1',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.cnj).toBe('10447343620258130024');
        expect(analysis.courtSystem).toBe('Eproc');
        expect(analysis.pageCount).toBe(268);
    });

    it('falls back to the most frequent CNJ when no label is found', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 10,
            text: [
                'Documento relacionado 1111111-11.2024.8.13.0001',
                'Rodape 2222222-22.2025.8.13.0002',
                'Rodape 2222222-22.2025.8.13.0002',
                'Rodape 2222222-22.2025.8.13.0002',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.cnj).toBe('22222222220258130002');
    });
});
