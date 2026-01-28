import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
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
    return this.contactsService.create(createContactDto, user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.contactsService.findAll(user.tenantId);
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

