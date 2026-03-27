import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getContactOrThrow(contactId: string, tenantId: string, include?: Record<string, any>) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include,
    });

    if (!contact) {
      throw new NotFoundException('Contato nao encontrado');
    }

    return contact;
  }

  private async isRequireOneInfoEnabled(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { contactRequireOneInfo: true },
    });

    return tenant?.contactRequireOneInfo !== false;
  }

  private hasCoreContactInfo(data: Record<string, any>) {
    return Boolean(
      data.whatsapp?.trim() ||
      data.phone?.trim() ||
      data.email?.trim() ||
      data.document?.trim() ||
      data.cpf?.trim() ||
      data.cnpj?.trim(),
    );
  }

  private async validateCoreContactInfo(
    tenantId: string,
    data: Record<string, any>,
    existingContact?: Record<string, any> | null,
  ) {
    // 1. Validar CPF se informado
    const cpf = data.cpf ?? (existingContact as any)?.pfDetails?.cpf;
    if (cpf && cpf.trim() !== '' && !this.isValidCpf(cpf)) {
      throw new BadRequestException('O CPF informado e invalido.');
    }

    // 2. Validar CNPJ se informado
    const cnpj = data.cnpj ?? (existingContact as any)?.pjDetails?.cnpj;
    if (cnpj && cnpj.trim() !== '' && !this.isValidCnpj(cnpj)) {
      throw new BadRequestException('O CNPJ informado e invalido.');
    }

    // 3. Validar DOCUMENTO (Genérico) se informado
    const doc = data.document ?? existingContact?.document;
    if (doc && doc.trim() !== '') {
      const cleanDoc = this.normalizeDigits(doc);
      if (cleanDoc.length === 11 && !this.isValidCpf(cleanDoc)) {
        throw new BadRequestException('O CPF informado no campo documento e invalido.');
      } else if (cleanDoc.length === 14 && !this.isValidCnpj(cleanDoc)) {
        throw new BadRequestException('O CNPJ informado no campo documento e invalido.');
      }
    }

    const shouldRequire = await this.isRequireOneInfoEnabled(tenantId);
    if (!shouldRequire) return;

    const merged = {
      whatsapp: data.whatsapp ?? existingContact?.whatsapp ?? '',
      phone: data.phone ?? existingContact?.phone ?? '',
      email: data.email ?? existingContact?.email ?? '',
      document: doc ?? '',
      cpf: cpf ?? '',
      cnpj: cnpj ?? '',
    };

    if (!this.hasCoreContactInfo(merged)) {
      throw new BadRequestException(
        'Voce deve fornecer pelo menos um dos seguintes dados: Celular, Telefone, E-mail ou Documento.',
      );
    }
  }

  private async ensureAddressBelongsToTenant(contactId: string, addressId: string, tenantId: string) {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        contactId,
        contact: { tenantId },
      },
      select: { id: true },
    });

    if (!address) {
      throw new NotFoundException('Endereco nao encontrado');
    }
  }

  private async ensureAdditionalContactBelongsToTenant(
    contactId: string,
    additionalContactId: string,
    tenantId: string,
  ) {
    const additionalContact = await this.prisma.additionalContact.findFirst({
      where: {
        id: additionalContactId,
        contactId,
        contact: { tenantId },
      },
      select: { id: true },
    });

    if (!additionalContact) {
      throw new NotFoundException('Contato adicional nao encontrado');
    }
  }

  private normalizeDigits(value?: string | null) {
    return (value || '').replace(/\D/g, '');
  }

  private isValidCpf(value?: string | null) {
    const digits = this.normalizeDigits(value);
    if (!digits || digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;

    const calc = (base: string) => {
      let sum = 0;
      let mult = base.length + 1;
      for (const d of base) sum += Number(d) * mult--;
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };

    const d1 = calc(digits.slice(0, 9));
    const d2 = calc(digits.slice(0, 10));
    return digits.endsWith(`${d1}${d2}`);
  }

  private isValidCnpj(value?: string | null) {
    const digits = this.normalizeDigits(value);
    if (!digits || digits.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(digits)) return false;

    const calc = (base: string, factors: number[]) => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) sum += Number(base[i]) * factors[i];
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };

    const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const d1 = calc(digits.slice(0, 12), f1);
    const d2 = calc(digits.slice(0, 13), f2);
    return digits.endsWith(`${d1}${d2}`);
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
    const data: any = createContactDto;
    if (!data.name?.trim()) {
      throw new BadRequestException('O nome do contato e obrigatorio.');
    }

    await this.validateCoreContactInfo(tenantId, data);

    const duplicate = await this.findDuplicateContact(tenantId, data);
    if (duplicate) {
      throw new ConflictException({
        message: 'Contato ja cadastrado com os mesmos dados unicos.',
        contactId: duplicate.id,
        duplicateField: duplicate.matchedField,
      });
    }

    const {
      cpf,
      rg,
      birthDate,
      nis,
      pis,
      ctps,
      motherName,
      fatherName,
      profession,
      nationality,
      naturality,
      gender,
      civilStatus,
      rgIssuer,
      rgIssueDate,
      fullName,
      cnh,
      cnhIssuer,
      cnhIssueDate,
      cnhExpirationDate,
      cnhCategory,
      cnpj,
      companyName,
      stateRegistration,
      openingDate,
      size,
      legalNature,
      mainActivity,
      sideActivities,
      shareCapital,
      status,
      statusDate,
      statusReason,
      specialStatus,
      specialStatusDate,
      pjQsa,
      addresses,
      additionalContacts,
      ...commonData
    } = createContactDto as any;

    const personType = commonData.personType || 'LEAD';
    const pfCreate =
      personType === 'PF'
        ? {
            cpf,
            rg,
            birthDate: birthDate ? new Date(birthDate) : undefined,
            nis,
            pis,
            ctps,
            motherName,
            fatherName,
            profession,
            nationality,
            naturality,
            gender,
            civilStatus,
            rgIssuer,
            rgIssueDate: rgIssueDate ? new Date(rgIssueDate) : undefined,
            fullName,
            cnh,
            cnhIssuer,
            cnhCategory,
            cnhIssueDate: cnhIssueDate ? new Date(cnhIssueDate) : undefined,
            cnhExpirationDate: cnhExpirationDate ? new Date(cnhExpirationDate) : undefined,
          }
        : undefined;

    const pjCreate =
      personType === 'PJ'
        ? {
            cnpj,
            companyName,
            stateRegistration,
            openingDate: openingDate ? new Date(openingDate) : undefined,
            size,
            legalNature,
            mainActivity,
            sideActivities,
            shareCapital,
            status,
            statusDate: statusDate ? new Date(statusDate) : undefined,
            statusReason,
            specialStatus,
            specialStatusDate: specialStatusDate ? new Date(specialStatusDate) : undefined,
            pjQsa,
          }
        : undefined;

    const contact = await this.prisma.contact.create({
      data: {
        ...commonData,
        personType,
        tenantId,
        pfDetails: pfCreate ? { create: pfCreate } : undefined,
        pjDetails: pjCreate ? { create: pjCreate } : undefined,
        addresses: addresses?.length ? { create: addresses } : undefined,
        additionalContacts: additionalContacts?.length ? { create: additionalContacts } : undefined,
      },
      include: {
        pfDetails: true,
        pjDetails: true,
        addresses: true,
        additionalContacts: true,
      },
    });

    return this.flattenContact(contact);
  }

  async findAll(
    tenantId: string, 
    search?: string, 
    includedTags?: string, 
    excludedTags?: string,
    active?: string,
    birthDateStart?: string,
    birthDateEnd?: string,
    pfFilters?: {
      cpf?: string;
      rg?: string;
      motherName?: string;
      fatherName?: string;
      profession?: string;
      nationality?: string;
      naturality?: string;
      gender?: string;
      civilStatus?: string;
      cnh?: string;
      cnhCategory?: string;
      nis?: string;
      pis?: string;
      ctps?: string;
    },
    pjFilters?: {
      cnpj?: string;
      companyName?: string;
      stateRegistration?: string;
    },
    extraFilters?: {
      birthMonth?: number;
      address?: { city?: string; state?: string; district?: string; zipCode?: string; street?: string };
      additionalContact?: { value?: string; name?: string };
      contract?: { description?: string; counterparty?: string };
    }
  ) {
    const where: any = { tenantId };

    // Active/Inactive filter
    if (active === 'true') where.active = true;
    else if (active === 'false') where.active = false;


    if (birthDateStart || birthDateEnd || pfFilters) {
      where.pfDetails = where.pfDetails || {};
      
      if (birthDateStart || birthDateEnd) {
        where.pfDetails.birthDate = {};
        if (birthDateStart) {
          where.pfDetails.birthDate.gte = new Date(birthDateStart);
        }
        if (birthDateEnd) {
          where.pfDetails.birthDate.lte = new Date(birthDateEnd);
        }
      }

      if (pfFilters) {
        Object.entries(pfFilters).forEach(([key, value]) => {
          if (value?.trim()) {
            where.pfDetails[key] = { contains: value, mode: 'insensitive' };
          }
        });
      }

      // Cleanup if empty
      if (Object.keys(where.pfDetails).length === 0) {
        delete where.pfDetails;
      }
    }

    if (pjFilters) {
      where.pjDetails = where.pjDetails || {};
      Object.entries(pjFilters).forEach(([key, value]) => {
        if (value?.trim()) {
          where.pjDetails[key] = { contains: value, mode: 'insensitive' };
        }
      });
      if (Object.keys(where.pjDetails).length === 0) {
        delete where.pjDetails;
      }
    }

    // Address Filters
    if (extraFilters?.address) {
      const addr = extraFilters.address;
      const addrConditions = Object.entries(addr)
        .filter(([_, v]) => v?.trim())
        .map(([k, v]) => ({ [k]: { contains: v, mode: 'insensitive' } }));
      
      if (addrConditions.length > 0) {
        where.addresses = { some: { AND: addrConditions } };
      }
    }

    // Additional Contact Filters
    if (extraFilters?.additionalContact) {
      const ac = extraFilters.additionalContact;
      const acConditions: any[] = [];
      if (ac.value?.trim()) acConditions.push({ value: { contains: ac.value, mode: 'insensitive' } });
      if (ac.name?.trim()) acConditions.push({ nomeContatoAdicional: { contains: ac.name, mode: 'insensitive' } });
      
      if (acConditions.length > 0) {
        where.additionalContacts = { some: { AND: acConditions } };
      }
    }
    // Collective ID collection for complex filters
    let requiredIds: string[] | null = null;

    // Handle Month filter (Postgres specific extraction)
    if (extraFilters?.birthMonth) {
      const monthContacts = await this.prisma.$queryRawUnsafe<{ contactId: string }[]>(
        `SELECT "contactId" FROM "person_details_pf" WHERE EXTRACT(MONTH FROM "birthDate") = $1`,
        extraFilters.birthMonth
      );
      const monthIds = monthContacts.map(c => c.contactId);
      requiredIds = requiredIds === null ? monthIds : requiredIds.filter(id => monthIds.includes(id));
    }

    // Contract Filters - searching inside JSON metadata
    if (extraFilters?.contract?.description?.trim() || extraFilters?.contract?.counterparty?.trim()) {
       const desc = extraFilters.contract.description?.trim() || '';
       const counter = extraFilters.contract.counterparty?.trim() || '';
       
       // Search in the whole metadata text for simplicity and performance of a single query
       // casting to text is fast for ILIKE
       const contractContacts = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
         `SELECT id FROM contacts WHERE metadata::text ilike $1 AND metadata::text ilike $2`,
         `%${desc}%`,
         `%${counter}%`
       );
       const contractIds = contractContacts.map(c => c.id);
       requiredIds = requiredIds === null ? contractIds : requiredIds.filter(id => contractIds.includes(id));
    }

    if (requiredIds !== null) {
       where.id = { in: requiredIds };
    }

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

  async findOne(id: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        addresses: true,
        additionalContacts: true,
        pfDetails: true,
        pjDetails: true,
        assets: { include: { assetType: true } },
        relationsFrom: { include: { toContact: true, relationType: true } },
        relationsTo: { include: { fromContact: true, relationType: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contato nao encontrado');
    }

    return this.flattenContact(contact);
  }
  async update(id: string, updateContactDto: UpdateContactDto, tenantId: string) {
    const data: any = updateContactDto;
    const existingContact = await this.getContactOrThrow(id, tenantId, {
      pfDetails: true,
      pjDetails: true,
    });

    if (data.name !== undefined && !data.name?.trim()) {
      throw new BadRequestException('O nome do contato nao pode ficar em branco.');
    }

    await this.validateCoreContactInfo(tenantId, data, existingContact);

    const duplicate = await this.findDuplicateContact(tenantId, data, id);
    if (duplicate) {
      throw new ConflictException({
        message: 'Atualizacao causaria duplicidade com outro contato baseada nas chaves unicas.',
        contactId: duplicate.id,
        duplicateField: duplicate.matchedField,
      });
    }

    const {
      cpf,
      rg,
      birthDate,
      nis,
      pis,
      ctps,
      motherName,
      fatherName,
      profession,
      nationality,
      naturality,
      gender,
      civilStatus,
      rgIssuer,
      rgIssueDate,
      fullName,
      cnh,
      cnhIssuer,
      cnhIssueDate,
      cnhExpirationDate,
      cnhCategory,
      cnpj,
      companyName,
      stateRegistration,
      openingDate,
      size,
      legalNature,
      mainActivity,
      sideActivities,
      shareCapital,
      status,
      statusDate,
      statusReason,
      specialStatus,
      specialStatusDate,
      pjQsa,
      addresses,
      additionalContacts,
      ...commonData
    } = data;

    const pfFieldsToRemove = [
      'fullName', 'cnh', 'cnhIssuer', 'cnhIssueDate', 'cnhExpirationDate', 'cnhCategory',
      'cpf', 'rg', 'rgIssuer', 'rgIssueDate', 'birthDate',
      'nis', 'pis', 'ctps', 'motherName', 'fatherName', 'profession', 'nationality', 'naturality', 'gender', 'civilStatus',
      'secondaryEmail'
    ];
    pfFieldsToRemove.forEach(field => delete commonData[field]);

    const pjFieldsToRemove = [
      'cnpj', 'companyName', 'stateRegistration', 'openingDate', 'size', 'legalNature',
      'mainActivity', 'sideActivities', 'shareCapital', 'status', 'statusDate', 'statusReason',
      'specialStatus', 'specialStatusDate', 'pjQsa'
    ];
    pjFieldsToRemove.forEach(field => delete commonData[field]);

    const personType = commonData.personType ?? existingContact.personType;

    const pfUpdate = {
      cpf,
      rg,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      nis,
      pis,
      ctps,
      motherName,
      fatherName,
      profession,
      nationality,
      naturality,
      gender,
      civilStatus,
      rgIssuer,
      rgIssueDate: rgIssueDate ? new Date(rgIssueDate) : undefined,
      fullName,
      cnh,
      cnhIssuer,
      cnhCategory,
      cnhIssueDate: cnhIssueDate ? new Date(cnhIssueDate) : undefined,
      cnhExpirationDate: cnhExpirationDate ? new Date(cnhExpirationDate) : undefined,
    };

    const pjUpdate = {
      cnpj,
      companyName,
      stateRegistration,
      openingDate: openingDate ? new Date(openingDate) : undefined,
      size,
      legalNature,
      mainActivity,
      sideActivities,
      shareCapital,
      status,
      statusDate: statusDate ? new Date(statusDate) : undefined,
      statusReason,
      specialStatus,
      specialStatusDate: specialStatusDate ? new Date(specialStatusDate) : undefined,
      pjQsa,
    };

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...commonData,
        personType,
        pfDetails:
          personType === 'PF'
            ? {
                upsert: {
                  create: pfUpdate,
                  update: pfUpdate,
                },
              }
            : existingContact.pfDetails
              ? { delete: true }
              : undefined,
        pjDetails:
          personType === 'PJ'
            ? {
                upsert: {
                  create: pjUpdate,
                  update: pjUpdate,
                },
              }
            : existingContact.pjDetails
              ? { delete: true }
              : undefined,
      },
      include: {
        pfDetails: true,
        pjDetails: true,
        addresses: true,
        additionalContacts: true,
      },
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

    const isPlaceholderPhone = (val: string) => {
      const d = this.normalizeDigits(val);
      return d === '9999999999' || d === '99999999999';
    };
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
      return this.findDuplicateContact(tenantId, searchParams);
  }

  async remove(id: string, tenantId: string) {
    await this.getContactOrThrow(id, tenantId);

    try {
      return await this.prisma.contact.delete({
        where: { id },
      });
    } catch (error: any) {
      // Quando o contato possui vínculos obrigatórios (processos, financeiro, etc),
      // o Prisma lança erro de FK/relação requerida e o DELETE vira 500.
      // Para o usuário, "excluir" deve ao menos remover da operação: inativamos.
      if (error?.code === 'P2003' || error?.code === 'P2014') {
        return this.prisma.contact.update({
          where: { id },
          data: { active: false },
        });
      }

      throw error;
    }
  }
  // Address management methods
  async addAddress(contactId: string, createAddressDto: CreateAddressDto, tenantId: string) {
    await this.getContactOrThrow(contactId, tenantId);

    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        contactId,
      },
    });
  }

  async updateAddress(
    contactId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
    tenantId: string,
  ) {
    await this.getContactOrThrow(contactId, tenantId);
    await this.ensureAddressBelongsToTenant(contactId, addressId, tenantId);

    return this.prisma.address.update({
      where: {
        id: addressId,
        contactId,
      },
      data: updateAddressDto,
    });
  }

  async removeAddress(contactId: string, addressId: string, tenantId: string) {
    await this.getContactOrThrow(contactId, tenantId);
    await this.ensureAddressBelongsToTenant(contactId, addressId, tenantId);

    return this.prisma.address.delete({
      where: {
        id: addressId,
        contactId,
      },
    });
  }

  // Additional Contact management methods
  async addAdditionalContact(
    contactId: string,
    createAdditionalContactDto: CreateAdditionalContactDto,
    tenantId: string,
  ) {
    await this.getContactOrThrow(contactId, tenantId);

    return this.prisma.additionalContact.create({
      data: {
        ...createAdditionalContactDto,
        contactId,
      },
    });
  }

  async updateAdditionalContact(
    contactId: string,
    additionalContactId: string,
    updateAdditionalContactDto: UpdateAdditionalContactDto,
    tenantId: string,
  ) {
    await this.getContactOrThrow(contactId, tenantId);
    await this.ensureAdditionalContactBelongsToTenant(contactId, additionalContactId, tenantId);

    return this.prisma.additionalContact.update({
      where: {
        id: additionalContactId,
        contactId,
      },
      data: updateAdditionalContactDto,
    });
  }

  async removeAdditionalContact(contactId: string, additionalContactId: string, tenantId: string) {
    await this.getContactOrThrow(contactId, tenantId);
    await this.ensureAdditionalContactBelongsToTenant(contactId, additionalContactId, tenantId);

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
    console.log(`[ATTACHMENT] Recebendo ${files?.length || 0} arquivos para contato ${contactId}`);
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

  async getContactRelations(contactId: string, tenantId: string) {
    await this.getContactOrThrow(contactId, tenantId);

    const fromRelations = await this.prisma.contactRelation.findMany({
      where: { tenantId, fromContactId: contactId },
      include: {
        toContact: { select: { id: true, name: true, personType: true } },
        relationType: true,
      },
    });

    const toRelations = await this.prisma.contactRelation.findMany({
      where: { tenantId, toContactId: contactId },
      include: {
        fromContact: { select: { id: true, name: true, personType: true } },
        relationType: true,
      },
    });

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
        ? r.relationType.name
        : (r.relationType.reverseName || `${r.relationType.name} (Inverso)`),
      isInverse: true,
    }));

    return [...formattedFrom, ...formattedTo];
  }

  async createContactRelation(tenantId: string, fromContactId: string, data: any) {
    await Promise.all([
      this.getContactOrThrow(fromContactId, tenantId),
      this.getContactOrThrow(data.toContactId, tenantId),
    ]);

    const relationType = await this.prisma.relationType.findFirst({
      where: { id: data.relationTypeId, tenantId },
      select: { id: true },
    });

    if (!relationType) {
      throw new NotFoundException('Tipo de vinculo nao encontrado');
    }

    const duplicate = await this.prisma.contactRelation.findFirst({
      where: {
        tenantId,
        fromContactId,
        toContactId: data.toContactId,
        relationTypeId: data.relationTypeId,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Este vinculo ja esta cadastrado para o contato.');
    }

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
    const relation = await this.prisma.contactRelation.findUnique({ where: { id: relationId } });
    if (!relation || relation.tenantId !== tenantId) {
      throw new NotFoundException('Vinculo nao encontrado');
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

  async getContactAssets(contactId: string, tenantId: string) {
    await this.getContactOrThrow(contactId, tenantId);

    return this.prisma.contactAsset.findMany({
      where: { contactId, tenantId },
      include: {
        assetType: true,
      },
      orderBy: { acquisitionDate: 'desc' },
    });
  }

  async createContactAsset(tenantId: string, contactId: string, data: any) {
    await this.getContactOrThrow(contactId, tenantId);

    const assetType = await this.prisma.assetType.findFirst({
      where: { id: data.assetTypeId, tenantId },
      select: { id: true },
    });

    if (!assetType) {
      throw new NotFoundException('Tipo de patrimonio nao encontrado');
    }

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
      throw new NotFoundException('Patrimonio nao encontrado');
    }

    if (data.assetTypeId) {
      const assetType = await this.prisma.assetType.findFirst({
        where: { id: data.assetTypeId, tenantId },
        select: { id: true },
      });

      if (!assetType) {
        throw new NotFoundException('Tipo de patrimonio nao encontrado');
      }
    }

    return this.prisma.contactAsset.update({
      where: { id: assetId },
      data,
    });
  }

  async removeContactAsset(tenantId: string, assetId: string) {
    const asset = await this.prisma.contactAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.tenantId !== tenantId) {
      throw new NotFoundException('Patrimonio nao encontrado');
    }
    return this.prisma.contactAsset.delete({
      where: { id: assetId },
    });
  }

  async getContactInsights(contactId: string, tenantId: string) {
    const contact = await this.getContactOrThrow(contactId, tenantId);

    const [processParties, ownedProcesses, appointments, whatsappConversations, tickets] = await Promise.all([
      this.prisma.processParty.findMany({
        where: {
          tenantId,
          contactId,
        },
        include: {
          role: {
            select: { id: true, name: true, category: true },
          },
          process: {
            select: {
              id: true,
              code: true,
              title: true,
              cnj: true,
              status: true,
              area: true,
              class: true,
              court: true,
              district: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.process.findMany({
        where: {
          tenantId,
          processParties: {
            some: {
              contactId,
              isClient: true,
            },
          },
        },
        select: {
          id: true,
          code: true,
          title: true,
          cnj: true,
          status: true,
          area: true,
          class: true,
          court: true,
          district: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          participants: {
            some: { contactId },
          },
        },
        include: {
          process: {
            select: { id: true, title: true, code: true },
          },
          participants: {
            where: { contactId },
            select: { role: true, confirmed: true },
          },
        },
        orderBy: { startAt: 'asc' },
        take: 25,
      }),
      this.prisma.agentConversation.findMany({
        where: {
          tenantId,
          contactId,
          channel: 'WHATSAPP',
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          queue: true,
          waitingReply: true,
          unreadCount: true,
          lastMessagePreview: true,
          lastMessageAt: true,
          connection: {
            select: { id: true, name: true, status: true },
          },
          ticket: {
            select: { id: true, code: true, status: true, priority: true, queue: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: {
              id: true,
              direction: true,
              role: true,
              content: true,
              contentType: true,
              status: true,
              senderName: true,
              createdAt: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 8,
      }),
      this.prisma.ticket.findMany({
        where: {
          tenantId,
          contactId,
          channel: 'WHATSAPP',
        },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          queue: true,
          waitingReply: true,
          lastMessageAt: true,
          updatedAt: true,
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 8,
      }),
    ]);

    const processesById = new Map<string, any>();

    for (const ownedProcess of ownedProcesses) {
      processesById.set(ownedProcess.id, {
        ...ownedProcess,
        relation: {
          type: 'owner',
          label: 'Contato principal',
          isClient: true,
          isOpposing: false,
        },
      });
    }

    for (const party of processParties) {
      processesById.set(party.process.id, {
        ...party.process,
        relation: {
          type: 'party',
          label: party.role?.name || 'Parte',
          roleCategory: party.role?.category || null,
          isClient: party.isClient,
          isOpposing: party.isOpposing,
        },
      });
    }

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        whatsapp: contact.whatsapp,
        phone: contact.phone,
        email: contact.email,
      },
      processes: Array.from(processesById.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
      appointments: appointments.map(appointment => ({
        id: appointment.id,
        title: appointment.title,
        type: appointment.type,
        status: appointment.status,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        location: appointment.location,
        process: appointment.process,
        participantRole: appointment.participants[0]?.role || null,
        confirmed: appointment.participants[0]?.confirmed || false,
      })),
      whatsapp: {
        conversations: whatsappConversations.map(conversation => ({
          id: conversation.id,
          title: conversation.title,
          status: conversation.status,
          priority: conversation.priority,
          queue: conversation.queue,
          waitingReply: conversation.waitingReply,
          unreadCount: conversation.unreadCount,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageAt: conversation.lastMessageAt,
          connection: conversation.connection,
          ticket: conversation.ticket,
          messages: [...conversation.messages].reverse(),
        })),
        tickets,
      },
    };
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

