import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean, IsIn, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'TenantId é obrigatório' })
  tenantId: string;

  @IsString()
  @IsNotEmpty({ message: 'Título da conta é obrigatório' })
  @MinLength(3, { message: 'Título deve ter pelo menos 3 caracteres' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome do banco é obrigatório' })
  bankName: string;

  @IsString()
  @IsIn(['CHECKING', 'SAVINGS'], { message: 'Tipo de conta inválido' })
  accountType: 'CHECKING' | 'SAVINGS';

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  agency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Saldo deve ser um número' })
  @Min(0, { message: 'Saldo não pode ser negativo' })
  balance?: number;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
