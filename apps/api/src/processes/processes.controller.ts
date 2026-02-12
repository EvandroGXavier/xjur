import { Controller, Post, Body, Get, Query, Param, Patch, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProcessCrawlerService } from './process-crawler.service';
import { ProcessesService } from './processes.service';
import { ProcessPdfService } from './process-pdf.service';
import { ProcessPartiesService } from './process-parties.service';
import { ProcessTimelinesService } from './process-timelines.service';

@Controller('processes')
export class ProcessesController {
    constructor(
        private readonly crawlerService: ProcessCrawlerService,
        private readonly processesService: ProcessesService,
        private readonly pdfService: ProcessPdfService,
        private readonly partiesService: ProcessPartiesService,
        private readonly timelinesService: ProcessTimelinesService,
    ) {}
    
    // --- IMPORT VIA PDF ---

    @Post('import-pdf')
    @UseInterceptors(FileInterceptor('file'))
    async importPdf(@UploadedFile() file: any) {
        if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
        return this.pdfService.extractDataFromPdf(file.buffer);
    }

    // --- PARTY ROLES (Tipos de Parte - Cadastrável) ---

    @Get('party-roles')
    async findAllRoles() {
        // TODO: extrair tenantId do token JWT
        const tenant = await this.processesService.getFirstTenantId();
        return this.partiesService.findAllRoles(tenant);
    }

    @Post('party-roles')
    async createRole(@Body() body: { name: string; category?: string }) {
        const tenant = await this.processesService.getFirstTenantId();
        return this.partiesService.createRole(tenant, body.name, body.category);
    }

    @Delete('party-roles/:id')
    async deleteRole(@Param('id') id: string) {
        return this.partiesService.deleteRole(id);
    }

    // --- CRUD PROCESS ---

    @Post()
    async create(@Body() body: any) {
        return this.processesService.create(body);
    }

    @Get()
    async findAll(@Query('search') search: string) {
        return this.processesService.findAll({ search });
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.processesService.findOne(id);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        return this.processesService.update(id, body);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.processesService.remove(id);
    }

    // --- TIMELINES (Andamentos) ---

    @Post(':id/timelines')
    async addTimeline(@Param('id') id: string, @Body() body: any) {
        return this.timelinesService.create(id, body);
    }

    @Patch(':id/timelines/:timelineId')
    async updateTimeline(@Param('timelineId') timelineId: string, @Body() body: any) {
        return this.timelinesService.update(timelineId, body);
    }

    @Delete(':id/timelines/:timelineId')
    async removeTimeline(@Param('timelineId') timelineId: string) {
        return this.timelinesService.remove(timelineId);
    }

    // --- PROCESS PARTIES (Partes do Processo) ---

    @Get(':id/parties')
    async findParties(@Param('id') id: string) {
        return this.partiesService.findByProcess(id);
    }

    @Post(':id/parties')
    async addParty(@Param('id') processId: string, @Body() body: any) {
        return this.partiesService.addParty({ processId, ...body });
    }

    @Patch(':id/parties/:partyId')
    async updateParty(@Param('partyId') partyId: string, @Body() body: any) {
        return this.partiesService.updateParty(partyId, body);
    }

    @Delete(':id/parties/:partyId')
    async removeParty(@Param('partyId') partyId: string) {
        return this.partiesService.removeParty(partyId);
    }

    @Post(':id/parties/quick-contact')
    async quickContactAndParty(@Param('id') processId: string, @Body() body: any) {
        return this.partiesService.quickContactAndParty({ processId, ...body });
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
