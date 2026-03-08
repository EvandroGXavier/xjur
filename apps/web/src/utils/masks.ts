export const masks = {
  cpf: (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  cnpj: (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  phone: (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  },

  cep: (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  },

  cnj: (value: string) => {
    // Padronização: 0000000-00.0000.0.00.0000
    // Remove tudo que não é dígito ou letra
    const raw = value.replace(/[^\dA-Z]/gi, '').toUpperCase();
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
      const number = value.replace(/\D/g, '');
      const result = (Number(number) / 100).toFixed(2)
        .replace('.', ',')
        .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      return `R$ ${result}`;
  },
  
  date: (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{4})\d+?$/, '$1');
  }
};

export const unmask = (value: string) => {
    return value.replace(/\D/g, '');
};
