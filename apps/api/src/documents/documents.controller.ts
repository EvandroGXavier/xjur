import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.create(createDocumentDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.findAll(user.tenantId);
  }

  @Get('settings')
  getSettings() {
    return this.documentsService.getSettings();
  }

  @Put('settings/:key')
  updateSetting(@Param('key') key: string, @Body('value') value: string) {
    return this.documentsService.updateSetting(key, value);
  }

  // --- TEMPLATES / BIBLIOTECA ---

  @Get('variables')
  getVariables() {
    return this.documentsService.getVariables();
  }

  @Post('settings/seed')
  seedDefaults(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.seedDefaults(user.tenantId);
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.createTemplate(dto, user.tenantId);
  }

  @Get('templates')
  findAllTemplates(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.findAllTemplates(user.tenantId);
  }

  @Get('templates/:id')
  findTemplate(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.findTemplate(id, user.tenantId);
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: CreateTemplateDto, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.updateTemplate(id, dto, user.tenantId);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.deleteTemplate(id, user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.update(id, updateDocumentDto, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.remove(id, user.tenantId);
  }
}
