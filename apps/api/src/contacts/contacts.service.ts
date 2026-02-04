import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dr-x/database';
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
      // Remove addresses e extrai campos específicos
      const { 
        addresses, 
        cpf, rg, birthDate, // PF fields
        cnpj, companyName, stateRegistration, // PJ fields
        ...commonData 
      } = createContactDto as any;
      
      const personType = commonData.personType || 'PF';
      const document = personType === 'PF' ? cpf : cnpj; // Normaliza documento principal

      // Prepara dados aninhados
      const pfData = personType === 'PF' ? {
         create: {
            tenantId,
            cpf,
            rg,
            birthDate: birthDate ? new Date(birthDate) : undefined,
         }
      } : undefined;

      const pjData = personType === 'PJ' ? {
         create: {
            tenantId,
            cnpj,
            companyName,
            stateReg: stateRegistration,
         }
      } : undefined;

      // Criação Transacional
      return await this.prisma.contact.create({
        data: {
          ...commonData,
          document, // CPF/CNPJ principal na tabela mestre
          tenantId,
          pfData,
          pjData,
        },
        include: {
            pfData: true,
            pjData: true,
        }
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  findAll(tenantId: string) {
    return this.prisma.contact.findMany({
      where: { tenantId },
      include: {
          pfData: true,
          pjData: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.contact.findUnique({
      where: { id },
      include: {
        addresses: true,
        additionalContacts: true,
        pfData: true,
        pjData: true,
        assets: true,
      },
    });
  }

  async update(id: string, updateContactDto: UpdateContactDto) {
      const { 
        addresses, 
        cpf, rg, birthDate, // PF fields
        cnpj, companyName, stateRegistration, // PJ fields
        ...commonData 
      } = updateContactDto as any;

      // Logic to handle nested updates (Upsert is cleaner/safer)
      // We need tenantId to create nested if not exists, but update DTO might not have it.
      // Assuming contact exists correctly.
      
      // Check current type first if needed, but for now apply data blindly if present.
      
      return this.prisma.contact.update({
        where: { id },
        data: {
            ...commonData,
            // Only update mappings if strictly necessary (document might change)
            pfData: (cpf || rg) ? {
                upsert: {
                    create: {
                         tenantId: commonData.tenantId, // Warning: tenantId might be missing in DTO
                         cpf, rg, birthDate: birthDate ? new Date(birthDate) : undefined
                    },
                    update: {
                        cpf, rg, birthDate: birthDate ? new Date(birthDate) : undefined
                    }
                }
            } : undefined,
             pjData: (cnpj || companyName) ? {
                upsert: {
                    create: {
                         tenantId: commonData.tenantId, 
                         cnpj, companyName, stateReg: stateRegistration
                    },
                    update: {
                         cnpj, companyName, stateReg: stateRegistration
                    }
                }
            } : undefined,
        },
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

