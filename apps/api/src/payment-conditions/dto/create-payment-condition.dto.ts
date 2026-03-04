import { IsString, IsNumber, IsBoolean, IsOptional, ValidateNested, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentConditionInstallmentDto {
  @IsNumber()
  @Min(1)
  installment: number;

  @IsNumber()
  @Min(0)
  days: number;

  @IsNumber()
  @Min(0)
  percentage: number;
}

export class CreatePaymentConditionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  surcharge?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentConditionInstallmentDto)
  installments?: CreatePaymentConditionInstallmentDto[];
}
