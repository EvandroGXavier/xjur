import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateAssetTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateContactAssetDto {
  @IsString()
  @IsNotEmpty()
  assetTypeId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  acquisitionDate: string;

  @IsNumber()
  @IsNotEmpty()
  value: number;

  @IsDateString()
  @IsOptional()
  writeOffDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateContactAssetDto extends CreateContactAssetDto {}
