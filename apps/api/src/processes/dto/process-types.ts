/**
 * Tipos compartilhados do módulo de Processos.
 * Extraídos de processes.service.ts para reutilização nos serviços especializados.
 */

export type TimelineImportReasonCode =
    | 'READY'
    | 'PROCESS_NOT_FOUND'
    | 'PROCESS_NOT_JUDICIAL'
    | 'CNJ_MISSING'
    | 'CNJ_INVALID'
    | 'DATAJUD_DISABLED'
    | 'API_KEY_MISSING'
    | 'PROCESS_UNDER_SEAL'
    | 'PROCESS_NOT_FOUND_AT_CNJ'
    | 'CNJ_UNAVAILABLE';

export type TimelineImportStatus = {
    canImport: boolean;
    reasonCode: TimelineImportReasonCode;
    message: string;
    actionLabel: string;
    checkedAt: string;
    cnj: string | null;
    totalAvailableCount: number;
    importedTimelineCount: number;
    newMovementCount: number;
    lastSourceUpdateAt: string | null;
    sourceSystem: string | null;
    sourceCourt: string | null;
    isProcessSaved: boolean;
};

export type PdfDossierImportResult = {
    success: boolean;
    processId: string;
    originalFileName: string | null;
    importedCount: number;
    skippedCount: number;
    totalCandidateCount: number;
    deadlineCount: number;
    explicitFatalDateCount: number;
    cnjMovementCount: number;
    cnjImportStatus: TimelineImportStatus | null;
    drxSummary: {
        mode: string | null;
        provider: string | null;
        model: string | null;
        answer: string | null;
        error: string | null;
        matchedSkills: Array<{ id: string; name: string }>;
    };
    analysis: {
        cnj: string | undefined;
        pageCount: number;
        textLength: number;
        ocrStatus: string;
        documentCount: number;
        proceduralActCount: number;
    };
    message: string;
};

export interface ImportedProcessPartyInput {
    name: string;
    type?: string;
    document?: string | null;
    rg?: string | null;
    birthDate?: string | null;
    motherName?: string | null;
    fatherName?: string | null;
    profession?: string | null;
    nationality?: string | null;
    civilStatus?: string | null;
    address?: string | null;
    qualificationText?: string | null;
    phone?: string | null;
    email?: string | null;
    oab?: string | null;
    representedNames?: string[] | null;
    isClient?: boolean;
    isOpposing?: boolean;
}

export interface ImportedPartySyncRef {
    id: string;
    contactId: string;
    roleName: string;
    normalizedName: string;
    normalizedDocument?: string | null;
    representedNames: string[];
    pole: 'ACTIVE' | 'PASSIVE' | null;
    isClient: boolean;
    isOpposing: boolean;
}
