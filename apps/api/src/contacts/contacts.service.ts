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
      
      const { 
        // PF Fields
        cpf, rg, birthDate,

        nis, pis, ctps, motherName, fatherName, profession, nationality, naturality, gender, civilStatus, rgIssuer, rgIssueDate,
        fullName, cnh, cnhIssuer, cnhIssueDate, cnhExpirationDate, cnhCategory,
        
        // PJ Fields
        cnpj, companyName, stateRegistration, openingDate, size, legalNature,
        mainActivity, sideActivities, shareCapital, status, statusDate, statusReason,
        specialStatus, specialStatusDate, pjQsa,
        
        // Address & Additional (handled separately usually but let's be safe)
        addresses, additionalContacts,
        
        ...commonData 
      } = createContactDto as any;

      // Prepare nested writes
      const pfCreate = commonData.personType === 'PF' ? {
        cpf, rg, birthDate: birthDate ? new Date(birthDate) : undefined,
        nis, pis, ctps, motherName, fatherName, profession, nationality, naturality, gender, civilStatus, rgIssuer, 
        rgIssueDate: rgIssueDate ? new Date(rgIssueDate) : undefined,
        fullName, cnh, cnhIssuer, cnhCategory,
        cnhIssueDate: cnhIssueDate ? new Date(cnhIssueDate) : undefined,
        cnhExpirationDate: cnhExpirationDate ? new Date(cnhExpirationDate) : undefined
      } : undefined;

      const pjCreate = commonData.personType === 'PJ' ? {
        cnpj, companyName, stateRegistration, 
        openingDate: openingDate ? new Date(openingDate) : undefined,
        size, legalNature, mainActivity, sideActivities, shareCapital,
        status, statusDate: statusDate ? new Date(statusDate) : undefined,
        statusReason,
        specialStatus, specialStatusDate: specialStatusDate ? new Date(specialStatusDate) : undefined,
        pjQsa
      } : undefined;

      const contact = await this.prisma.contact.create({
        data: {
          ...commonData,
          tenantId,
          pfDetails: pfCreate ? { create: pfCreate } : undefined,
          pjDetails: pjCreate ? { create: pjCreate } : undefined,
          addresses: addresses && addresses.length > 0 ? {
             create: addresses
          } : undefined,
          additionalContacts: additionalContacts && additionalContacts.length > 0 ? {
             create: additionalContacts
          } : undefined,
        },
        include: {
           pfDetails: true,
           pjDetails: true,
           addresses: true,
           additionalContacts: true,
        }
      });
      
      return this.flattenContact(contact);

    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  async findAll(tenantId: string, search?: string) {
    const where: any = { tenantId };

    if (search && search.trim().length > 0) {
        const searchTerm = search.trim();
        where.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { document: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            // Also search in PF/PJ details if needed, but usually flattened document covers it.
            // Let's stick to main fields for performance first.
        ];
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      include: {
        pfDetails: true,
        pjDetails: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: search ? 50 : undefined // Limit results if searching to avoid overload
    });
    return contacts.map(c => this.flattenContact(c));
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        addresses: true,
        additionalContacts: true,
        pfDetails: true,
        pjDetails: true,
        assets: { include: { assetType: true } },
        relationsFrom: { include: { toContact: true, relationType: true } },
        relationsTo: { include: { fromContact: true, relationType: true } },
        tags: { include: { tag: true } }
      },
    });
    
    if (!contact) return null;
    return this.flattenContact(contact);
  }

  async update(id: string, updateContactDto: UpdateContactDto) {
    const { 
      // PF Fields
      cpf, rg, birthDate,
      nis, pis, ctps, motherName, fatherName, profession, nationality, naturality, gender, civilStatus, rgIssuer, rgIssueDate,
      fullName, cnh, cnhIssuer, cnhIssueDate, cnhExpirationDate, cnhCategory,
      
      // PJ Fields
      cnpj, companyName, stateRegistration, openingDate, size, legalNature,
      mainActivity, sideActivities, shareCapital, status, statusDate, statusReason,
      specialStatus, specialStatusDate, pjQsa,
      
      addresses, additionalContacts,
      
      ...commonData 
    } = updateContactDto as any;

    // FIX: Manual cleanup to ensure PF fields are NOT in commonData (destructuring edge cases)
    const pfFieldsToRemove = [
      'fullName', 'cnh', 'cnhIssuer', 'cnhIssueDate', 'cnhExpirationDate', 'cnhCategory',
      'cpf', 'rg', 'rgIssuer', 'rgIssueDate', 'birthDate',
      'nis', 'pis', 'ctps', 'motherName', 'fatherName', 'profession', 'nationality', 'naturality', 'gender', 'civilStatus',
      'secondaryEmail'
    ];
    pfFieldsToRemove.forEach(field => delete commonData[field]);

    // Same for PJ fields
    const pjFieldsToRemove = [
      'cnpj', 'companyName', 'stateRegistration', 'openingDate', 'size', 'legalNature',
      'mainActivity', 'sideActivities', 'shareCapital', 'status', 'statusDate', 'statusReason',
      'specialStatus', 'specialStatusDate', 'pjQsa'
    ];
    pjFieldsToRemove.forEach(field => delete commonData[field]);

    const pfUpdate = {
        cpf, rg, birthDate: birthDate ? new Date(birthDate) : undefined,
        nis, pis, ctps, motherName, fatherName, profession, nationality, naturality, gender, civilStatus, rgIssuer, 
        rgIssueDate: rgIssueDate ? new Date(rgIssueDate) : undefined,
        fullName, cnh, cnhIssuer, cnhCategory,
        cnhIssueDate: cnhIssueDate ? new Date(cnhIssueDate) : undefined,
        cnhExpirationDate: cnhExpirationDate ? new Date(cnhExpirationDate) : undefined
    };

    const pjUpdate = {
        cnpj, companyName, stateRegistration, 
        openingDate: openingDate ? new Date(openingDate) : undefined,
        size, legalNature, mainActivity, sideActivities, shareCapital,
        status, statusDate: statusDate ? new Date(statusDate) : undefined,
        statusReason,
        specialStatus, specialStatusDate: specialStatusDate ? new Date(specialStatusDate) : undefined,
        pjQsa
    };

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...commonData,
        pfDetails: commonData.personType === 'PF' ? {
            upsert: {
                create: pfUpdate,
                update: pfUpdate
            }
        } : undefined,
        pjDetails: commonData.personType === 'PJ' ? {
            upsert: {
                create: pjUpdate,
                update: pjUpdate
            }
        } : undefined
      },
      include: {
        pfDetails: true,
        pjDetails: true
      }
    });

    return this.flattenContact(contact);
  }

  // Helper to merge nested details back to flat structure for frontend compatibility
  private flattenContact(contact: any) {
     const { pfDetails, pjDetails, ...rest } = contact;
     let flat = { ...rest };
     
     if (pfDetails) {
         const { id, contactId, ...pfFields } = pfDetails;
         flat = { ...flat, ...pfFields };
     }
     if (pjDetails) {
         const { id, contactId, ...pjFields } = pjDetails;
         flat = { ...flat, ...pjFields };
     }
     return flat;
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

