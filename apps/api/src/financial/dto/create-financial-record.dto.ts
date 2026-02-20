import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFinancialPartyDto {
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsIn(['CREDITOR', 'DEBTOR'])
  role: 'CREDITOR' | 'DEBTOR';

  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class CreateFinancialRecordDto {
  @IsString()
  @IsNotEmpty({ message: 'TenantId é obrigatório' })
  tenantId: string;

  @IsOptional()
  @IsString()
  processId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  description: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Valor deve ser um número' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate: string; // ISO date string

  @IsOptional()
  @IsDateString({}, { message: 'Data de pagamento inválida' })
  paymentDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE'], { message: 'Status inválido' })
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';

  @IsString()
  @IsIn(['INCOME', 'EXPENSE'], { message: 'Tipo inválido' })
  type: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PIX', 'BOLETO', 'TED', 'DINHEIRO', 'CARTAO'], { message: 'Forma de pagamento inválida' })
  paymentMethod?: 'PIX' | 'BOLETO' | 'TED' | 'DINHEIRO' | 'CARTAO';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFinancialPartyDto)
  parties?: CreateFinancialPartyDto[];
}
