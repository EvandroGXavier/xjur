export type ContatoAdicionalIdentificador = {
  type: string;
  value: string;
  nomeContatoAdicional: string;
};

export function normalizarDigitosDDI(digits: string): string {
  if (!digits) return '';
  const clean = digits.replace(/\D/g, '');
  if (clean.length >= 10 && clean.length <= 11 && !clean.startsWith('55')) {
    return '55' + clean;
  }
  return clean;
}

export function normalizarIdentificadorCanal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/:[0-9]+(?=@)/, '');
  if (!normalized) return null;
  return normalized.toLowerCase().includes('@')
    ? normalized.toLowerCase()
    : normalized;
}

export function extrairDigitosIdentificador(value: unknown): string {
  const normalized = normalizarIdentificadorCanal(value);
  if (!normalized) return '';

  if (normalized.includes('@s.whatsapp.net')) {
    return normalizarDigitosDDI(normalized.split('@')[0]);
  }

  if (normalized.includes('@lid') || normalized.includes('@g.us')) {
    return '';
  }

  return normalizarDigitosDDI(normalized);
}

export function ehTelefoneProvavel(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  
  // Ignorar números fictícios (ex: 999999999, 000000000, etc)
  const isAllSameDigit = /^(.)\1+$/.test(digits);
  const isFictitious99 = digits.includes('99999999');
  
  return !isAllSameDigit && !isFictitious99;
}

function construirVariantesTelefoneWhatsapp(digits: string): string[] {
  const variants = new Set<string>();
  if (!digits) return [];

  variants.add(digits);

  // Se for brasileiro (55 + DDD + Numero)
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    const ddi = '55';
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    // No Brasil, o primeiro dígito após o DDD indica o tipo:
    // 2, 3, 4, 5 -> Fixo (Landline) - Sempre 8 dígitos
    // 6, 7, 8, 9 -> Celular (Mobile) - Atualmente 9 dígitos, mas pode vir com 8 em caches antigos
    
    const primeiroDigito = rest.length === 9 ? rest[1] : rest[0];
    const ehCelularProvavel = ['6', '7', '8', '9'].includes(primeiroDigito);
    // const ehFixoProvavel = ['2', '3', '4', '5'].includes(primeiroDigito);

    if (ehCelularProvavel) {
      if (rest.length === 9 && rest.startsWith('9')) {
        // Se tem 13 dígitos (com o 9), adiciona a versão com 12 (sem o 9) para compatibilidade
        variants.add(ddi + ddd + rest.slice(1));
      } else if (rest.length === 8) {
        // Se tem 12 dígitos (sem o 9), adiciona a versão com 13 (com o 9)
        variants.add(ddi + ddd + '9' + rest);
      }
    }
    
    // Se for FIXO, NÃO mexemos no 9. 
    // Mantemos apenas a variante original (já adicionada no início).
    
    // Versão sem DDI (sempre útil para busca)
    variants.add(digits.slice(2)); 
    
    // Se for celular e geramos a variante com 9, adiciona ela sem DDI também
    if (ehCelularProvavel && rest.length === 8) {
       variants.add(ddd + '9' + rest);
    }
  }

  return Array.from(variants);
}


export function construirValoresBuscaIdentificadores(
  channel: string,
  identifiers: Array<unknown>,
): string[] {
  const normalizedChannel = (channel || '').trim().toUpperCase();
  const values = new Set<string>();

  for (const identifier of identifiers) {
    const normalized = normalizarIdentificadorCanal(identifier);
    if (normalized) {
      values.add(normalized);
    }

    const digits = extrairDigitosIdentificador(identifier);
    if (digits) {
      if (normalizedChannel === 'WHATSAPP' && ehTelefoneProvavel(digits)) {
        construirVariantesTelefoneWhatsapp(digits).forEach((variant) => values.add(variant));
        values.add(`${digits}@s.whatsapp.net`);
      } else {
        values.add(digits);
      }
    }
  }

  return Array.from(values);
}

export function construirContatosAdicionaisPorCanal(
  channel: string,
  identifiers: Array<unknown>,
): ContatoAdicionalIdentificador[] {
  const normalizedChannel = (channel || '').trim().toUpperCase();
  const byValue = new Map<string, ContatoAdicionalIdentificador>();

  const push = (type: string, value: string, nomeContatoAdicional: string) => {
    const normalizedValue = normalizarIdentificadorCanal(value) || value.trim();
    if (!normalizedValue) return;
    if (!byValue.has(normalizedValue)) {
      byValue.set(normalizedValue, {
        type,
        value: normalizedValue,
        nomeContatoAdicional,
      });
    }
  };

  for (const identifier of identifiers) {
    const normalized = normalizarIdentificadorCanal(identifier);
    const digits = extrairDigitosIdentificador(identifier);

    if (normalizedChannel === 'WHATSAPP') {
      if (normalized?.endsWith('@g.us')) {
        push('WHATSAPP_GRUPO', normalized, 'WhatsApp Grupo');
      } else if (normalized?.endsWith('@lid')) {
        push('WHATSAPP_LID', normalized, 'WhatsApp LID');
      } else if (normalized?.endsWith('@s.whatsapp.net')) {
        push('WHATSAPP_JID', normalized, 'WhatsApp JID');
      }

      if (digits && ehTelefoneProvavel(digits)) {
        push('WHATSAPP', digits, 'WhatsApp');
        // Adiciona também a versão JID canônica
        push('WHATSAPP_JID', `${digits}@s.whatsapp.net`, 'WhatsApp JID');
      }

      continue;
    }

    if (normalizedChannel === 'TELEGRAM') {
      if (normalized) {
        push('TELEGRAM_ID', normalized, 'Telegram ID');
      }
      if (digits && ehTelefoneProvavel(digits)) {
        push('TELEGRAM', digits, 'Telegram');
      }
      continue;
    }

    if (normalizedChannel === 'EMAIL') {
      if (normalized) {
        push('EMAIL', normalized, 'E-mail');
      }
      continue;
    }

    if (normalizedChannel === 'X' || normalizedChannel === 'TWITTER') {
      if (normalized) {
        push('X_ID', normalized, 'X / Twitter');
      }
      continue;
    }

    if (normalized) {
      push(`${normalizedChannel || 'CANAL'}_ID`, normalized, `${normalizedChannel || 'Canal'} ID`);
    }
    if (digits) {
      push(`${normalizedChannel || 'CANAL'}_NUMERO`, digits, `${normalizedChannel || 'Canal'} Numero`);
    }
  }

  return Array.from(byValue.values());
}
