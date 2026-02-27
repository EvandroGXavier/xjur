import { Controller, Post, Body, Get, Query, Param, Patch, Delete, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, Res, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ProcessCrawlerService } from './process-crawler.service';
import { ProcessesService } from './processes.service';
import { ProcessPdfService } from './process-pdf.service';
import { ProcessPartiesService } from './process-parties.service';
import { ProcessTimelinesService } from './process-timelines.service';
import { PartyQualificationsService } from './party-qualifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/public.decorator';

@Controller('processes')
@UseGuards(JwtAuthGuard)
export class ProcessesController {
    constructor(
        private readonly crawlerService: ProcessCrawlerService,
        private readonly processesService: ProcessesService,
        private readonly pdfService: ProcessPdfService,
        private readonly partiesService: ProcessPartiesService,
        private readonly timelinesService: ProcessTimelinesService,
        private readonly qualificationsService: PartyQualificationsService,
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
    async findAllRoles(@CurrentUser() user: CurrentUserData) {
        return this.partiesService.findAllRoles(user.tenantId);
    }

    @Post('party-roles')
    async createRole(@Body() body: { name: string; category?: string }, @CurrentUser() user: CurrentUserData) {
        return this.partiesService.createRole(user.tenantId, body.name, body.category);
    }

    @Delete('party-roles/:id')
    async deleteRole(@Param('id') id: string) {
        return this.partiesService.deleteRole(id);
    }

    // --- PARTY QUALIFICATIONS (Qualificações - Cadastrável) ---

    @Get('party-qualifications')
    async findAllQualifications(@CurrentUser() user: CurrentUserData) {
        return this.qualificationsService.findAll(user.tenantId);
    }

    @Post('party-qualifications')
    async createQualification(@Body() body: { name: string }, @CurrentUser() user: CurrentUserData) {
        return this.qualificationsService.create(user.tenantId, body.name);
    }

    @Delete('party-qualifications/:id')
    async deleteQualification(@Param('id') id: string) {
        return this.qualificationsService.delete(id);
    }

    // --- CRUD PROCESS ---

    @Post()
    async create(@Body() body: any, @CurrentUser() user: CurrentUserData) {
        return this.processesService.create({ ...body, tenantId: user.tenantId });
    }

    @Get()
    async findAll(@CurrentUser() user: CurrentUserData, @Query('search') search: string) {
        return this.processesService.findAll({ tenantId: user.tenantId, search });
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
        return this.processesService.findOne(id, user.tenantId);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: CurrentUserData) {
        return this.processesService.update(id, body, user.tenantId);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
        return this.processesService.remove(id, user.tenantId);
    }

    // --- TIMELINES (Andamentos) ---

    @Public()
    @Get('timelines/attachments/:filename')
    async downloadAttachment(@Param('filename') filename: string, @Res() res: Response) {
        const filePath = this.timelinesService.getAttachmentPath(filename);
        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            console.error(`File request failed. Path not found: ${filePath}`);
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }
        
        // Allow iframe
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.setHeader('Content-Disposition', 'inline');
        // CSP to allow embedding
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:* https://localhost:* *");

        // Basic mime type detection
        const ext = filename.split('.').pop().toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === 'pdf') mimeType = 'application/pdf';
        if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
        if (['png'].includes(ext)) mimeType = 'image/png';
        
        res.setHeader('Content-Type', mimeType);

        return res.sendFile(filePath);
    }

    @Post(':id/timelines')
    @UseInterceptors(FilesInterceptor('files'))
    async addTimeline(
        @Param('id') id: string, 
        @Body() body: any,
        @UploadedFiles() files: Array<any>,
        @Req() req: any
    ) {
        const user = req.user ? (req.user.name || req.user.email) : 'sistema';
        return this.timelinesService.create(id, body, files, user);
    }

    @Patch(':id/timelines/:timelineId')
    @UseInterceptors(FilesInterceptor('files'))
    async updateTimeline(
        @Param('timelineId') timelineId: string, 
        @Body() body: any,
        @UploadedFiles() files?: Array<any>
    ) {
        return this.timelinesService.update(timelineId, body, files);
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

    @Post('bulk-action')
    async bulkAction(@Body() dto: any, @CurrentUser() user: CurrentUserData) {
        if (!user || !user.tenantId) throw new Error('User context invalid');
        return this.processesService.bulkAction(user.tenantId, dto);
    }
}
