import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateContactContractDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;

  @IsString()
  @IsNotEmpty()
  firstDueDate: string;

  @IsString()
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingFrequency: string;

  @IsString()
  @IsIn(['INCOME', 'EXPENSE'])
  transactionKind: string;

  @IsString()
  @IsIn(['CONTRACTOR', 'CONTRACTED'])
  counterpartyRole: string;

  @IsString()
  @IsNotEmpty()
  counterpartyName: string;

  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'ENDED'])
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateContactContractDto extends CreateContactContractDto {}
