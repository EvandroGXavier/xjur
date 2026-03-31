import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  processId?: string;

  @IsOptional()
  @IsString()
  timelineId?: string;

  @IsOptional()
  @IsObject()
  snapshot?: any;

  @IsOptional()
  @IsEnum(['DRAFT', 'FINALIZED'])
  status?: 'DRAFT' | 'FINALIZED';
}
