export const normalizeDigits = (value?: string | null) => {
  return (value || '').replace(/\D/g, '');
};

export const isValidCpf = (value?: string | null) => {
  const digits = normalizeDigits(value);
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
};

export const isValidCnpj = (value?: string | null) => {
  const digits = normalizeDigits(value);
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
};
