import { Injectable } from '@nestjs/common';
import { ProcessPdfImportService } from './process-pdf-import.service';
import { ProcessCnjImportService } from './process-cnj-import.service';

@Injectable()
export class ProcessImportOrchestrationService {
    constructor(
        private readonly pdfImportService: ProcessPdfImportService,
        private readonly cnjImportService: ProcessCnjImportService,
    ) {}

    importProcessPdfAndUpsertProcess(tenantId: string, fileBuffer: Buffer, originalFileName?: string | null) {
        return this.pdfImportService.importProcessPdfAndUpsertProcess(tenantId, fileBuffer, originalFileName);
    }

    importProcessPdfDossier(id: string, tenantId: string, fileBuffer: Buffer, originalFileName?: string | null) {
        return this.pdfImportService.importProcessPdfDossier(id, tenantId, fileBuffer, originalFileName);
    }

    getCnjTimelineImportStatus(id: string, tenantId: string) {
        return this.cnjImportService.getCnjTimelineImportStatus(id, tenantId);
    }

    importCnjTimelines(id: string, tenantId: string) {
        return this.cnjImportService.importCnjTimelines(id, tenantId);
    }

    getOptionalCnjTimelineStatus(id: string, tenantId: string) {
        return this.cnjImportService.getOptionalCnjTimelineStatus(id, tenantId);
    }
}
