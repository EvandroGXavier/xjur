import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsIn(['SYSTEM', 'LIGHT', 'DARK'])
  theme?: string;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean;

  @IsOptional()
  @IsIn(['LAST', 'HOME'])
  startupModuleMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  homeModuleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastModuleId?: string;

  // EspaÃ§o para evoluÃ§Ã£o sem precisar criar colunas a cada nova preferÃªncia.
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}

