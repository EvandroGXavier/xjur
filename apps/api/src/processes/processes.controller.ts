import { Controller, Post, Body, Get, UseGuards, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProcessCrawlerService } from './process-crawler.service';
import { ProcessesService } from './processes.service';
import { ProcessPdfService } from './process-pdf.service';

@Controller('processes')
export class ProcessesController {
    constructor(
        private readonly crawlerService: ProcessCrawlerService,
        private readonly processesService: ProcessesService,
        private readonly pdfService: ProcessPdfService
    ) {}
    
    // --- IMPORT VIA PDF ---

    @Post('import-pdf')
    @UseInterceptors(FileInterceptor('file'))
    async importPdf(@UploadedFile() file: any) { // using any for multer file to avoid type issues for now
        if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
        return this.pdfService.extractDataFromPdf(file.buffer);
    }

    // --- CRUD ---

    @Post()
    async create(@Body() body: any) {
        return this.processesService.create(body);
    }

    @Get()
    async findAll(@Query('search') search: string) {
        return this.processesService.findAll({ search });
    }

    // --- AUTOMATION ---

    @Post('automator/cnj')
    async crawlByCnj(@Body() body: { cnj: string }) {
        return this.crawlerService.crawlByCnj(body.cnj);
    }

    @Post('automator/search')
    async search(@Body() body: { term: string }) {
        return this.crawlerService.search(body.term);
    }
}
