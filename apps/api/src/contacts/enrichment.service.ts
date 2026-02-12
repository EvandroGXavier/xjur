import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal: string;
  cnae_fiscal_descricao: string;
  data_inicio_atividade: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string;
  
  // Expanded Data
  abertura: string;
  natureza_juridica: string;
  porte: string;
  capital_social: string;
  situacao: string;
  data_situacao: string;
  motivo_situacao: string;
  situacao_especial: string;
  data_situacao_especial: string;
  atividade_principal: Array<{ code: string; text: string }>;
  atividades_secundarias: Array<{ code: string; text: string }>;
  qsa: Array<{ 
    nome: string; 
    qual: string; // Qualificação (Sócio-Admin, etc)
    pais_origem?: string;
    nome_rep_legal?: string;
    qual_rep_legal?: string;
  }>;
}

export interface CEPData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
}

@Injectable()
export class EnrichmentService {
  /**
   * Consulta dados de CNPJ via API pública da Receita Federal
   * @param cnpj CNPJ sem formatação (apenas números)
   */
  async consultCNPJ(cnpj: string): Promise<CNPJData> {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) {
      throw new HttpException('CNPJ inválido', HttpStatus.BAD_REQUEST);
    }

    try {
      // Tentativa 1: ReceitaWS
      console.log(`Consulting CNPJ ${cleanCNPJ} via ReceitaWS...`);
      const response = await axios.get(`https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`, {
        timeout: 5000, // 5s timeout for primary
        headers: { 'User-Agent': 'DR.X Sistema Jurídico' }
      });

      if (response.data.status === 'ERROR') {
         // Se a API retornou erro explícito (ex: CNPJ não encontrado), não adianta tentar outro.
         throw new HttpException(response.data.message, HttpStatus.NOT_FOUND); 
      }

      return response.data;
    } catch (error: any) {
       // Se for erro de validação/negócio (404), relança.
       if (error instanceof HttpException) throw error;
       
       console.warn(`ReceitaWS failed for ${cleanCNPJ}, trying BrasilAPI fallback...`, error.message);

       // Tentativa 2: BrasilAPI
       try {
         const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`, {
            timeout: 10000 
         });
         const data = response.data;

         // Normalizar dados do BrasilAPI para o formato ReceitaWS (CNPJData)
         return {
            cnpj: data.cnpj,
            razao_social: data.razao_social,
            nome_fantasia: data.nome_fantasia,
            cnae_fiscal: data.cnae_fiscal_principal?.code,
            cnae_fiscal_descricao: data.cnae_fiscal_principal?.text,
            data_inicio_atividade: data.data_inicio_atividade,
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            ddd_telefone_1: data.ddd_telefone_1, // BrasilAPI pode retornar diferente, ajustar se necessário
            email: data.email, // Verificar se BrasilAPI retorna email
            
            // Expanded
            abertura: data.data_inicio_atividade, // ReceitaWS usa 'abertura'
            natureza_juridica: data.natureza_juridica,
            porte: data.porte,
            capital_social: data.capital_social, // Pode precisar de formatação
            situacao: data.situacao_cadastral,
            data_situacao: data.data_situacao_cadastral,
            motivo_situacao: data.motivo_situacao_cadastral,
            situacao_especial: data.situacao_especial,
            data_situacao_especial: data.data_situacao_especial,
            atividade_principal: [{ 
                code: data.cnae_fiscal_principal?.code, 
                text: data.cnae_fiscal_principal?.text 
            }],
            atividades_secundarias: data.cnaes_secundarios?.map((c: any) => ({
                code: c.code,
                text: c.text
            })) || [],
            qsa: data.qsa?.map((q: any) => ({
                nome: q.nome_socio,
                qual: q.qualificacao_socio,
                pais_origem: q.pais,
                nome_rep_legal: q.nome_representante_legal,
                qual_rep_legal: q.qualificacao_representante_legal
            })) || []
         } as CNPJData;

       } catch (fallbackError: any) {
          console.error(`BrasilAPI also failed for ${cleanCNPJ}`, fallbackError.message);
          throw new HttpException(
            'Não foi possível consultar o CNPJ em nenhum dos serviços disponíveis.',
            HttpStatus.SERVICE_UNAVAILABLE
          );
       }
    }
  }

  /**
   * Consulta dados de CEP via ViaCEP
   * @param cep CEP com ou sem formatação
   */
  async consultCEP(cep: string): Promise<CEPData> {
    try {
      // Remove formatação do CEP
      const cleanCEP = cep.replace(/\D/g, '');
      
      if (cleanCEP.length !== 8) {
        throw new HttpException('CEP inválido', HttpStatus.BAD_REQUEST);
      }

      // API ViaCEP
      const response = await axios.get(
        `https://viacep.com.br/ws/${cleanCEP}/json/`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'DR.X Sistema Jurídico',
          },
        }
      );

      if (response.data.erro) {
        throw new HttpException('CEP não encontrado', HttpStatus.NOT_FOUND);
      }

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          'Erro ao consultar CEP no ViaCEP',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      throw new HttpException(
        'Erro interno ao consultar CEP',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
