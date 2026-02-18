import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'AUDIO', 'FILE'])
  contentType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  scheduledAt?: string; // ISO String from frontend
}
