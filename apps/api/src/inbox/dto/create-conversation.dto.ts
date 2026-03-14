import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  channel: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  processId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  queue?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  externalThreadId?: string;

  @IsOptional()
  @IsString()
  externalParticipantId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsString()
  initialMessage?: string;
}
