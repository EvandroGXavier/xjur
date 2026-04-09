export interface ImportedParty {
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
    phone?: string;
    email?: string;
    oab?: string;
    representedNames?: string[];
    isClient?: boolean;
    isOpposing?: boolean;
}

export type CnjTimelineImportStatus = {
    canImport: boolean;
    reasonCode: string;
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
    processId?: string;
    processAction?: 'CREATED' | 'UPDATED';
    importedCount: number;
    skippedCount?: number;
    explicitFatalDateCount?: number;
    cnjMovementCount?: number;
    message?: string;
    drxSummary?: {
        answer?: string | null;
        matchedSkills?: Array<{ id?: string; name?: string }>;
    };
    errors: string[];
};

export type PdfPreviewImportResult = {
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
    metadata?: {
        analysisMode?: string;
        processedPageCount?: number;
        qualificationSourceCount?: number;
        cnjConsulted?: boolean;
        importStrategy?: string;
        pageCount?: number;
    };
    parts: ImportedParty[];
    textLength: number;
    pageCount: number;
};
