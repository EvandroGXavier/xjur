import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  tags?: any;

  @IsOptional()
  @IsArray()
  tagIds?: string[];

  @IsOptional()
  @IsString()
  preferredStorage?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  sourceTemplateId?: string;
}
