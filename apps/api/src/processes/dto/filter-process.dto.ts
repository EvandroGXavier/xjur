import { IsOptional, IsString, IsNumberString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProcessDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    includedTags?: string;

    @IsOptional()
    @IsString()
    excludedTags?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    advancedFilter?: string;

    @IsOptional()
    @IsString()
    updatedFrom?: string;

    @IsOptional()
    @IsString()
    updatedTo?: string;

    /** Página atual (começa em 1). Padrão: 1. */
    @IsOptional()
    @IsNumberString()
    page?: string;

    /** Registros por página. Padrão: 50. Máximo: 200. */
    @IsOptional()
    @IsNumberString()
    limit?: string;
}
