import { IsString, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}
