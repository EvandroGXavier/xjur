import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBankChargeDto {
  @IsString()
  @IsNotEmpty()
  bankIntegrationId: string;

  @IsString()
  @IsNotEmpty()
  financialRecordId: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PIX', 'BOLETO'])
  chargeType?: 'PIX' | 'BOLETO';

  @IsOptional()
  @IsString()
  dueDate?: string;
}
