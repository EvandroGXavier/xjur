export const masks = {
  cpf: (value: string) => {
    const input = String(value ?? '');
    return input
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  cnpj: (value: string) => {
    const input = String(value ?? '');
    return input
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  phone: (value: string) => {
    const input = String(value ?? '');
    const digits = input.replace(/\D/g, '');
    
    if (digits.length <= 10) {
      // (00) 0000-0000
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 14);
    } else {
      // (00) 00000-0000
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
    }
  },

  cep: (value: string) => {
    const input = String(value ?? '');
    return input
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  },

  cnj: (value: string) => {
    // Padronização: 0000000-00.0000.0.00.0000
    // Remove tudo que não é dígito ou letra
    const input = String(value ?? '');
    const raw = input.replace(/[^\dA-Z]/gi, '').toUpperCase();
    const digits = raw.replace(/\D/g, '');
    const suffix = raw.replace(/[\d]/g, '').substring(0, 2);

    let res = '';
    if (digits.length > 0) {
      res = digits.substring(0, 7);
      if (digits.length > 7) res += '-' + digits.substring(7, 9);
      if (digits.length > 9) res += '.' + digits.substring(9, 13);
      if (digits.length > 13) res += '.' + digits.substring(13, 14);
      if (digits.length > 14) res += '.' + digits.substring(14, 16);
      if (digits.length > 16) res += '.' + digits.substring(16, 20);
    }

    if (suffix.length > 0 && digits.length >= 20) {
      res += '/' + suffix;
    } else if (suffix.length > 0) {
      // Se tiver letra mas ainda não completou os 20 dígitos,
      // permite apenas no final se o usuário digitar
      res += '/' + suffix;
    }

    return res;
  },

  currency: (value: string) => {
    const input = String(value ?? '');
    const number = input.replace(/\D/g, '');
    const result = (Number(number) / 100)
      .toFixed(2)
      .replace('.', ',')
      .replace(/(\d)(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${result}`;
  },

  date: (value: string) => {
    const input = String(value ?? '');
    return input
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{4})\d+?$/, '$1');
  },
};

export const unmask = (value: string) => {
  return value.replace(/\D/g, '');
};

export const isValidCpf = (value: string) => {
  const digits = unmask(value || '');

  if (digits.length !== 11) return false;
  if (/(^(\d)\1{10}$)/.test(digits)) return false;

  const calculateDigit = (base: string) => {
    let total = 0;
    let multiplier = base.length + 1;

    for (const digit of base) {
      total += Number(digit) * multiplier--;
    }

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 9));
  const secondDigit = calculateDigit(digits.slice(0, 10));

  return digits.endsWith(`${firstDigit}${secondDigit}`);
};

export const isValidCnpj = (value: string) => {
  const digits = unmask(value || '');

  if (digits.length !== 14) return false;
  if (/(^(\d)\1{13}$)/.test(digits)) return false;

  const calculateDigit = (base: string, factor: number) => {
    let total = 0;

    for (const digit of base) {
      total += Number(digit) * factor;
      factor = factor === 2 ? 9 : factor - 1;
    }

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), 5);
  const secondDigit = calculateDigit(digits.slice(0, 12) + String(firstDigit), 6);

  return digits.endsWith(`${firstDigit}${secondDigit}`);
};
