import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum ProcessBulkActionType {
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  UPDATE_STATUS = 'UPDATE_STATUS',
  UPDATE_LAWYER = 'UPDATE_LAWYER',
}

export class ProcessBulkActionDto {
  @IsEnum(ProcessBulkActionType)
  action: ProcessBulkActionType;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  lawyerName?: string;

  @IsOptional()
  @IsString()
  category?: string; // Filter by category (JUDICIAL/EXTRAJUDICIAL)

  @IsOptional()
  @IsArray()
  processIds?: string[]; // If empty, apply to filtered (category/status) or ALL
}
