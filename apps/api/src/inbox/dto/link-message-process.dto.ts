import { IsOptional, IsString } from 'class-validator';

export class LinkMessageProcessDto {
  @IsString()
  processId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
