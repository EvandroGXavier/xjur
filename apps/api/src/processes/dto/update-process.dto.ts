import { PartialType } from '@nestjs/mapped-types';
import { CreateProcessDto } from './create-process.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProcessDto extends PartialType(CreateProcessDto) {
    // Overrides: em update, category não é obrigatória
    @IsOptional()
    @IsString()
    category?: 'JUDICIAL' | 'EXTRAJUDICIAL' | 'ADMINISTRATIVO';
}
