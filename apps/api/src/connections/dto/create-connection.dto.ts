
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export enum ConnectionType {
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
}

export class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ConnectionType)
  type: ConnectionType;

  @IsObject()
  @IsOptional()
  config?: any;
}
