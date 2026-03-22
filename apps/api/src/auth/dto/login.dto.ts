import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Forneça um endereço de e-mail válido.' })
  email: string;

  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString({ message: 'A senha deve ser um texto.' })
  @MinLength(3, { message: 'A senha deve ter no mínimo 3 caracteres.' })
  password: string;

  // Se true, registra este computador como confiável e retorna um deviceToken persistente.
  @IsOptional()
  @IsBoolean({ message: 'trustDevice deve ser boolean.' })
  trustDevice?: boolean;

  // Nome amigável para identificação do dispositivo (ex: "Notebook - Chrome").
  @IsOptional()
  @IsString({ message: 'deviceName deve ser texto.' })
  @MaxLength(80, { message: 'deviceName deve ter no máximo 80 caracteres.' })
  deviceName?: string;

  // Token do dispositivo já confiável (enviado pelo frontend em logins futuros).
  @IsOptional()
  @IsString({ message: 'deviceToken deve ser texto.' })
  @MaxLength(200, { message: 'deviceToken inválido.' })
  deviceToken?: string;
}

