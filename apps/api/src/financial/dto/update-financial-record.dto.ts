import { PartialType } from '@nestjs/mapped-types';
import { CreateFinancialRecordDto } from './create-financial-record.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFinancialRecordDto extends PartialType(CreateFinancialRecordDto) {
  @IsOptional()
  @IsString()
  paymentConditionId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
