export type ContatoAdicionalIdentificador = {
  type: string;
  value: string;
  nomeContatoAdicional: string;
};

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
    return normalized.split('@')[0].replace(/\D/g, '');
  }

  if (normalized.includes('@lid') || normalized.includes('@g.us')) {
    return '';
  }

  return normalized.replace(/\D/g, '');
}

export function ehTelefoneProvavel(value: unknown): value is string {
  return typeof value === 'string' && /^\d{8,15}$/.test(value);
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
      values.add(digits);
      if (normalizedChannel === 'WHATSAPP' && ehTelefoneProvavel(digits)) {
        values.add(`${digits}@s.whatsapp.net`);
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

      if (digits) {
        push('WHATSAPP', digits, 'WhatsApp');
      }

      continue;
    }

    if (normalizedChannel === 'TELEGRAM') {
      if (normalized) {
        push('TELEGRAM_ID', normalized, 'Telegram ID');
      }
      if (digits) {
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
