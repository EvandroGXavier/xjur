import { IsOptional, IsNumberString, IsString, IsIn, IsDateString } from 'class-validator';

/**
 * FilterContactDto — parâmetros de listagem e paginação da grid de contatos.
 *
 * Retorno paginado: { data: Contact[], meta: { total, page, limit, totalPages } }
 *   - Limite máximo: 200 registros por página
 *   - Default: page=1, limit=50
 */
export class FilterContactDto {
  // --- Paginação ---
  @IsOptional()
  @IsNumberString({}, { message: 'page deve ser um número' })
  page?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'limit deve ser um número' })
  limit?: string;

  // --- Busca global ---
  @IsOptional()
  @IsString()
  search?: string;

  // --- TAGs ---
  @IsOptional()
  @IsString()
  includedTags?: string; // CSV de tagIds

  @IsOptional()
  @IsString()
  excludedTags?: string; // CSV de tagIds

  // --- Status ---
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'active deve ser true ou false' })
  active?: string;

  // --- Filtros PF ---
  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsString()
  motherName?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  naturality?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  civilStatus?: string;

  @IsOptional()
  @IsString()
  cnh?: string;

  @IsOptional()
  @IsString()
  cnhCategory?: string;

  @IsOptional()
  @IsString()
  nis?: string;

  @IsOptional()
  @IsString()
  pis?: string;

  @IsOptional()
  @IsString()
  ctps?: string;

  @IsOptional()
  @IsDateString()
  birthDateStart?: string;

  @IsOptional()
  @IsDateString()
  birthDateEnd?: string;

  @IsOptional()
  @IsNumberString()
  birthMonth?: string;

  // --- Filtros PJ ---
  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  // --- Filtros de Endereço ---
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  street?: string;

  // --- Filtros de Contato Adicional ---
  @IsOptional()
  @IsString()
  additionalValue?: string;

  @IsOptional()
  @IsString()
  additionalName?: string;

  // --- Filtros de Contrato ---
  @IsOptional()
  @IsString()
  contractDescription?: string;

  @IsOptional()
  @IsString()
  contractCounterparty?: string;
}
