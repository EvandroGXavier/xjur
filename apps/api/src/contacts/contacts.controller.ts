import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';
import { CreateRelationTypeDto, CreateContactRelationDto } from './dto/relation.dto';
import { CreateAssetTypeDto, CreateContactAssetDto, UpdateContactAssetDto } from './dto/asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Post()
  create(@Body() createContactDto: CreateContactDto, @CurrentUser() user: CurrentUserData) {
    console.log('Controller User:', user);
    if (!user || !user.tenantId) {
       console.error('User or tenantId missing in controller!');
       throw new Error('User context invalid');
    }
    return this.contactsService.create(createContactDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query('search') search?: string) {
    // console.log('GET /contacts - User:', user);
    if (!user || !user.tenantId) {
      console.error('User or tenantId missing in GET /contacts');
      throw new Error('User context invalid');
    }
    return this.contactsService.findAll(user.tenantId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactsService.update(id, updateContactDto);
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

  // Enrichment endpoints
  @Get('enrich/cnpj')
  async enrichCNPJ(@Query('cnpj') cnpj: string) {
    return this.enrichmentService.consultCNPJ(cnpj);
  }

  @Get('enrich/cep')
  async enrichCEP(@Query('cep') cep: string) {
    return this.enrichmentService.consultCEP(cep);
  }
}

