
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

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
  @IsIn(['WHATSAPP', 'EMAIL', 'PHONE', 'WEBCHAT'])
  channel: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string; // In real webhook, this comes from API Key or URL param
}
