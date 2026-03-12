import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAdditionalContactDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsString()
  nomeContatoAdicional?: string;
}
