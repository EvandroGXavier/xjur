export interface ImportedParty {
    name: string;
    type: string;
    document?: string;
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
    errors: string[];
};
