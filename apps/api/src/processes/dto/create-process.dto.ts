import {
    IsString,
    IsOptional,
    IsEnum,
    IsNotEmpty,
    ValidateIf,
    IsArray,
    ValidateNested,
    IsBoolean,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportedPartyDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    document?: string | null;

    @IsOptional()
    @IsString()
    rg?: string | null;

    @IsOptional()
    @IsString()
    birthDate?: string | null;

    @IsOptional()
    @IsString()
    motherName?: string | null;

    @IsOptional()
    @IsString()
    fatherName?: string | null;

    @IsOptional()
    @IsString()
    profession?: string | null;

    @IsOptional()
    @IsString()
    nationality?: string | null;

    @IsOptional()
    @IsString()
    civilStatus?: string | null;

    @IsOptional()
    @IsString()
    address?: string | null;

    @IsOptional()
    @IsString()
    qualificationText?: string | null;

    @IsOptional()
    @IsString()
    phone?: string | null;

    @IsOptional()
    @IsString()
    email?: string | null;

    @IsOptional()
    @IsString()
    oab?: string | null;

    @IsOptional()
    @IsArray()
    representedNames?: string[] | null;

    @IsOptional()
    @IsBoolean()
    isClient?: boolean;

    @IsOptional()
    @IsBoolean()
    isOpposing?: boolean;
}

export class CreateProcessDto {
    @IsOptional()
    @IsString()
    tenantId?: string;

    @IsOptional()
    @IsString()
    contactId?: string;

    @IsEnum(['JUDICIAL', 'EXTRAJUDICIAL', 'ADMINISTRATIVO'], {
        message: 'Categoria deve ser JUDICIAL, EXTRAJUDICIAL ou ADMINISTRATIVO.',
    })
    category: 'JUDICIAL' | 'EXTRAJUDICIAL' | 'ADMINISTRATIVO';

    @ValidateIf((o) => o.category === 'JUDICIAL')
    @IsNotEmpty({ message: 'CNJ é obrigatório para processos judiciais.' })
    @IsString()
    cnj?: string;

    @ValidateIf((o) => o.category === 'EXTRAJUDICIAL' || o.category === 'ADMINISTRATIVO')
    @IsNotEmpty({ message: 'Título é obrigatório para casos extrajudiciais.' })
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    folder?: string;

    @IsOptional()
    @IsString()
    localFolder?: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    value?: number | string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    court?: string;

    @IsOptional()
    @IsString()
    courtSystem?: string;

    @IsOptional()
    @IsString()
    vars?: string;

    @IsOptional()
    @IsString()
    district?: string;

    @IsOptional()
    @IsString()
    area?: string;

    @IsOptional()
    @IsString()
    class?: string;

    @IsOptional()
    distributionDate?: string | Date;

    @IsOptional()
    @IsString()
    judge?: string;

    @IsOptional()
    @IsString()
    responsibleLawyer?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportedPartyDto)
    parties?: ImportedPartyDto[];

    @IsOptional()
    metadata?: any;

    @IsOptional()
    @IsString()
    workflowId?: string;
}
