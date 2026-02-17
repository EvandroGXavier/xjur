import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string; // Optional initial message

  @IsOptional()
  @IsString()
  contactId?: string;   // Existing contact

  @IsOptional()
  @IsString()
  contactPhone?: string; // Or dynamic creation

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEnum(['WHATSAPP', 'EMAIL', 'PHONE', 'WEBCHAT'])
  channel: 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEBCHAT';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsEnum(['FINANCEIRO', 'JURIDICO', 'COMERCIAL', 'SUPORTE', 'DEFAULT'])
  queue?: 'FINANCEIRO' | 'JURIDICO' | 'COMERCIAL' | 'SUPORTE' | 'DEFAULT';

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
