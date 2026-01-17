export class CreateContactDto {
  name: string;
  document?: string; // CPF/CNPJ (Opcional)
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
}
