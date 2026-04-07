import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SyncBankIntegrationDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  forceMockData?: boolean;
}
