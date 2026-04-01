export type ParsedPdfText = {
    text: string;
    pageCount: number;
};

type LegacyPdfParseFn = (buffer: Buffer) => Promise<any>;

type ModernPdfParserInstance = {
    getText: (params?: any) => Promise<any>;
    destroy?: () => Promise<void>;
};

type ModernPdfParseCtor = new (options: { data: Buffer }) => ModernPdfParserInstance;

const DEFAULT_PAGE_JOINER = '\n-- page_number of total_number --\n';

function coercePdfText(result: any) {
    if (typeof result === 'string') {
        return result;
    }

    if (result && typeof result.text === 'string') {
        return result.text;
    }

    if (Array.isArray(result?.pages)) {
        return result.pages
            .map((page: any) => {
                if (typeof page === 'string') return page;
                if (typeof page?.text === 'string') return page.text;
                return '';
            })
            .join('\n');
    }

    return '';
}

function coercePageCount(infoResult: any) {
    const direct =
        Number(infoResult?.total ?? infoResult?.totalPages ?? infoResult?.numpages ?? 0) ||
        Number(infoResult?.info?.Pages ?? 0);
    if (direct > 0) {
        return direct;
    }

    if (Array.isArray(infoResult?.pages)) {
        return infoResult.pages.length;
    }

    return 0;
}

function isModernPdfParseCtor(candidate: any): candidate is ModernPdfParseCtor {
    return typeof candidate === 'function' && typeof candidate.prototype?.getText === 'function';
}

function isLegacyPdfParseFn(candidate: any): candidate is LegacyPdfParseFn {
    return typeof candidate === 'function' && typeof candidate.prototype?.getText !== 'function';
}

function resolveLegacyParser(pdfModule: any) {
    const candidates = [pdfModule, pdfModule?.default];
    return candidates.find((candidate) => isLegacyPdfParseFn(candidate)) || null;
}

function resolveModernParser(pdfModule: any) {
    const candidates = [pdfModule?.PDFParse, pdfModule?.default?.PDFParse, pdfModule, pdfModule?.default];
    return candidates.find((candidate) => isModernPdfParseCtor(candidate)) || null;
}

export async function extractTextFromPdfBuffer(fileBuffer: Buffer): Promise<ParsedPdfText> {
    const pdfModule = require('pdf-parse');
    const legacyParser = resolveLegacyParser(pdfModule);

    if (legacyParser) {
        const result = await legacyParser(fileBuffer);
        return {
            text: coercePdfText(result),
            pageCount: coercePageCount(result),
        };
    }

    const ModernParser = resolveModernParser(pdfModule);
    if (ModernParser) {
        const parser = new ModernParser({ data: fileBuffer });
        try {
            const result = await parser.getText({ pageJoiner: DEFAULT_PAGE_JOINER });
            return {
                text: coercePdfText(result),
                pageCount: coercePageCount(result),
            };
        } finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy().catch(() => undefined);
            }
        }
    }

    throw new Error('Unsupported pdf-parse module shape.');
}
