import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ProcessesController } from './processes.controller';
import { ProcessCrawlerService } from './process-crawler.service';
import { PrismaService } from '../prisma.service';
import { ProcessesService } from './processes.service';
import { ProcessPdfService } from './process-pdf.service';
import { ProcessPartiesService } from './process-parties.service';
import { ProcessTimelinesService } from './process-timelines.service';
import { PartyQualificationsService } from './party-qualifications.service';
import { ProcessIntegrationsService } from './process-integrations.service';
import { MicrosoftGraphService } from '../integrations/microsoft-graph.service';
import { DrxClawModule } from '../drx-claw/drx-claw.module';
import { ProcessNormalizationService } from './process-normalization.service';
import { ProcessPdfImportService } from './process-pdf-import.service';
import { ProcessCnjImportService } from './process-cnj-import.service';
import { ProcessImportOrchestrationService } from './process-import-orchestration.service';

@Module({
    imports: [
        DrxClawModule,
        MulterModule.register({
            limits: { fileSize: 500 * 1024 * 1024 } // 500MB
        })
    ],
    controllers: [ProcessesController],
    providers: [
        ProcessCrawlerService,
        ProcessesService,
        PrismaService,
        ProcessPdfService,
        ProcessPartiesService,
        ProcessTimelinesService,
        PartyQualificationsService,
        ProcessIntegrationsService,
        MicrosoftGraphService,
        ProcessNormalizationService,
        ProcessCnjImportService,
        ProcessPdfImportService,
        ProcessImportOrchestrationService,
    ],
    exports: [
        ProcessCrawlerService,
        ProcessesService,
        ProcessPdfService,
        ProcessPartiesService,
        ProcessTimelinesService,
        PartyQualificationsService,
        ProcessIntegrationsService,
        ProcessNormalizationService,
        ProcessCnjImportService,
        ProcessPdfImportService,
        ProcessImportOrchestrationService,
    ]
})
export class ProcessesModule {}
