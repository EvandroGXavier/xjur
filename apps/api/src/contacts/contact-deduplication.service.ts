import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContactNormalizationService } from './contact-normalization.service';

export interface DuplicateMatch {
  id: string;
  name: string;
  matchedField: string;
}

/**
 * ContactDeduplicationService
 *
 * Detecta duplicatas antes de criar ou atualizar um contato.
 * Implementa a lógica de "placeholder" (números genéricos como 9999999999)
 * e correspondência por sufixo dos últimos 8 dígitos do telefone.
 *
 * Extraído de contacts.service.ts → findDuplicateContact().
 */
@Injectable()
export class ContactDeduplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: ContactNormalizationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Constantes de placeholder (números/e-mails que não devem causar dedup)
  // ---------------------------------------------------------------------------

  private readonly PLACEHOLDER_PHONES = new Set(['9999999999', '99999999999']);
  private readonly PLACEHOLDER_EMAIL = 'nt@nt.com.br';

  isPlaceholderPhone(digits: string): boolean {
    return this.PLACEHOLDER_PHONES.has(digits);
  }

  isPlaceholderEmail(email: string): boolean {
    return email.toLowerCase().trim() === this.PLACEHOLDER_EMAIL;
  }

  /**
   * Retorna os últimos 8 dígitos como chave de busca por telefone.
   * Garante que placeholders não causem falsos positivos.
   */
  getPhoneMatchKey(value?: string | null): string {
    const digits = this.normalization.normalizeDigits(value);
    if (!digits || this.isPlaceholderPhone(digits)) return '';
    return digits.slice(-8);
  }

  // ---------------------------------------------------------------------------
  // Busca de duplicata
  // ---------------------------------------------------------------------------

  /**
   * Procura por um contato existente com os mesmos dados (nome, doc, telefone, e-mail).
   * Retorna o primeiro match encontrado com o campo que causou a colisão, ou null.
   *
   * @param excludeId — ID do contato atual (para ignorar em updates)
   */
  async findDuplicate(
    tenantId: string,
    data: Record<string, any>,
    excludeId?: string,
  ): Promise<DuplicateMatch | null> {
    const name = this.normalization.normalizeText(data.name);
    const document = this.normalization.normalizeDigits(data.document);
    const cpf = this.normalization.normalizeDigits(data.cpf);
    const cnpj = this.normalization.normalizeDigits(data.cnpj);
    const whatsapp = this.normalization.normalizeDigits(data.whatsapp ?? data.whatsappE164);
    const phone = this.normalization.normalizeDigits(data.phone);
    const email = this.normalization.normalizeEmail(data.email);

    const whatsappMatch = this.getPhoneMatchKey(whatsapp);
    const phoneMatch = this.getPhoneMatchKey(phone);

    const buildPhoneCondition = (match: string) => ({
      additionalContacts: { some: { value: { endsWith: match } } },
    });

    const conditions: any[] = [];

    if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });
    if (whatsapp) conditions.push({ whatsappE164: whatsapp });
    if (whatsappMatch) conditions.push(buildPhoneCondition(whatsappMatch));
    if (phoneMatch) conditions.push(buildPhoneCondition(phoneMatch));
    if (email && !this.isPlaceholderEmail(email)) {
      conditions.push({
        additionalContacts: { some: { value: { equals: email, mode: 'insensitive' } } },
      });
    }
    if (document) conditions.push({ document: { endsWith: document } });
    if (cpf) conditions.push({ pfDetails: { cpf: { endsWith: cpf } } });
    if (cnpj) conditions.push({ pjDetails: { cnpj: { endsWith: cnpj } } });

    if (conditions.length === 0) return null;

    const query: any = {
      where: { tenantId, OR: conditions },
      include: {
        pfDetails: { select: { cpf: true } },
        pjDetails: { select: { cnpj: true } },
        additionalContacts: { select: { value: true } },
      },
    };

    if (excludeId) {
      query.where.id = { not: excludeId };
    }

    const matches = await this.prisma.contact.findMany(query);
    if (!matches || matches.length === 0) return null;

    // Identificar qual campo causou o match para feedback preciso ao usuário
    for (const hit of matches as any[]) {
      const hitAdditionalValues: string[] = Array.isArray(hit.additionalContacts)
        ? hit.additionalContacts.map((item: any) => String(item.value || ''))
        : [];

      const hitPhoneKeys = hitAdditionalValues
        .map(v => this.getPhoneMatchKey(v))
        .filter(Boolean);

      const hitDocument = this.normalization.normalizeDigits(hit.document);
      const hitCpf = this.normalization.normalizeDigits(hit.pfDetails?.cpf);
      const hitCnpj = this.normalization.normalizeDigits(hit.pjDetails?.cnpj);
      const hitEmail = this.normalization.normalizeEmail(
        hitAdditionalValues.find(v => v.includes('@')) || '',
      );
      const hitName = this.normalization.normalizeText(hit.name);

      if (name && hitName === name) return { id: hit.id, name: hit.name, matchedField: 'nome' };
      if (email && !this.isPlaceholderEmail(email) && hitEmail === email)
        return { id: hit.id, name: hit.name, matchedField: 'e-mail' };
      if (whatsappMatch && hitPhoneKeys.includes(whatsappMatch))
        return { id: hit.id, name: hit.name, matchedField: 'celular/whatsapp' };
      if (phoneMatch && hitPhoneKeys.includes(phoneMatch))
        return { id: hit.id, name: hit.name, matchedField: 'telefone' };
      if (document && hitDocument === document)
        return { id: hit.id, name: hit.name, matchedField: 'documento' };
      if (cpf && hitCpf === cpf) return { id: hit.id, name: hit.name, matchedField: 'cpf' };
      if (cnpj && hitCnpj === cnpj) return { id: hit.id, name: hit.name, matchedField: 'cnpj' };
    }

    return null;
  }
}
