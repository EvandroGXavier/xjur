import { Module } from '@nestjs/common';
import { ProcessesController } from './processes.controller';
import { ProcessCrawlerService } from './process-crawler.service';
import { PrismaService } from '../prisma.service';
import { ProcessesService } from './processes.service';
import { ProcessPdfService } from './process-pdf.service';
import { ProcessPartiesService } from './process-parties.service';
import { ProcessTimelinesService } from './process-timelines.service';

@Module({
    controllers: [ProcessesController],
    providers: [ProcessCrawlerService, ProcessesService, PrismaService, ProcessPdfService, ProcessPartiesService, ProcessTimelinesService],
    exports: [ProcessCrawlerService, ProcessesService, ProcessPdfService, ProcessPartiesService, ProcessTimelinesService]
})
export class ProcessesModule {}
