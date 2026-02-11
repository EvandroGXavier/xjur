import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'O nome do escritório (Empresa) é obrigatório.' })
  @IsString()
  tenantName: string;

  @IsNotEmpty({ message: 'O documento (CPF/CNPJ) é obrigatório.' })
  @IsString()
  @Length(11, 14, { message: 'O documento deve ter entre 11 e 14 caracteres.' })
  document: string;

  @IsNotEmpty({ message: 'O nome do administrador é obrigatório.' })
  @IsString()
  adminName: string;

  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Forneça um endereço de e-mail válido.' })
  email: string;

  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password: string;

  @IsNotEmpty({ message: 'O telefone/celular é obrigatório.' })
  @IsString()
  mobile: string;
}
