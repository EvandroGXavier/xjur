const GENERIC_SEGMENTS = new Set([
    'documents',
    'documentos',
    'shared documents',
    'compartilhado com todos',
    'adv',
]);

const normalizeSegment = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

export function getOfficeFolderDisplayPath(value?: string | null) {
    if (!value) return '';

    try {
        const parsed = new URL(value);
        const decodedSegments = parsed.pathname
            .split('/')
            .filter(Boolean)
            .map(segment => decodeURIComponent(segment).trim())
            .filter(Boolean);

        const documentsIndex = decodedSegments.findIndex(segment =>
            ['documents', 'documentos', 'shared documents'].includes(normalizeSegment(segment)),
        );

        const relevantSegments =
            documentsIndex >= 0
                ? decodedSegments.slice(documentsIndex + 1)
                : decodedSegments;

        const compactSegments = relevantSegments.filter(
            segment => !GENERIC_SEGMENTS.has(normalizeSegment(segment)),
        );

        const source = compactSegments.length > 0 ? compactSegments : relevantSegments;

        if (source.length >= 2) {
            return source.slice(-2).join('/');
        }

        if (source.length === 1) {
            return source[0];
        }
    } catch {
        return value;
    }

    return value;
}
