import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReconcileBankTransactionDto {
  @IsString()
  @IsNotEmpty()
  financialRecordId: string;

  @IsOptional()
  @IsString()
  matchType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
