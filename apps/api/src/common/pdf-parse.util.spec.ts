describe('extractTextFromPdfBuffer', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('supports the pdf-parse v2 export shape', async () => {
        const getText = jest.fn().mockResolvedValue({
            text: 'Numero: 5057484-07.2022.8.13.0024',
            total: 12,
        });
        const destroy = jest.fn().mockResolvedValue(undefined);
        const PDFParse = jest.fn(function (this: any) {
            return undefined;
        }) as any;
        PDFParse.prototype.getText = getText;
        PDFParse.prototype.destroy = destroy;

        jest.doMock('pdf-parse', () => ({ PDFParse }));

        const { extractTextFromPdfBuffer } = require('./pdf-parse.util');
        const result = await extractTextFromPdfBuffer(Buffer.from('pdf'));

        expect(PDFParse).toHaveBeenCalledWith({ data: expect.any(Buffer) });
        expect(getText).toHaveBeenCalledWith({ pageJoiner: '\n-- page_number of total_number --\n' });
        expect(destroy).toHaveBeenCalled();
        expect(result).toEqual({
            text: 'Numero: 5057484-07.2022.8.13.0024',
            pageCount: 12,
        });
    });

    it('supports the legacy pdf-parse function export', async () => {
        const legacyParser = jest.fn().mockResolvedValue({
            text: 'Texto legado',
            numpages: 3,
        });

        jest.doMock('pdf-parse', () => legacyParser);

        const { extractTextFromPdfBuffer } = require('./pdf-parse.util');
        const result = await extractTextFromPdfBuffer(Buffer.from('pdf'));

        expect(legacyParser).toHaveBeenCalledWith(expect.any(Buffer));
        expect(result).toEqual({
            text: 'Texto legado',
            pageCount: 3,
        });
    });
});
