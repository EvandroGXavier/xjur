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
    // Formato: 0000000-00.0000.0.00.0000
    return value
      .replace(/\D/g, '')
      .replace(/(\d{7})(\d)/, '$1-$2')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{4})(\d)/, '$1.$2')
      .replace(/(\d{1})(\d)/, '$1.$2')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{4})\d+?$/, '$1');
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
