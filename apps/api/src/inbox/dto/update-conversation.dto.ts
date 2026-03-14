import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  queue?: string | null;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  processId?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  waitingReply?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  unreadCount?: number;
}
