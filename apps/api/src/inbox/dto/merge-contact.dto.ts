import { IsNotEmpty, IsString } from 'class-validator';

export class MergeContactDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID do contato de destino (permanente) é obrigatório.' })
  targetContactId: string;

  @IsString()
  @IsNotEmpty({ message: 'O ID do contato de origem (a ser mesclado) é obrigatório.' })
  sourceContactId: string;
}
