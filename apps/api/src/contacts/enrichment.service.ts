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
    try {
      // Remove formatação do CNPJ
      const cleanCNPJ = cnpj.replace(/\D/g, '');
      
      if (cleanCNPJ.length !== 14) {
        throw new HttpException('CNPJ inválido', HttpStatus.BAD_REQUEST);
      }

      // API pública da Receita Federal (via ReceitaWS)
      const response = await axios.get(
        `https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'DR.X Sistema Jurídico',
          },
        }
      );

      if (response.data.status === 'ERROR') {
        throw new HttpException(
          response.data.message || 'CNPJ não encontrado',
          HttpStatus.NOT_FOUND
        );
      }

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new HttpException(
            'Limite de requisições excedido. Tente novamente em alguns minutos.',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
        throw new HttpException(
          'Erro ao consultar CNPJ na Receita Federal',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      throw new HttpException(
        'Erro interno ao consultar CNPJ',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
