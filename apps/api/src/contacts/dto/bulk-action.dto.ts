import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum ContactBulkActionType {
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  UPDATE_CATEGORY = 'UPDATE_CATEGORY',
  DELETE_ALL = 'DELETE_ALL',
}

export class ContactBulkActionDto {
  @IsEnum(ContactBulkActionType)
  action: ContactBulkActionType;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  contactIds?: string[]; // If empty, use filters

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  includedTags?: string;

  @IsOptional()
  @IsString()
  excludedTags?: string;
}
