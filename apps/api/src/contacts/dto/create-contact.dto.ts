import { IsString, IsOptional, IsEmail, MinLength, IsIn, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['PF', 'PJ'], { message: 'Tipo de pessoa deve ser PF ou PJ' })
  personType?: string;

  // Campos Pessoa Física
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cpf?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  rg?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value === "" ? null : value)
  birthDate?: string;

  // Campos Pessoa Jurídica
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  stateRegistration?: string;

  // Campos Gerais
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  document?: string; // CPF/CNPJ (Mantido para compatibilidade)

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @Transform(({ value }) => value === "" ? null : value)
  email?: string;

  @IsString()
  @MinLength(10, { message: 'Telefone deve ter pelo menos 10 dígitos' })
  phone: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  notes?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  category?: string; // Cliente, Fornecedor, Parte Contrária, etc.
}
