import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactMappingDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  document?: string; // CPF/CNPJ

  @IsOptional()
  whatsapp?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  notes?: string;

  @IsOptional()
  address_street?: string;

  @IsOptional()
  address_number?: string;

  @IsOptional()
  address_city?: string;

  @IsOptional()
  address_state?: string;

  @IsOptional()
  address_zip?: string;

  // PJ Specifics
  @IsOptional()
  companyName?: string; // Razão Social

  @IsOptional()
  stateRegistration?: string; // Inscrição Estadual
}

export class ImportContactsDto {
  @IsArray()
  data: any[]; // The raw JSON data from the file

  @IsObject()
  @ValidateNested()
  @Type(() => ContactMappingDto)
  mapping: ContactMappingDto;

  @IsOptional()
  @IsEnum(['skip', 'update'], { message: 'duplicateAction must be one of: skip, update' })
  duplicateAction?: 'skip' | 'update' = 'skip';
}
