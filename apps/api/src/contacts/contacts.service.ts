import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

  private normalizeDigits(value?: string | null) {
    return (value || '').replace(/\D/g, '');
  }

  private normalizeText(value?: string | null) {
    return (value || '').trim().toLowerCase();
  }

  private parseContactMetadata(metadata: any) {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};
  }

  private getStoredContracts(metadata: any) {
    const contracts = this.parseContactMetadata(metadata).contracts;
    return Array.isArray(contracts) ? contracts : [];
  }

  private sortContracts<T extends { firstDueDate?: string; dueDay?: number; updatedAt?: string }>(contracts: T[]) {
    return [...contracts].sort((a, b) => {
      const firstDueA = a.firstDueDate ? new Date(a.firstDueDate).getTime() : 0;
      const firstDueB = b.firstDueDate ? new Date(b.firstDueDate).getTime() : 0;
      if (firstDueA !== firstDueB) return firstDueB - firstDueA;

      const dueDayA = Number(a.dueDay || 0);
      const dueDayB = Number(b.dueDay || 0);
      if (dueDayA !== dueDayB) return dueDayA - dueDayB;

      const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return updatedB - updatedA;
    });
  }

  private async getContactMetadataRecord(contactId: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, metadata: true },
    });

    if (!contact) {
      throw new NotFoundException('Contato nao encontrado');
    }

    return {
      contactId: contact.id,
      metadata: this.parseContactMetadata(contact.metadata),
    };
  }

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

  async findAll(
    tenantId: string, 
    search?: string, 
    includedTags?: string, 
    excludedTags?: string,
    active?: string
  ) {
    const where: any = { tenantId };

    // Active/Inactive filter
    if (active === 'true') where.active = true;
    else if (active === 'false') where.active = false;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
        { pfDetails: { cpf: { contains: search, mode: 'insensitive' } } },
        { pjDetails: { cnpj: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (includedTags || excludedTags) {
       if (!where.AND) where.AND = [];
       
       if (includedTags) {
          const incArray = includedTags.split(',');
          // Must have AT LEAST ONE of the included tags (OR logic for inclusion)
          where.AND.push({
             tags: {
                some: { tagId: { in: incArray } }
             }
          });
       }

       if (excludedTags) {
          const excArray = excludedTags.split(',');
          // Must NOT have ANY of the excluded tags
          where.AND.push({
             tags: {
                none: { tagId: { in: excArray } }
             }
          });
       }
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
        pjDetails: true,
        addresses: true,
        additionalContacts: true,
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
    const clean = (str: string) => (str ? str.trim() : '');

    const name = clean(data.name).toLowerCase();
    const document = this.normalizeDigits(data.document);
    const cpf = this.normalizeDigits(data.cpf);
    const cnpj = this.normalizeDigits(data.cnpj);
    const whatsapp = this.normalizeDigits(data.whatsapp);
    const phone = this.normalizeDigits(data.phone);
    const email = clean(data.email).toLowerCase();

    const isPlaceholderPhone = (val: string) => this.normalizeDigits(val) === '9999999999';
    const isPlaceholderEmail = (val: string) => val.toLowerCase().trim() === 'nt@nt.com.br';

    const conditions: any[] = [];
    if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });
    if (whatsapp && !isPlaceholderPhone(whatsapp)) {
      conditions.push({ whatsapp: { endsWith: whatsapp.slice(-8) } });
      conditions.push({ phone: { endsWith: whatsapp.slice(-8) } });
    }
    if (phone && !isPlaceholderPhone(phone)) {
      conditions.push({ phone: { endsWith: phone.slice(-8) } });
      conditions.push({ whatsapp: { endsWith: phone.slice(-8) } });
    }
    if (email && !isPlaceholderEmail(email)) {
      conditions.push({ email: { equals: email, mode: 'insensitive' } });
    }
    if (document) conditions.push({ document: { endsWith: document } });
    if (cpf) conditions.push({ pfDetails: { cpf: { endsWith: cpf } } });
    if (cnpj) conditions.push({ pjDetails: { cnpj: { endsWith: cnpj } } });

    const requiresFullPhoneScan =
      (whatsapp && !isPlaceholderPhone(whatsapp)) ||
      (phone && !isPlaceholderPhone(phone));

    if (conditions.length === 0 && !requiresFullPhoneScan) return null;

    const query: any = {
      where: {
        tenantId,
      },
      include: {
        pfDetails: true,
        pjDetails: true,
      },
    };

    if (!requiresFullPhoneScan && conditions.length > 0) {
      query.where.OR = conditions;
    }

    if (excludeId) {
      query.where.id = { not: excludeId };
    }

    const matches = await this.prisma.contact.findMany(query);
    if (!matches || matches.length === 0) return null;

    for (const hit of matches as any[]) {
      const hitWhatsapp = this.normalizeDigits(hit.whatsapp);
      const hitPhone = this.normalizeDigits(hit.phone);
      const hitDocument = this.normalizeDigits(hit.document);
      const hitCpf = this.normalizeDigits(hit.pfDetails?.cpf);
      const hitCnpj = this.normalizeDigits(hit.pjDetails?.cnpj);
      const hitEmail = this.normalizeText(hit.email);
      const hitName = this.normalizeText(hit.name);

      if (name && hitName === name) {
        return { id: hit.id, matchedField: 'nome' };
      }
      if (email && !isPlaceholderEmail(email) && hitEmail === email) {
        return { id: hit.id, matchedField: 'e-mail' };
      }
      if (
        whatsapp &&
        !isPlaceholderPhone(whatsapp) &&
        (hitWhatsapp === whatsapp || hitPhone === whatsapp)
      ) {
        return { id: hit.id, matchedField: 'celular/whatsapp' };
      }
      if (
        phone &&
        !isPlaceholderPhone(phone) &&
        (hitPhone === phone || hitWhatsapp === phone)
      ) {
        return { id: hit.id, matchedField: 'telefone' };
      }
      if (document && hitDocument === document) {
        return { id: hit.id, matchedField: 'documento' };
      }
      if (cpf && hitCpf === cpf) {
        return { id: hit.id, matchedField: 'cpf' };
      }
      if (cnpj && hitCnpj === cnpj) {
        return { id: hit.id, matchedField: 'cnpj' };
      }
    }

    return null;
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

  private sanitizeAttachmentName(fileName: string) {
    return (fileName || 'anexo').replace(/[^\w.\-() ]+/g, '_');
  }

  getAttachmentPath(fileName: string) {
    const path = require('path');
    return path.join(
      process.cwd(),
      'uploads',
      'contacts',
      this.sanitizeAttachmentName(fileName),
    );
  }

  private async processAttachments(files?: any[], existingMetadata?: any) {
    const metadata =
      existingMetadata && typeof existingMetadata === 'object'
        ? { ...existingMetadata }
        : {};
    const newAttachments = [];

    if (files && files.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'uploads', 'contacts');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const originalName = this.sanitizeAttachmentName(
          file.originalname || 'anexo',
        );
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);

        newAttachments.push({
          originalName: file.originalname || originalName,
          fileName,
          path: `/uploads/contacts/${fileName}`,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      const existingAttachments = Array.isArray((metadata as any).attachments)
        ? (metadata as any).attachments
        : [];
      (metadata as any).attachments = [...existingAttachments, ...newAttachments];
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  async getAttachmentForContact(contactId: string, tenantId: string, fileName: string) {
    const safeFileName = this.sanitizeAttachmentName(fileName);
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { metadata: true },
    });

    if (!contact) {
      throw new NotFoundException('Contato nao encontrado');
    }

    const metadata = contact.metadata as any;
    const attachments = Array.isArray(metadata?.attachments)
      ? metadata.attachments
      : [];
    const attachment = attachments.find(
      (item: any) => item?.fileName === safeFileName,
    );

    if (!attachment) {
      throw new NotFoundException('Anexo do contato nao encontrado');
    }

    return {
      ...attachment,
      fileName: safeFileName,
      filePath: this.getAttachmentPath(safeFileName),
    };
  }

  async uploadAttachments(contactId: string, tenantId: string, files: Array<any>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { metadata: true },
    });

    if (!existing) {
      throw new NotFoundException('Contato nao encontrado');
    }

    const metadata = await this.processAttachments(files, existing.metadata);

    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: { metadata },
      include: {
        addresses: true,
        additionalContacts: true,
        pfDetails: true,
        pjDetails: true,
      },
    });
    return this.flattenContact(contact);
  }

  async deleteAttachment(contactId: string, tenantId: string, fileName: string) {
    const safeFileName = this.sanitizeAttachmentName(fileName);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { metadata: true },
    });

    if (!existing) {
      throw new NotFoundException('Contato nao encontrado');
    }

    const metadata =
      existing.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as any) }
        : {};
    const attachments = Array.isArray(metadata.attachments)
      ? metadata.attachments
      : [];
    const attachment = attachments.find((item: any) => item?.fileName === safeFileName);

    if (!attachment) {
      throw new NotFoundException('Anexo do contato nao encontrado');
    }

    metadata.attachments = attachments.filter(
      (item: any) => item?.fileName !== safeFileName,
    );

    const fs = require('fs');
    const filePath = this.getAttachmentPath(safeFileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: { metadata },
      include: {
        addresses: true,
        additionalContacts: true,
        pfDetails: true,
        pjDetails: true,
      },
    });
    return this.flattenContact(contact);
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


  // --- Contracts Management ---

  async getContactContracts(contactId: string, tenantId: string) {
    const { metadata } = await this.getContactMetadataRecord(contactId, tenantId);
    return this.sortContracts(this.getStoredContracts(metadata));
  }

  async createContactContract(tenantId: string, contactId: string, data: any) {
    const { metadata } = await this.getContactMetadataRecord(contactId, tenantId);
    const contracts = this.getStoredContracts(metadata);
    const now = new Date().toISOString();
    const contract = {
      id: randomUUID(),
      type: data.type?.trim(),
      description: data.description?.trim(),
      dueDay: Number(data.dueDay),
      firstDueDate: data.firstDueDate,
      billingFrequency: data.billingFrequency,
      transactionKind: data.transactionKind,
      counterpartyRole: data.counterpartyRole,
      counterpartyName: data.counterpartyName?.trim(),
      notes: data.notes?.trim() || '',
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const updatedMetadata = {
      ...metadata,
      contracts: this.sortContracts([...contracts, contract]),
    };

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { metadata: updatedMetadata },
    });

    return updatedMetadata.contracts;
  }

  async updateContactContract(tenantId: string, contactId: string, contractId: string, data: any) {
    const { metadata } = await this.getContactMetadataRecord(contactId, tenantId);
    const contracts = this.getStoredContracts(metadata);
    const contractIndex = contracts.findIndex((contract: any) => contract?.id === contractId);

    if (contractIndex < 0) {
      throw new NotFoundException('Contrato do contato nao encontrado');
    }

    const currentContract = contracts[contractIndex];
    const updatedContract = {
      ...currentContract,
      type: data.type?.trim(),
      description: data.description?.trim(),
      dueDay: Number(data.dueDay),
      firstDueDate: data.firstDueDate,
      billingFrequency: data.billingFrequency,
      transactionKind: data.transactionKind,
      counterpartyRole: data.counterpartyRole,
      counterpartyName: data.counterpartyName?.trim(),
      notes: data.notes?.trim() || '',
      status: data.status || currentContract.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    const nextContracts = [...contracts];
    nextContracts[contractIndex] = updatedContract;
    const updatedMetadata = {
      ...metadata,
      contracts: this.sortContracts(nextContracts),
    };

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { metadata: updatedMetadata },
    });

    return updatedMetadata.contracts;
  }

  async removeContactContract(tenantId: string, contactId: string, contractId: string) {
    const { metadata } = await this.getContactMetadataRecord(contactId, tenantId);
    const contracts = this.getStoredContracts(metadata);
    const nextContracts = contracts.filter((contract: any) => contract?.id !== contractId);

    if (nextContracts.length === contracts.length) {
      throw new NotFoundException('Contrato do contato nao encontrado');
    }

    const updatedMetadata = {
      ...metadata,
      contracts: this.sortContracts(nextContracts),
    };

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { metadata: updatedMetadata },
    });

    return updatedMetadata.contracts;
  }

  // --- Financial Records by Contact ---

  async getContactFinancialRecords(contactId: string, tenantId: string) {
    await this.getContactMetadataRecord(contactId, tenantId);

    const now = new Date();
    const records = await this.prisma.financialRecord.findMany({
      where: {
        tenantId,
        parties: {
          some: {
            contactId,
          },
        },
      },
      include: {
        bankAccount: {
          select: {
            id: true,
            title: true,
            bankName: true,
          },
        },
        financialCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        parties: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map(record => {
      const dueDate = record.dueDate ? new Date(record.dueDate) : null;
      const effectiveStatus =
        record.status === 'PENDING' && dueDate && dueDate < now ? 'OVERDUE' : record.status;
      const contactRole = record.parties.find(party => party.contactId === contactId)?.role;

      return {
        ...record,
        amount: Number(record.amount),
        amountFinal: record.amountFinal != null ? Number(record.amountFinal) : null,
        amountPaid: record.amountPaid != null ? Number(record.amountPaid) : null,
        fine: record.fine != null ? Number(record.fine) : null,
        interest: record.interest != null ? Number(record.interest) : null,
        monetaryCorrection:
          record.monetaryCorrection != null ? Number(record.monetaryCorrection) : null,
        discount: record.discount != null ? Number(record.discount) : null,
        effectiveStatus,
        contactRole,
        parties: record.parties.map(party => ({
          ...party,
          amount: party.amount != null ? Number(party.amount) : null,
        })),
      };
    });
  }

  // --- Manutenção e Limpeza de Contatos ---
  async cleanupContacts(tenantId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' } // Manter os mais antigos
    });

    const toDelete = new Set<string>();
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasLetterRegex = /[a-zA-Z]/;

    for (const contact of contacts) {
      let isIrregular = false;

      // 1. Verificar se Celular, Email, e Telefone estão TODOS simultaneamente em branco
      if (!contact.whatsapp?.trim() && !contact.phone?.trim() && !contact.email?.trim()) {
        isIrregular = true;
      }

      // 2. Com letras no lugar do número de celular/telefone
      if (!isIrregular && contact.whatsapp && hasLetterRegex.test(contact.whatsapp)) {
        isIrregular = true;
      }
      if (!isIrregular && contact.phone && hasLetterRegex.test(contact.phone)) {
        isIrregular = true;
      }

      // 3. Com e-mail inválido
      if (!isIrregular && contact.email && contact.email.trim() && !emailRegex.test(contact.email.trim())) {
        isIrregular = true;
      }

      // 4. Repetidos (mesmo nome OU mesmo celular/telefone OU mesmo email, mas só marcamos como duplicado se já vimos antes)
      if (!isIrregular) {
        const nameKey = contact.name?.toLowerCase().trim();
        // Pega os últimos 8 dígitos do whatsapp ou phone (como no findDuplicateContact)
        const waClean = contact.whatsapp ? contact.whatsapp.replace(/\D/g, '') : '';
        const phClean = contact.phone ? contact.phone.replace(/\D/g, '') : '';
        const phoneKey = waClean ? waClean.slice(-8) : (phClean ? phClean.slice(-8) : null);
        const emailKey = contact.email?.toLowerCase().trim();

        let isDuplicate = false;
        const isPlaceholderPhone = (val: string) => this.normalizeDigits(val) === '9999999999';
        const isPlaceholderEmail = (val: string) => val.toLowerCase().trim() === 'nt@nt.com.br';

        // Trata como duplicado se o mesmo nome já ocorreu
        if (nameKey && seenNames.has(nameKey)) isDuplicate = true;
        // Ou se o mesmo celular (últimos 8 dígitos) ocorrer (e não for placeholder)
        if (phoneKey && !isPlaceholderPhone(phoneKey) && seenPhones.has(phoneKey)) isDuplicate = true;
        // Ou se o mesmo email ocorrer (e não for placeholder)
        if (emailKey && !isPlaceholderEmail(emailKey) && seenEmails.has(emailKey)) isDuplicate = true;

        if (isDuplicate) {
          isIrregular = true;
        } else {
          // Marca como visto
          if (nameKey) seenNames.add(nameKey);
          if (phoneKey) seenPhones.add(phoneKey);
          if (emailKey) seenEmails.add(emailKey);
        }
      }

      if (isIrregular) {
        toDelete.add(contact.id);
      }
    }

    const deletedCount = toDelete.size;
    if (deletedCount > 0) {
      await this.prisma.contact.deleteMany({
        where: { id: { in: Array.from(toDelete) } }
      });
    }

    return { deletedCount };
  }

  // --- Bulk Actions ---
  async bulkAction(tenantId: string, dto: any) {
    const { action, tagId, category, contactIds, search, includedTags, excludedTags } = dto;
    const whereClause: any = { tenantId };
    
    // If specific IDs provided, only act on them
    if (contactIds && contactIds.length > 0) {
      whereClause.id = { in: contactIds };
    } else {
      // Use the same filtering logic as findAll
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { document: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { whatsapp: { contains: search, mode: 'insensitive' } },
          { pfDetails: { cpf: { contains: search, mode: 'insensitive' } } },
          { pjDetails: { cnpj: { contains: search, mode: 'insensitive' } } },
        ];
      }

      if (includedTags || excludedTags) {
        if (!whereClause.AND) whereClause.AND = [];
        if (includedTags) {
          const incArray = includedTags.split(',');
          whereClause.AND.push({ tags: { some: { tagId: { in: incArray } } } });
        }
        if (excludedTags) {
          const excArray = excludedTags.split(',');
          whereClause.AND.push({ tags: { none: { tagId: { in: excArray } } } });
        }
      }
    }

    const contacts = await this.prisma.contact.findMany({
      where: whereClause,
      select: { id: true }
    });

    const ids = contacts.map(c => c.id);
    if (ids.length === 0) return { updatedCount: 0 };

    switch (action) {
      case 'ADD_TAG':
        if (!tagId) throw new BadRequestException('Tag ID is required');
        const tagOperations = ids.map(id => ({
          contactId: id,
          tagId: tagId
        }));
        await this.prisma.contactTag.createMany({
          data: tagOperations,
          skipDuplicates: true
        });
        return { updatedCount: ids.length };

      case 'REMOVE_TAG':
        if (!tagId) throw new BadRequestException('Tag ID is required');
        await this.prisma.contactTag.deleteMany({
          where: {
            contactId: { in: ids },
            tagId: tagId
          }
        });
        return { updatedCount: ids.length };

      case 'UPDATE_CATEGORY':
        if (!category) throw new BadRequestException('Category is required');
        await this.prisma.contact.updateMany({
          where: { id: { in: ids } },
          data: { category }
        });
        return { updatedCount: ids.length };

      case 'DELETE_ALL':
        await this.prisma.contact.deleteMany({
          where: { id: { in: ids } }
        });
        return { updatedCount: ids.length };

      default:
        throw new BadRequestException('Invalid bulk action');
    }
  }
}

