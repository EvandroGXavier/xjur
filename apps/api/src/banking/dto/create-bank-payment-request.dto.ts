import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBankPaymentRequestDto {
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
  @IsIn(['PIX'])
  paymentType?: 'PIX';
}
