import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsImportService } from './contacts-import.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';
import { CreateRelationTypeDto, CreateContactRelationDto } from './dto/relation.dto';
import { CreateAssetTypeDto, CreateContactAssetDto, UpdateContactAssetDto } from './dto/asset.dto';
import { CreateContactContractDto, UpdateContactContractDto } from './dto/contract.dto';
import { ImportContactsDto } from './dto/import-contact.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Response } from 'express';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly enrichmentService: EnrichmentService,
    private readonly contactsImportService: ContactsImportService,
  ) {}

  @Post('import/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return this.contactsImportService.parseFile(file);
  }

  @Post('import/execute')
  executeImport(@Body() dto: ImportContactsDto, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) {
       throw new Error('User context invalid');
    }
    return this.contactsImportService.executeImport(user.tenantId, dto);
  }

  @Post()
  async create(@Body() createContactDto: CreateContactDto, @CurrentUser() user: CurrentUserData) {
    console.log('--- CREATE CONTACT PAYLOAD ---');
    console.dir(createContactDto, { depth: null });
    
    if (!user || !user.tenantId) {
       console.error('User or tenantId missing in controller!');
       throw new Error('User context invalid');
    }
    
    try {
       const result = await this.contactsService.create(createContactDto, user.tenantId);
       console.log('--- CREATE CONTACT SUCCESS ---');
       return result;
    } catch (err) {
       console.error('--- CREATE CONTACT FAILED ---');
       console.error(err);
       throw err;
    }
  }

  @Get()
  findAll(
      @CurrentUser() user: CurrentUserData, 
      @Query('search') search?: string,
      @Query('includedTags') includedTags?: string,
      @Query('excludedTags') excludedTags?: string,
      @Query('active') active?: string,
  ) {
    if (!user || !user.tenantId) {
      console.error('User or tenantId missing in GET /contacts');
      throw new Error('User context invalid');
    }
    return this.contactsService.findAll(user.tenantId, search, includedTags, excludedTags, active);
  }

  @Get('lookup/exact')
  async lookupExact(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.contactsService.lookupContactExact(user.tenantId, query);
  }

  @Post('cleanup')
  async cleanupContacts(@CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.contactsService.cleanupContacts(user.tenantId);
  }

  // Enrichment endpoints
  @Get('enrich/cnpj')
  async enrichCNPJ(@Query('cnpj') cnpj: string) {
    return this.enrichmentService.consultCNPJ(cnpj);
  }

  @Get('enrich/cep')
  async enrichCEP(@Query('cep') cep: string) {
    return this.enrichmentService.consultCEP(cep);
  }

  @Post('bulk-action')
  async bulkAction(@Body() dto: any, @CurrentUser() user: CurrentUserData) {
    if (!user || !user.tenantId) throw new Error('User context invalid');
    return this.contactsService.bulkAction(user.tenantId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    console.log('--- UPDATE CONTACT PAYLOAD ---', id);
    console.dir(updateContactDto, { depth: null });
    
    try {
       const result = await this.contactsService.update(id, updateContactDto);
       console.log('--- UPDATE CONTACT SUCCESS ---');
       return result;
    } catch (err) {
       console.error('--- UPDATE CONTACT FAILED ---');
       console.error(err);
       throw err;
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  // Address management endpoints
  @Post(':id/addresses')
  addAddress(@Param('id') id: string, @Body() createAddressDto: CreateAddressDto) {
    return this.contactsService.addAddress(id, createAddressDto);
  }

  @Patch(':id/addresses/:addressId')
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto
  ) {
    return this.contactsService.updateAddress(id, addressId, updateAddressDto);
  }

  @Delete(':id/addresses/:addressId')
  removeAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.contactsService.removeAddress(id, addressId);
  }

  // Additional Contact management endpoints
  @Post(':id/additional-contacts')
  addAdditionalContact(@Param('id') id: string, @Body() createAdditionalContactDto: CreateAdditionalContactDto) {
    return this.contactsService.addAdditionalContact(id, createAdditionalContactDto);
  }

  @Patch(':id/additional-contacts/:contactId')
  updateAdditionalContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() updateAdditionalContactDto: UpdateAdditionalContactDto
  ) {
    return this.contactsService.updateAdditionalContact(id, contactId, updateAdditionalContactDto);
  }

  @Delete(':id/additional-contacts/:contactId')
  removeAdditionalContact(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.contactsService.removeAdditionalContact(id, contactId);
  }

  @Get(':id/attachments/:filename')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const attachment = await this.contactsService.getAttachmentForContact(
      id,
      user.tenantId,
      filename,
    );
    const fs = require('fs');

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ message: 'Arquivo nao encontrado' });
    }

    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.originalName || attachment.fileName}"`,
    );
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' http://localhost:* https://localhost:* *",
    );

    return res.sendFile(attachment.filePath);
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('attachments'))
  uploadAttachments(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @UploadedFiles() files: Array<any>,
  ) {
    return this.contactsService.uploadAttachments(id, user.tenantId, files);
  }

  @Delete(':id/attachments/:filename')
  deleteAttachment(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.deleteAttachment(id, user.tenantId, filename);
  }

  // Relations Endpoints
  @Get('relations/types')
  getRelationTypes(@CurrentUser() user: CurrentUserData) {
      return this.contactsService.getRelationTypes(user.tenantId);
  }

  @Post('relations/types')
  createRelationType(@Body() dto: CreateRelationTypeDto, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.createRelationType(user.tenantId, dto);
  }

  @Get(':id/relations')
  getContactRelations(@Param('id') id: string) {
      return this.contactsService.getContactRelations(id);
  }

  @Post(':id/relations')
  createContactRelation(
      @Param('id') id: string, 
      @Body() dto: CreateContactRelationDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.createContactRelation(user.tenantId, id, dto);
  }

  @Delete(':id/relations/:relationId')
  removeContactRelation(
      @Param('relationId') relationId: string,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.removeContactRelation(user.tenantId, relationId);
  }

  // Assets Endpoints
  @Get('assets/types')
  getAssetTypes(@CurrentUser() user: CurrentUserData) {
      return this.contactsService.getAssetTypes(user.tenantId);
  }

  @Post('assets/types')
  createAssetType(@Body() dto: CreateAssetTypeDto, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.createAssetType(user.tenantId, dto);
  }

  @Get(':id/assets')
  getContactAssets(@Param('id') id: string) {
      return this.contactsService.getContactAssets(id);
  }

  @Post(':id/assets')
  createContactAsset(
      @Param('id') id: string,
      @Body() dto: CreateContactAssetDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.createContactAsset(user.tenantId, id, dto);
  }

  @Patch(':id/assets/:assetId')
  updateContactAsset(
      @Param('assetId') assetId: string,
      @Body() dto: UpdateContactAssetDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.updateContactAsset(user.tenantId, assetId, dto);
  }

  @Delete(':id/assets/:assetId')
  removeContactAsset(
      @Param('assetId') assetId: string,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.removeContactAsset(user.tenantId, assetId);
  }

  // Contracts Endpoints
  @Get(':id/contracts')
  getContactContracts(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.getContactContracts(id, user.tenantId);
  }

  @Post(':id/contracts')
  createContactContract(
    @Param('id') id: string,
    @Body() dto: CreateContactContractDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.createContactContract(user.tenantId, id, dto);
  }

  @Patch(':id/contracts/:contractId')
  updateContactContract(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() dto: UpdateContactContractDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.updateContactContract(user.tenantId, id, contractId, dto);
  }

  @Delete(':id/contracts/:contractId')
  removeContactContract(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.removeContactContract(user.tenantId, id, contractId);
  }

  @Get(':id/financial-records')
  getContactFinancialRecords(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.getContactFinancialRecords(id, user.tenantId);
  }
}
