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

    it('extracts cleaner parties, lawyers and multiline documents from PJe PDFs', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 252,
            text: [
                '20/03/2026',
                'Numero: 5057484-07.2022.8.13.0024',
                'PJe - Processo Judicial Eletronico',
                'Partes Advogados',
                'IZABELLA RIZCK DE MAGALHAES (EXEQUENTE)',
                'ARTHUR THOMAZI MOREIRA (ADVOGADO)',
                'BRUNO CUNHA DE CASTRO (ADVOGADO)',
                'CLEITON CASTRO COIMBRA (EXECUTADO(A))',
                'HILDA ALVES CASTRO (EXECUTADO(A))',
                'EVANDRO GERALDO XAVIER (ADVOGADO)',
                'Documentos',
                'Id. Data da Assinatura Documento Tipo',
                '9186938136 30/03/2022 14:18 1-Acao de Execucao - Izabela Rizck x Cleiton',
                'Castro Coimbra (Prolar)',
                'PETICAO INICIAL',
                '9186938138 30/03/2022 14:18 2-PROCURACAO Procuracao',
                '9468629438 25/05/2022 09:52 Certidao de Triagem Certidao de Triagem',
                '-- 1 of 252 --',
                'Num. 9468629438 - Pag. 1',
                'CERTIDAO DE TRIAGEM',
                'ASSUNTO: [Especies de Contratos]',
                'IZABELLA RIZCK DE MAGALHAES CPF: 106.409.796-02, NATHALIA ALVARES CAMPOS',
                'FONTAO CPF: 071.912.256-29, DIEGO DE SOUSA PUGAS CPF: 119.531.786-77',
                'CLEITON CASTRO COIMBRA CPF: 061.507.196-18, HILDA ALVES CASTRO CPF: 247.488.891-87',
                'Certifico que:',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));
        const names = analysis.parts.map((party) => party.name);

        expect(names).toContain('IZABELLA RIZCK DE MAGALHAES');
        expect(names).toContain('CLEITON CASTRO COIMBRA');
        expect(names).toContain('HILDA ALVES CASTRO');
        expect(names).toContain('NATHALIA ALVARES CAMPOS FONTAO');
        expect(names).toContain('DIEGO DE SOUSA PUGAS');
        expect(names.filter((name) => name === 'IZABELLA RIZCK DE MAGALHAES')).toHaveLength(1);
        expect(names.filter((name) => name === 'CLEITON CASTRO COIMBRA')).toHaveLength(1);
        expect(analysis.parts.find((party) => party.name === 'IZABELLA RIZCK DE MAGALHAES')?.type).toBe('EXEQUENTE');
        expect(analysis.parts.find((party) => party.name === 'NATHALIA ALVARES CAMPOS FONTAO')?.type).toBe('ADVOGADO');
        expect(analysis.parts.find((party) => party.name === 'NATHALIA ALVARES CAMPOS FONTAO')?.representedNames).toEqual(['IZABELLA RIZCK DE MAGALHAES']);
        expect(analysis.parts.find((party) => party.name === 'EVANDRO GERALDO XAVIER')?.representedNames).toEqual([
            'CLEITON CASTRO COIMBRA',
            'HILDA ALVES CASTRO',
        ]);

        expect(analysis.documents[0]).toMatchObject({
            documentId: '9186938136',
            label: '1-Acao de Execucao - Izabela Rizck x Cleiton Castro Coimbra (Prolar)',
            documentType: 'Peticao inicial',
        });
        expect(analysis.documents.find((document) => document.documentId === '9186938138')).toMatchObject({
            label: '2-PROCURACAO',
            documentType: 'Procuracao',
        });
    });

    it('extracts eproc lawyers, expert and keeps generic PET1 events as petitions', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 12,
            text: [
                'CAPA PROCESSO',
                'N\u00BA do processo 1044734-36.2025.8.13.0024',
                'Partes e Representantes',
                'AUTOR \tR\u00c9U',
                'THALLYSON JOSE VIANA (128.325.926-51) - Pessoa Física',
                'EVANDRO GERALDO XAVIER MG158592',
                'UNIDAS LOCADORA S.A. (45.736.131/0083-16) - Pessoa Jurídica',
                'Procurador(es):',
                'LEONARDO FIALHO PINTO MG108654',
                'ANDRE JACQUES LUCIANO UCHOA COSTA MG080055',
                'PERITO',
                'ERICK LEMOS TEIXEIRA (101.608.786-16)',
                'Informações Adicionais',
                '-- 2 of 12 --',
                'PAGINA DE SEPARACAO',
                'Evento 21',
                'Evento:',
                'Data:',
                'Usuario:',
                'Processo:',
                'Sequencia Evento:',
                'PETICAO',
                '10/10/2025 18:57:00',
                'MG108654 - LEONARDO FIALHO PINTO - ADVOGADO',
                '1044734-36.2025.8.13.0024/MG',
                '21',
                '-- 3 of 12 --',
                'Contestacao da parte re',
                'Processo 1044734-36.2025.8.13.0024/MG, Evento 21, PET1, Pagina 1',
                '-- 4 of 12 --',
                'PAGINA DE SEPARACAO',
                'Evento 29',
                'Evento:',
                'Data:',
                'Usuario:',
                'Processo:',
                'Sequencia Evento:',
                'CONTRARRAZOES REFER AO EVENTO 24',
                '28/10/2025 20:45:00',
                'MG158592 - EVANDRO GERALDO XAVIER - ADVOGADO',
                '1044734-36.2025.8.13.0024/MG',
                '29',
                '-- 5 of 12 --',
                'Peticao do autor',
                'Processo 1044734-36.2025.8.13.0024/MG, Evento 29, CONTRAZ1, Pagina 1',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.parts.find((party) => party.name === 'THALLYSON JOSE VIANA')).toMatchObject({
            type: 'AUTOR',
            document: '128.325.926-51',
        });
        expect(analysis.parts.find((party) => party.name === 'UNIDAS LOCADORA S.A.')).toMatchObject({
            type: 'REU',
            document: '45.736.131/0083-16',
        });
        expect(analysis.parts.find((party) => party.name === 'EVANDRO GERALDO XAVIER')).toMatchObject({
            type: 'ADVOGADO',
            oab: 'MG158592',
            representedNames: ['THALLYSON JOSE VIANA'],
        });
        expect(analysis.parts.find((party) => party.name === 'LEONARDO FIALHO PINTO')).toMatchObject({
            type: 'ADVOGADO CONTRARIO',
            oab: 'MG108654',
            representedNames: ['UNIDAS LOCADORA S.A.'],
        });
        expect(analysis.parts.find((party) => party.name === 'ERICK LEMOS TEIXEIRA')).toMatchObject({
            type: 'PERITO',
            document: '101.608.786-16',
        });
        expect(analysis.documents.find((document) => document.documentId === '21')?.documentType).toBe('Peticao');
        expect(analysis.documents.find((document) => document.documentId === '29')?.documentType).toBe('Contrarrazoes');
    });
});
