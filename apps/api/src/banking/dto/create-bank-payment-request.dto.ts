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

  @IsOptional()
  @IsString()
  @IsIn(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'])
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @IsOptional()
  @IsString()
  beneficiaryDocument?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
