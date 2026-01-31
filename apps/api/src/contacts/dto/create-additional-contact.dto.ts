import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAdditionalContactDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
