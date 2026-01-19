import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  document?: string; // CPF/CNPJ (Opcional)

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @IsString()
  @MinLength(10, { message: 'Telefone deve ter pelo menos 10 dígitos' })
  phone: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
