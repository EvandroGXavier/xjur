import { PartialType } from '@nestjs/mapped-types';
import { CreateBankIntegrationDto } from './create-bank-integration.dto';

export class UpdateBankIntegrationDto extends PartialType(
  CreateBankIntegrationDto,
) {}
