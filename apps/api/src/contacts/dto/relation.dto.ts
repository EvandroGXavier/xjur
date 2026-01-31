import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateRelationTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  reverseName?: string;

  @IsBoolean()
  @IsOptional()
  isBilateral?: boolean;
}

export class CreateContactRelationDto {
  @IsString()
  @IsNotEmpty()
  toContactId: string;

  @IsString()
  @IsNotEmpty()
  relationTypeId: string;
}
