import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';
import { ProcessCrawlerService } from './process-crawler.service';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
    constructor(
        private readonly crawlerService: ProcessCrawlerService,
        private readonly processesService: ProcessesService
    ) {}
    
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
