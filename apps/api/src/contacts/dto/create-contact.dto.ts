import { IsString, IsOptional, IsEmail, MinLength, IsIn, IsDateString, IsNumber, IsArray, IsObject, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['LEAD', 'PF', 'PJ'], { message: 'Tipo de pessoa deve ser LEAD, PF ou PJ' })
  personType?: string;
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Campos Pessoa Física
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cpf?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  rg?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === "") ? null : value)
  birthDate?: string;
  
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  rgIssuer?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === "") ? null : value)
  rgIssueDate?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  nis?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  pis?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  ctps?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  motherName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  fatherName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  profession?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  nationality?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  naturality?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  gender?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  civilStatus?: string;

  // New Fields
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cnh?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cnhIssuer?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === "") ? null : value)
  cnhIssueDate?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === "") ? null : value)
  cnhExpirationDate?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cnhCategory?: string;

  // Campos Pessoa Jurídica
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  stateRegistration?: string;

  // Dados Expandidos PJ (Receita Federal)
  @IsOptional()
  @Transform(({ value }) => value === "" ? null : value)
  openingDate?: string | Date;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  legalNature?: string;

  @IsOptional()
  mainActivity?: any; // Json

  @IsOptional()
  sideActivities?: any; // Json

  @IsOptional()
  @Transform(({ value }) => value === "" ? null : value)
  shareCapital?: string | number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === "" ? null : value)
  statusDate?: string | Date;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  statusReason?: string;

  @IsOptional()
  @IsString()
  specialStatus?: string;

  @IsOptional()
  @Transform(({ value }) => value === "" ? null : value)
  specialStatusDate?: string | Date;

  @IsOptional()
  pjQsa?: any; // Json

  // Campos Gerais
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  document?: string; // CPF/CNPJ (Mantido para compatibilidade)

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @Transform(({ value }) => value === "" ? null : value)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  notes?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === "" ? null : value)
  category?: string; // Cliente, Fornecedor, Parte Contrária, etc.
}
