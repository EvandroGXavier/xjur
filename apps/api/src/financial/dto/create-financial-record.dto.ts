import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn, IsDateString, IsArray, ValidateNested, IsBoolean, IsInt } from 'class-validator';
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

export class CreateTransactionSplitDto {
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsIn(['CREDITOR', 'DEBTOR'])
  role: 'CREDITOR' | 'DEBTOR';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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

  @IsOptional()
  @IsString()
  categoryId?: string;

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
  @IsIn(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE', 'PARTIAL'], { message: 'Status inválido' })
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE' | 'PARTIAL';

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

  // === ENCARGOS & DESCONTOS ===
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fine?: number; // Multa

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  interest?: number; // Juros

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monetaryCorrection?: number; // Correção monetária

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount?: number; // Desconto

  @IsOptional()
  @IsString()
  @IsIn(['VALUE', 'PERCENTAGE'], { message: 'Tipo de desconto inválido' })
  discountType?: 'VALUE' | 'PERCENTAGE';

  // === PARCELAMENTO ===
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  installmentNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalInstallments?: number;

  @IsOptional()
  @IsString()
  @IsIn(['MONTHLY', 'BIWEEKLY', 'WEEKLY', 'CUSTOM'], { message: 'Periodicidade inválida' })
  periodicity?: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'CUSTOM';

  @IsOptional()
  @IsBoolean()
  isResidual?: boolean;

  // === RELAÇÕES ===
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFinancialPartyDto)
  parties?: CreateFinancialPartyDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionSplitDto)
  splits?: CreateTransactionSplitDto[];
}

// DTO para parcelamento
export class CreateInstallmentsDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @Type(() => Number)
  @IsInt()
  @Min(2, { message: 'Mínimo de 2 parcelas' })
  numInstallments: number;

  @IsString()
  @IsIn(['MONTHLY', 'BIWEEKLY', 'WEEKLY'])
  periodicity: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';

  @IsString()
  @IsIn(['INCOME', 'EXPENSE'])
  type: 'INCOME' | 'EXPENSE';

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  firstDueDate: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  processId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFinancialPartyDto)
  parties?: CreateFinancialPartyDto[];
}

// DTO para pagamento parcial
export class PartialPaymentDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Valor pago deve ser maior que zero' })
  amountPaid: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO para liquidação com cálculo de encargos
export class SettleRecordDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fine?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  interest?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monetaryCorrection?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['VALUE', 'PERCENTAGE'])
  discountType?: 'VALUE' | 'PERCENTAGE';

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
