import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  document?: string; // CPF/CNPJ (Opcional)

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
}
