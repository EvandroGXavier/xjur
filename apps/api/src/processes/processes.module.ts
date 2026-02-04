import { Module } from '@nestjs/common';
import { ProcessesController } from './processes.controller';
import { ProcessCrawlerService } from './process-crawler.service';
import { PrismaService } from '../prisma.service';
import { ProcessesService } from './processes.service';

@Module({
    controllers: [ProcessesController],
    providers: [ProcessCrawlerService, ProcessesService, PrismaService],
    exports: [ProcessCrawlerService, ProcessesService]
})
export class ProcessesModule {}
