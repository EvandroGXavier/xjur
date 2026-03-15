import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
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

  private getTenantId(user: CurrentUserData) {
    if (!user?.tenantId) {
      throw new UnauthorizedException('Contexto do usuario invalido');
    }

    return user.tenantId;
  }

  @Post('import/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return this.contactsImportService.parseFile(file);
  }

  @Post('import/execute')
  executeImport(@Body() dto: ImportContactsDto, @CurrentUser() user: CurrentUserData) {
    return this.contactsImportService.executeImport(this.getTenantId(user), dto);
  }

  @Post()
  async create(@Body() createContactDto: CreateContactDto, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.create(createContactDto, this.getTenantId(user));
  }

  @Get()
  findAll(
      @CurrentUser() user: CurrentUserData, 
      @Query('search') search?: string,
      @Query('includedTags') includedTags?: string,
      @Query('excludedTags') excludedTags?: string,
      @Query('active') active?: string,
  ) {
    return this.contactsService.findAll(this.getTenantId(user), search, includedTags, excludedTags, active);
  }

  @Get('lookup/exact')
  async lookupExact(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.contactsService.lookupContactExact(this.getTenantId(user), query);
  }

  @Post('cleanup')
  async cleanupContacts(@CurrentUser() user: CurrentUserData) {
    return this.contactsService.cleanupContacts(this.getTenantId(user));
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
    return this.contactsService.bulkAction(this.getTenantId(user), dto);
  }

  @Get(':id/insights')
  getInsights(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.getContactInsights(id, this.getTenantId(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.findOne(id, this.getTenantId(user));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.update(id, updateContactDto, this.getTenantId(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.remove(id, this.getTenantId(user));
  }

  // Address management endpoints
  @Post(':id/addresses')
  addAddress(
    @Param('id') id: string,
    @Body() createAddressDto: CreateAddressDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.addAddress(id, createAddressDto, this.getTenantId(user));
  }

  @Patch(':id/addresses/:addressId')
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.updateAddress(id, addressId, updateAddressDto, this.getTenantId(user));
  }

  @Delete(':id/addresses/:addressId')
  removeAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.removeAddress(id, addressId, this.getTenantId(user));
  }

  // Additional Contact management endpoints
  @Post(':id/additional-contacts')
  addAdditionalContact(
    @Param('id') id: string,
    @Body() createAdditionalContactDto: CreateAdditionalContactDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.addAdditionalContact(id, createAdditionalContactDto, this.getTenantId(user));
  }

  @Patch(':id/additional-contacts/:contactId')
  updateAdditionalContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() updateAdditionalContactDto: UpdateAdditionalContactDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.updateAdditionalContact(
      id,
      contactId,
      updateAdditionalContactDto,
      this.getTenantId(user),
    );
  }

  @Delete(':id/additional-contacts/:contactId')
  removeAdditionalContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.removeAdditionalContact(id, contactId, this.getTenantId(user));
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
      return this.contactsService.getRelationTypes(this.getTenantId(user));
  }

  @Post('relations/types')
  createRelationType(@Body() dto: CreateRelationTypeDto, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.createRelationType(this.getTenantId(user), dto);
  }

  @Get(':id/relations')
  getContactRelations(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.getContactRelations(id, this.getTenantId(user));
  }

  @Post(':id/relations')
  createContactRelation(
      @Param('id') id: string, 
      @Body() dto: CreateContactRelationDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.createContactRelation(this.getTenantId(user), id, dto);
  }

  @Delete(':id/relations/:relationId')
  removeContactRelation(
      @Param('relationId') relationId: string,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.removeContactRelation(this.getTenantId(user), relationId);
  }

  // Assets Endpoints
  @Get('assets/types')
  getAssetTypes(@CurrentUser() user: CurrentUserData) {
      return this.contactsService.getAssetTypes(this.getTenantId(user));
  }

  @Post('assets/types')
  createAssetType(@Body() dto: CreateAssetTypeDto, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.createAssetType(this.getTenantId(user), dto);
  }

  @Get(':id/assets')
  getContactAssets(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
      return this.contactsService.getContactAssets(id, this.getTenantId(user));
  }

  @Post(':id/assets')
  createContactAsset(
      @Param('id') id: string,
      @Body() dto: CreateContactAssetDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.createContactAsset(this.getTenantId(user), id, dto);
  }

  @Patch(':id/assets/:assetId')
  updateContactAsset(
      @Param('assetId') assetId: string,
      @Body() dto: UpdateContactAssetDto,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.updateContactAsset(this.getTenantId(user), assetId, dto);
  }

  @Delete(':id/assets/:assetId')
  removeContactAsset(
      @Param('assetId') assetId: string,
      @CurrentUser() user: CurrentUserData
  ) {
      return this.contactsService.removeContactAsset(this.getTenantId(user), assetId);
  }

  // Contracts Endpoints
  @Get(':id/contracts')
  getContactContracts(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.getContactContracts(id, this.getTenantId(user));
  }

  @Post(':id/contracts')
  createContactContract(
    @Param('id') id: string,
    @Body() dto: CreateContactContractDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.createContactContract(this.getTenantId(user), id, dto);
  }

  @Patch(':id/contracts/:contractId')
  updateContactContract(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() dto: UpdateContactContractDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.updateContactContract(this.getTenantId(user), id, contractId, dto);
  }

  @Delete(':id/contracts/:contractId')
  removeContactContract(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.contactsService.removeContactContract(this.getTenantId(user), id, contractId);
  }

  @Get(':id/financial-records')
  getContactFinancialRecords(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.contactsService.getContactFinancialRecords(id, this.getTenantId(user));
  }
}
