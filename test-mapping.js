const axios = require('axios');

async function testBackendMapping() {
  const cnpj = '06990590000123'; // Google Brasil
  
  // receitaws
  try {
     const r1 = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
     console.log('ReceitaWS logradouro:', r1.data.logradouro);
  } catch(e) {}

  // brasilapi
  try {
     const r2 = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
     const data = r2.data;
     
     const mapped = {
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
        atividades_secundarias: data.cnaes_secundarios?.map((c) => ({
            code: c.code,
            text: c.text
        })) || [],
        qsa: data.qsa?.map((q) => ({
            nome: q.nome_socio,
            qual: q.qualificacao_socio,
            pais_origem: q.pais,
            nome_rep_legal: q.nome_representante_legal,
            qual_rep_legal: q.qualificacao_representante_legal
        })) || []
     };
     console.log('BrasilAPI Mapped logradouro:', mapped.logradouro);
  } catch(e) {}
}

testBackendMapping();
