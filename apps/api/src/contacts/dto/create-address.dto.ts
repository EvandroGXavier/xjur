import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  zipCode: string;

  @IsString()
  @MinLength(3, { message: 'Logradouro deve ter pelo menos 3 caracteres' })
  street: string;

  @IsString()
  number: string;

  @IsString()
  @IsOptional()
  complement?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @MinLength(2, { message: 'Cidade deve ter pelo menos 2 caracteres' })
  city: string;

  @IsString()
  @MinLength(2, { message: 'Estado deve ter 2 caracteres' })
  @MaxLength(2, { message: 'Estado deve ter 2 caracteres' })
  state: string;
}
