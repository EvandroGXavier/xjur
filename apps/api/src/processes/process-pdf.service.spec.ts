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
        expect(analysis.parts.find((party) => party.name === 'LEONARDO FIALHO PINTO')?.document).toBeUndefined();
        expect(analysis.parts.find((party) => party.name === 'LEONARDO FIALHO PINTO')?.phone).toBeUndefined();
        expect(analysis.parts.find((party) => party.name === 'ERICK LEMOS TEIXEIRA')?.phone).toBeUndefined();
        expect(analysis.documents.find((document) => document.documentId === '21')?.documentType).toBe('Peticao');
        expect(analysis.documents.find((document) => document.documentId === '29')?.documentType).toBe('Contrarrazoes');
    });

    it('filters noisy deadline candidates and keeps procedural eproc deadlines', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 6,
            text: [
                'CAPA PROCESSO',
                'N\u00BA do processo 1044734-36.2025.8.13.0024',
                '-- 1 of 6 --',
                'PAGINA DE SEPARACAO',
                'Evento 1',
                'Evento:',
                'Data:',
                'Usuario:',
                'Processo:',
                'Sequencia Evento:',
                'PETICAO INICIAL',
                '29/08/2025 20:27:12',
                'MG158592 - EVANDRO GERALDO XAVIER - ADVOGADO',
                '1044734-36.2025.8.13.0024/MG',
                '1',
                '-- 2 of 6 --',
                'Contrato de adesao. O consumidor podera desistir no prazo de 7 (sete) dias fora do estabelecimento comercial.',
                'Garantia contratual de 90 (noventa) dias.',
                'A vistoria possuia validade ate 15/03/2025.',
                'Processo 1044734-36.2025.8.13.0024/MG, Evento 1, INIC1, Pagina 1',
                '-- 3 of 6 --',
                'PAGINA DE SEPARACAO',
                'Evento 57',
                'Evento:',
                'Data:',
                'Usuario:',
                'Processo:',
                'Sequencia Evento:',
                'ATO ORDINATORIO PRATICADO',
                '23/03/2026 14:41:19',
                'F0140939 - VANIA DE OLIVEIRA MATTAR - USUARIO EPROC',
                '1044734-36.2025.8.13.0024/MG',
                '57',
                '-- 4 of 6 --',
                'ATO ORDINATORIO',
                'Procedi, de oficio, a intimacao do perito para que junte o laudo pericial aos autos, no prazo de trinta dias, a contar da realizacao da pericia.',
                'Processo 1044734-36.2025.8.13.0024/MG, Evento 57, ATOORD1, Pagina 1',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.deadlineCandidates).toEqual([
            expect.objectContaining({
                sourceDocumentId: '57',
                deadlineDays: 30,
                documentType: 'Ato ordinatorio',
            }),
        ]);
    });

    it('extracts preview data from the first PJe pages without depending on CNJ consultation', async () => {
        mockedExtractTextFromPdfBuffer
            .mockResolvedValueOnce({
                pageCount: 131,
                text: [
                    '02/07/2025',
                    'Numero: 5063155-40.2024.8.13.0024',
                    'Classe: [CIVEL] CUMPRIMENTO DE SENTENCA',
                    'Orgao julgador: 4a Unidade Jurisdicional Civel - 10o JD da Comarca de Belo Horizonte',
                    'PJe - Processo Judicial Eletronico',
                    'Partes Advogados',
                    'VALERIA ALVES RAMOS MIRANDA (REQUERENTE)',
                    'GILSON MIRANDA PRATA FILHO (REQUERENTE)',
                    'CLEITON CASTRO COIMBRA 06150719618',
                    '(REQUERIDO(A))',
                ].join('\n'),
            })
            .mockResolvedValueOnce({
                pageCount: 131,
                text: [
                    '02/07/2025',
                    'Numero: 5063155-40.2024.8.13.0024',
                    'Classe: [CIVEL] CUMPRIMENTO DE SENTENCA',
                    'Orgao julgador: 4a Unidade Jurisdicional Civel - 10o JD da Comarca de Belo Horizonte',
                    'PJe - Processo Judicial Eletronico',
                    'Partes Advogados',
                    'VALERIA ALVES RAMOS MIRANDA (REQUERENTE)',
                    'GILSON MIRANDA PRATA FILHO (REQUERENTE)',
                    'CLEITON CASTRO COIMBRA 06150719618',
                    '(REQUERIDO(A))',
                    'VALERIA ALVES RAMOS MIRANDA, brasileira, casada, comerciante, CPF: 111.222.333-44, RG MG-12.345.678, residente na Rua Alfa 10, Belo Horizonte/MG, email valeria@example.com, telefone (31) 99999-0001.',
                ].join('\n'),
            });

        const analysis = await service.extractDataFromPdf(Buffer.from('pdf'));

        expect(analysis.courtSystem).toBe('PJe');
        expect(analysis.metadata?.analysisMode).toBe('PREVIEW');
        expect(analysis.metadata?.cnjConsulted).toBe(false);
        expect(analysis.metadata?.processedPageCount).toBe(16);
        expect(analysis.parts.find((party) => party.name === 'CLEITON CASTRO COIMBRA')).toMatchObject({
            type: 'REQUERIDO',
            document: '06150719618',
        });
        expect(analysis.parts.find((party) => party.name === 'VALERIA ALVES RAMOS MIRANDA')).toMatchObject({
            document: '111.222.333-44',
            rg: 'MG-12.345.678',
            civilStatus: 'CASADA',
            profession: 'comerciante',
            email: 'valeria@example.com',
        });
    });

    it('enriches party qualifications from petition text when analyzing the full PDF', async () => {
        mockedExtractTextFromPdfBuffer.mockResolvedValue({
            pageCount: 18,
            text: [
                'Numero: 5012345-67.2025.8.13.0024',
                'Classe: [CIVEL] PROCEDIMENTO COMUM CIVEL',
                'PJe - Processo Judicial Eletronico',
                'Partes Advogados',
                'MARIA DE SOUZA (AUTOR)',
                'JOAO PEREIRA (REU)',
                '-- 1 of 18 --',
                'Num. 9991112223 - Pag. 1',
                'Peticao Inicial',
                'MARIA DE SOUZA, brasileira, solteira, professora, CPF: 123.456.789-10, RG MG-11.222.333, residente na Rua das Flores 100, Belo Horizonte/MG.',
                '-- 2 of 18 --',
                'Num. 9991112224 - Pag. 1',
                'Contestacao',
                'JOAO PEREIRA, brasileiro, casado, comerciante, CPF: 987.654.321-00, residente na Avenida Central 200, Contagem/MG.',
            ].join('\n'),
        });

        const analysis = await service.analyzeFullProcessPdf(Buffer.from('pdf'));

        expect(analysis.parts.find((party) => party.name === 'MARIA DE SOUZA')).toMatchObject({
            document: '123.456.789-10',
            rg: 'MG-11.222.333',
            civilStatus: 'SOLTEIRA',
            profession: 'professora',
        });
        expect(analysis.parts.find((party) => party.name === 'JOAO PEREIRA')).toMatchObject({
            document: '987.654.321-00',
            civilStatus: 'CASADO',
            profession: 'comerciante',
            address: 'Avenida Central 200, Contagem/MG',
        });
    });
});
