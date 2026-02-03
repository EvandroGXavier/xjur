import { Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createContactDto: CreateContactDto, tenantId: string) {
    try {
      console.log('Creating contact:', { ...createContactDto, tenantId });
      
      // Remove addresses do payload pois devem ser criados separadamente
      const { addresses, ...contactData } = createContactDto as any;
      
      return await this.prisma.contact.create({
        data: {
          ...contactData,
          tenantId,
        },
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  findAll(tenantId: string) {
    return this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.contact.findUnique({
      where: { id },
      include: {
        addresses: true,
        additionalContacts: true,
      },
    });
  }

  update(id: string, updateContactDto: UpdateContactDto) {
    return this.prisma.contact.update({
      where: { id },
      data: updateContactDto,
    });
  }

  remove(id: string) {
    return this.prisma.contact.delete({
      where: { id },
    });
  }

  // Address management methods
  addAddress(contactId: string, createAddressDto: CreateAddressDto) {
    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        contactId,
      },
    });
  }

  updateAddress(contactId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    return this.prisma.address.update({
      where: { 
        id: addressId,
        contactId, // Ensure the address belongs to the contact
      },
      data: updateAddressDto,
    });
  }

  removeAddress(contactId: string, addressId: string) {
    return this.prisma.address.delete({
      where: { 
        id: addressId,
        contactId, // Ensure the address belongs to the contact
      },
    });
  }

  // Additional Contact management methods
  addAdditionalContact(contactId: string, createAdditionalContactDto: CreateAdditionalContactDto) {
    return this.prisma.additionalContact.create({
      data: {
        ...createAdditionalContactDto,
        contactId,
      },
    });
  }

  updateAdditionalContact(contactId: string, additionalContactId: string, updateAdditionalContactDto: UpdateAdditionalContactDto) {
    return this.prisma.additionalContact.update({
      where: { 
        id: additionalContactId,
        contactId, 
      },
      data: updateAdditionalContactDto,
    });
  }

  removeAdditionalContact(contactId: string, additionalContactId: string) {
    return this.prisma.additionalContact.delete({
      where: { 
        id: additionalContactId,
        contactId,
      },
    });
  }

  // Relations Management
  async getRelationTypes(tenantId: string) {
    return this.prisma.relationType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createRelationType(tenantId: string, data: any) {
    return this.prisma.relationType.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async getContactRelations(contactId: string) {
    // Busca relações onde o contato é ORIGEM
    const fromRelations = await this.prisma.contactRelation.findMany({
      where: { fromContactId: contactId },
      include: {
        toContact: { select: { id: true, name: true, personType: true } },
        relationType: true,
      },
    });

    // Busca relações onde o contato é DESTINO (Inversas)
    const toRelations = await this.prisma.contactRelation.findMany({
      where: { toContactId: contactId },
      include: {
        fromContact: { select: { id: true, name: true, personType: true } },
        relationType: true,
      },
    });

    // Formata para o frontend
    const formattedFrom = fromRelations.map(r => ({
      id: r.id,
      relatedContact: r.toContact,
      type: r.relationType.name,
      isInverse: false,
    }));

    const formattedTo = toRelations.map(r => ({
      id: r.id,
      relatedContact: r.fromContact,
      type: r.relationType.isBilateral 
        ? r.relationType.name // Se bilateral, o nome é o mesmo (Sócio)
        : (r.relationType.reverseName || r.relationType.name + ' (Inverso)'), // Se unilateral, usa o reverso (Filho)
      isInverse: true,
    }));

    return [...formattedFrom, ...formattedTo];
  }

  async createContactRelation(tenantId: string, fromContactId: string, data: any) {
    return this.prisma.contactRelation.create({
      data: {
        tenantId,
        fromContactId,
        toContactId: data.toContactId,
        relationTypeId: data.relationTypeId,
      },
    });
  }

  async removeContactRelation(tenantId: string, relationId: string) {
    // Security check: ensure tenant owns relation
    const relation = await this.prisma.contactRelation.findUnique({ where: { id: relationId } });
    if (!relation || relation.tenantId !== tenantId) {
        throw new Error('Relation not found or access denied');
    }
    return this.prisma.contactRelation.delete({
      where: { id: relationId },
    });
  }

  // --- Assets Management ---

  async getAssetTypes(tenantId: string) {
    return this.prisma.assetType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createAssetType(tenantId: string, data: any) {
    return this.prisma.assetType.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async getContactAssets(contactId: string) {
    return this.prisma.contactAsset.findMany({
      where: { contactId },
      include: {
        assetType: true,
      },
      orderBy: { acquisitionDate: 'desc' },
    });
  }

  async createContactAsset(tenantId: string, contactId: string, data: any) {
    return this.prisma.contactAsset.create({
      data: {
        ...data,
        contactId,
        tenantId,
      },
    });
  }

  async updateContactAsset(tenantId: string, assetId: string, data: any) {
    const asset = await this.prisma.contactAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.tenantId !== tenantId) {
       throw new Error('Asset not found or access denied');
    }
    return this.prisma.contactAsset.update({
      where: { id: assetId },
      data,
    });
  }

  async removeContactAsset(tenantId: string, assetId: string) {
    const asset = await this.prisma.contactAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.tenantId !== tenantId) {
       throw new Error('Asset not found or access denied');
    }
    return this.prisma.contactAsset.delete({
      where: { id: assetId },
    });
  }
}

