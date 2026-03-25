import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateSystemTemplateDto {
  @IsString()
  systemKey: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  preferredStorage?: string;

  @IsOptional()
  metadata?: any;
}

export class UpdateSystemTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  preferredStorage?: string;

  @IsOptional()
  metadata?: any;
}

