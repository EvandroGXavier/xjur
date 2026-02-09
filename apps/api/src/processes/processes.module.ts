import { Module } from '@nestjs/common';
import { ProcessesController } from './processes.controller';
import { ProcessCrawlerService } from './process-crawler.service';
import { PrismaService } from '../prisma.service';
import { ProcessesService } from './processes.service';

import { ProcessPdfService } from './process-pdf.service';

@Module({
    controllers: [ProcessesController],
    providers: [ProcessCrawlerService, ProcessesService, PrismaService, ProcessPdfService],
    exports: [ProcessCrawlerService, ProcessesService, ProcessPdfService]
})
export class ProcessesModule {}
