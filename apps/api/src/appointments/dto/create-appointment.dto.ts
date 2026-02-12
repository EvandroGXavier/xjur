
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum AppointmentType {
  AUDIENCIA = 'AUDIENCIA',
  PRAZO = 'PRAZO',
  REUNIAO = 'REUNIAO',
  INTIMACAO = 'INTIMACAO',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
  RESCHEDULED = 'RESCHEDULED',
}

export class CreateParticipantDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsNotEmpty()
  @IsDateString()
  startAt: string;

  @IsNotEmpty()
  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  recurrence?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParticipantDto)
  participants?: CreateParticipantDto[];
}
