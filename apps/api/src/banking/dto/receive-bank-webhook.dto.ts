import { IsObject, IsOptional, IsString } from 'class-validator';

export class ReceiveBankWebhookDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  externalEventId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
