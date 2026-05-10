import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * ContactNormalizationService
 *
 * Centraliza toda a lógica de validação, normalização e formatação de dados
 * de contatos (CPF, CNPJ, telefone, e-mail, nome). Extraído de contacts.service.ts.
 *
 * Regras do 9º Dígito (Brasil):
 *   Original:    5531988887777
 *   Sem 9º:      553188887777  (legado/cache)
 *   Com 9º:      5531988887777 (padronizado)
 * Queries de "Contato por Telefone/WhatsApp" devem rodar WHERE IN com todas as variantes.
 */
@Injectable()
export class ContactNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Normalização básica
  // ---------------------------------------------------------------------------

  normalizeDigits(value?: string | null): string {
    return (value || '').replace(/\D/g, '');
  }

  normalizeText(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  normalizeEmail(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  /**
   * Capitaliza nome com exceções para preposições brasileiras.
   * Ex: "evandro dos santos" → "Evandro dos Santos"
   */
  capitalizeName(value?: string | null): string {
    if (!value?.trim()) return '';
    const lower = ['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'com'];
    return value
      .trim()
      .toLowerCase()
      .split(' ')
      .map((word, i) => (i === 0 || !lower.includes(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  // ---------------------------------------------------------------------------
  // Variantes de telefone (9º dígito brasileiro)
  // ---------------------------------------------------------------------------

  /**
   * Gera todas as variantes de busca para um número de telefone brasileiro.
   * Retorna array com original, sem 9º dígito e com 9º dígito.
   */
  buildPhoneVariants(phone?: string | null): string[] {
    const digits = this.normalizeDigits(phone);
    if (!digits) return [];

    const variants = new Set<string>([digits]);

    // Formato: CC(2) + DDD(2) + número(8 ou 9)
    if (digits.length === 13) {
      // Ex: 5531988887777 (com 9) → adicionar sem 9
      const withoutNinth = digits.slice(0, 4) + digits.slice(5); // remove o 9 do início do número
      variants.add(withoutNinth);
    } else if (digits.length === 12) {
      // Ex: 553188887777 (sem 9) → adicionar com 9
      const withNinth = digits.slice(0, 4) + '9' + digits.slice(4);
      variants.add(withNinth);
    }

    return Array.from(variants);
  }

  // ---------------------------------------------------------------------------
  // Validações de documento
  // ---------------------------------------------------------------------------

  isValidCpf(value?: string | null): boolean {
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

  isValidCnpj(value?: string | null): boolean {
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

  // ---------------------------------------------------------------------------
  // Validação combinada (usada em create e update)
  // ---------------------------------------------------------------------------

  async validateContactData(
    tenantId: string,
    data: Record<string, any>,
    existingContact?: Record<string, any> | null,
  ): Promise<void> {
    // 1. Validar CPF
    const cpf = data.cpf ?? (existingContact as any)?.pfDetails?.cpf;
    if (cpf && cpf.trim() !== '' && !this.isValidCpf(cpf)) {
      throw new BadRequestException('O CPF informado e invalido.');
    }

    // 2. Validar CNPJ
    const cnpj = data.cnpj ?? (existingContact as any)?.pjDetails?.cnpj;
    if (cnpj && cnpj.trim() !== '' && !this.isValidCnpj(cnpj)) {
      throw new BadRequestException('O CNPJ informado e invalido.');
    }

    // 3. Validar documento genérico
    const doc = data.document ?? existingContact?.document;
    if (doc && doc.trim() !== '') {
      const cleanDoc = this.normalizeDigits(doc);
      if (cleanDoc.length === 11 && !this.isValidCpf(cleanDoc)) {
        throw new BadRequestException('O CPF informado no campo documento e invalido.');
      } else if (cleanDoc.length === 14 && !this.isValidCnpj(cleanDoc)) {
        throw new BadRequestException('O CNPJ informado no campo documento e invalido.');
      }
    }

    // 4. Verificar se pelo menos um canal/doc foi informado (se tenant exigir)
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

  hasCoreContactInfo(data: Record<string, any>): boolean {
    return Boolean(
      data.whatsapp?.trim() ||
        data.phone?.trim() ||
        data.email?.trim() ||
        data.document?.trim() ||
        data.cpf?.trim() ||
        data.cnpj?.trim(),
    );
  }

  private async isRequireOneInfoEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { contactRequireOneInfo: true },
    });
    return tenant?.contactRequireOneInfo !== false;
  }
}
