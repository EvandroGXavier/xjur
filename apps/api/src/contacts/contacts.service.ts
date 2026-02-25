import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
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
      // 1. Validar preenchimento mínimo (nome é obrigatório via DTO/Schema? assumimos que sim)
      const data: any = createContactDto;
      if (!data.name?.trim()) {
        throw new BadRequestException('O nome do contato é obrigatório.');
      }
      if (!data.whatsapp?.trim() && !data.phone?.trim() && !data.email?.trim() && !data.document?.trim() && !data.cpf?.trim() && !data.cnpj?.trim()) {
        throw new BadRequestException('Você deve fornecer pelo menos um dos seguintes: Celular, Telefone, E-mail ou Documento (CPF/CNPJ).');
      }

      // 2. Verificar duplicidade real
      const duplicate = await this.findDuplicateContact(tenantId, data);
      if (duplicate) {
        throw new ConflictException({
           message: 'Contato já cadastrado com os mesmos dados únicos.',
           contactId: duplicate.id, 
           duplicateField: duplicate.matchedField 
        });
      }

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

  async findAll(tenantId: string, search?: string, includedTags?: string, excludedTags?: string) {
    const whereClause: any = {
      tenantId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (includedTags || excludedTags) {
       if (!whereClause.AND) whereClause.AND = [];
       
       if (includedTags) {
          const incArray = includedTags.split(',');
          // Must have AT LEAST ONE of the included tags (OR logic for inclusion)
          whereClause.AND.push({
             tags: {
                some: { tagId: { in: incArray } }
             }
          });
       }

       if (excludedTags) {
          const excArray = excludedTags.split(',');
          // Must NOT have ANY of the excluded tags
          whereClause.AND.push({
             tags: {
                none: { tagId: { in: excArray } }
             }
          });
       }
    }

    const contacts = await this.prisma.contact.findMany({
      where: whereClause,
      include: {
        pfDetails: true,
        pjDetails: true,
        tags: {
          include: {
            tag: true
          }
        },
        addresses: true,
        additionalContacts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    const data: any = updateContactDto;
    
    // Buscar o contato original para saber o tenant
    const existingContact = await this.prisma.contact.findUnique({ where: { id } });
    if (!existingContact) throw new BadRequestException('Contato não encontrado');

    if (data.name !== undefined && !data.name?.trim()) {
      throw new BadRequestException('O nome do contato não pode ficar em branco.');
    }

    // Checking 4 fields (but we need to consider merged state if doing full validation. 
    // Usually frontend sends all data on update, so we can check `data` directly)
    if (data.whatsapp !== undefined || data.phone !== undefined || data.email !== undefined || data.document !== undefined) {
      const w = data.whatsapp ?? existingContact.whatsapp;
      const p = data.phone ?? existingContact.phone;
      const e = data.email ?? existingContact.email;
      const d = data.document ?? existingContact.document;
      // Note: Not blocking if empty because tenant config could be off, but requirement says "backend deve rejeitar". 
      // User says: "O backend deve rejeitar cadastros onde os quatro campos estejam nulos ou vazios simultaneamente."
      if (!w?.trim() && !p?.trim() && !e?.trim() && !d?.trim()) {
         throw new BadRequestException('Não é possível deixar todos estes campos vazios: Celular, Telefone, E-mail e Documento.');
      }
    }

    // Verificar Duplicidade excluindo o ID atual
    const duplicate = await this.findDuplicateContact(existingContact.tenantId, data, id);
    if (duplicate) {
      throw new ConflictException({
         message: 'Atualização causaria duplicidade com outro contato baseada nas chaves únicas.',
         contactId: duplicate.id, 
         duplicateField: duplicate.matchedField 
      });
    }

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
    } = data;

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

  // --- Duplicate Detection Logic ---
  async findDuplicateContact(tenantId: string, data: any, excludeId?: string) {
    const clean = (str: string) => str ? str.trim() : '';

    const name = clean(data.name).toLowerCase();
    const document = clean(data.document).replace(/\D/g, '');
    const cpf = clean(data.cpf).replace(/\D/g, '');
    const cnpj = clean(data.cnpj).replace(/\D/g, '');
    const whatsapp = clean(data.whatsapp).replace(/\D/g, '');
    const phone = clean(data.phone).replace(/\D/g, '');
    const email = clean(data.email).toLowerCase();

    // Monta as condições OR baseadas nos valores preenchidos
    const conditions: any[] = [];
    if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });
    if (whatsapp) conditions.push({ whatsapp: { endsWith: whatsapp.slice(-8) } }); // Simplificação para celular 
    if (phone) conditions.push({ phone: { endsWith: phone.slice(-8) } });
    if (email) conditions.push({ email: { equals: email, mode: 'insensitive' } });
    
    // Base documents
    if (document) conditions.push({ document: { endsWith: document } });

    // Details search for PF / PJ
    if (cpf) {
       conditions.push({ pfDetails: { cpf: { endsWith: cpf } } });
    }
    if (cnpj) {
       conditions.push({ pjDetails: { cnpj: { endsWith: cnpj } } });
    }

    if (conditions.length === 0) return null;

    const query: any = {
       where: {
          tenantId,
          OR: conditions,
       },
       include: {
         pfDetails: true,
         pjDetails: true
       }
    };
    
    if (excludeId) {
        query.where.id = { not: excludeId };
    }

    const matches = await this.prisma.contact.findMany(query);
    if (!matches || matches.length === 0) return null;

    const hit: any = matches[0];
    
    let matchedField = 'unknown';
    if (name && hit.name?.toLowerCase() === name) matchedField = 'nome';
    if (email && hit.email?.toLowerCase() === email) matchedField = 'e-mail';
    // Removemos non-digits também nos do banco para comparar perfeitamente
    if (whatsapp && clean(hit.whatsapp).replace(/\D/g, '').endsWith(whatsapp.slice(-8))) matchedField = 'celular/whatsapp';
    if (phone && clean(hit.phone).replace(/\D/g, '').endsWith(phone.slice(-8))) matchedField = 'telefone';
    if (document && clean(hit.document).replace(/\D/g, '').endsWith(document)) matchedField = 'documento';
    if (cpf && hit.pfDetails?.cpf && clean(hit.pfDetails.cpf).replace(/\D/g, '').endsWith(cpf)) matchedField = 'cpf';
    if (cnpj && hit.pjDetails?.cnpj && clean(hit.pjDetails.cnpj).replace(/\D/g, '').endsWith(cnpj)) matchedField = 'cnpj';

    return { id: hit.id, matchedField };
  }

  async lookupContactExact(tenantId: string, searchParams: any) {
      // Usado pelo frontend `onBlur` via ContactsController 
      return this.findDuplicateContact(tenantId, searchParams);
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

