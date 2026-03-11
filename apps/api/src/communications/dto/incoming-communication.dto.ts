
import { IsString, IsNotEmpty, IsOptional, IsIn, IsObject } from 'class-validator';

export class IncomingCommunicationDto {
  @IsString()
  @IsNotEmpty()
  from: string; // Phone number or Email

  @IsString()
  @IsOptional()
  name?: string; // Name of sender if known

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsIn(['WHATSAPP', 'EMAIL', 'PHONE', 'WEBCHAT', 'INSTAGRAM', 'TELEGRAM'])
  channel: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string; // In real webhook, this comes from API Key or URL param


  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsString()
  @IsOptional()
  externalThreadId?: string;

  @IsString()
  @IsOptional()
  externalMessageId?: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
