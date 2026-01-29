#!/usr/bin/env node

/**
 * Script de Teste Automatizado - Módulo de Contatos DR.X
 * 
 * Este script testa todas as funcionalidades da API de contatos:
 * - CRUD de contatos (PF e PJ)
 * - CRUD de endereços
 * - Enriquecimento de dados (CNPJ e CEP)
 */

const API_URL = process.env.API_URL || 'http://api.dr-x.xtd.com.br';

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Variáveis para armazenar IDs criados durante os testes
let contactPFId = null;
let contactPJId = null;
let addressId = null;

// Contador de testes
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Função auxiliar para fazer requisições HTTP
async function request(method, endpoint, body = null) {
  const url = `${API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = response.ok ? await response.json() : null;
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    return { status: 0, data: null, ok: false, error: error.message };
  }
}

// Função para exibir resultado do teste
function testResult(testName, passed, message = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
  } else {
    failedTests++;
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (message) {
      console.log(`  ${colors.yellow}→${colors.reset} ${message}`);
    }
  }
}

// Função para exibir cabeçalho de seção
function section(title) {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);
}

// ============================================================================
// TESTES
// ============================================================================

async function testCreateContactPF() {
  section('1. CRIAR CONTATO - PESSOA FÍSICA');

  const contactData = {
    name: 'João da Silva Teste',
    personType: 'PF',
    cpf: '12345678900',
    rg: 'MG1234567',
    birthDate: '1990-01-15',
    phone: '31999887766',
    email: 'joao.teste@email.com',
    category: 'Cliente',
  };

  const result = await request('POST', '/contacts', contactData);
  
  testResult(
    'POST /contacts - Criar Pessoa Física',
    result.ok && result.status === 201,
    result.ok ? `ID: ${result.data.id}` : `Status: ${result.status}`
  );

  if (result.ok) {
    contactPFId = result.data.id;
    testResult(
      'Verificar campos retornados',
      result.data.name === contactData.name && result.data.personType === 'PF',
      `Nome: ${result.data.name}, Tipo: ${result.data.personType}`
    );
  }
}

async function testCreateContactPJ() {
  section('2. CRIAR CONTATO - PESSOA JURÍDICA');

  const contactData = {
    name: 'Empresa Teste Ltda',
    personType: 'PJ',
    cnpj: '12345678000190',
    companyName: 'Empresa Teste Serviços Ltda',
    stateRegistration: '123456789',
    phone: '31999887766',
    email: 'contato@empresateste.com',
    category: 'Cliente',
  };

  const result = await request('POST', '/contacts', contactData);
  
  testResult(
    'POST /contacts - Criar Pessoa Jurídica',
    result.ok && result.status === 201,
    result.ok ? `ID: ${result.data.id}` : `Status: ${result.status}`
  );

  if (result.ok) {
    contactPJId = result.data.id;
    testResult(
      'Verificar campos retornados',
      result.data.name === contactData.name && result.data.personType === 'PJ',
      `Nome: ${result.data.name}, Tipo: ${result.data.personType}`
    );
  }
}

async function testReadContacts() {
  section('3. LISTAR E BUSCAR CONTATOS');

  // Listar todos
  const listResult = await request('GET', '/contacts');
  testResult(
    'GET /contacts - Listar todos os contatos',
    listResult.ok && Array.isArray(listResult.data),
    listResult.ok ? `Total: ${listResult.data.length} contatos` : `Status: ${listResult.status}`
  );

  // Buscar por ID (PF)
  if (contactPFId) {
    const getResult = await request('GET', `/contacts/${contactPFId}`);
    testResult(
      'GET /contacts/:id - Buscar Pessoa Física por ID',
      getResult.ok && getResult.data.id === contactPFId,
      getResult.ok ? `Nome: ${getResult.data.name}` : `Status: ${getResult.status}`
    );

    testResult(
      'Verificar inclusão de addresses',
      getResult.ok && Array.isArray(getResult.data.addresses),
      getResult.ok ? `Endereços: ${getResult.data.addresses.length}` : 'Falha'
    );
  }

  // Buscar por ID (PJ)
  if (contactPJId) {
    const getResult = await request('GET', `/contacts/${contactPJId}`);
    testResult(
      'GET /contacts/:id - Buscar Pessoa Jurídica por ID',
      getResult.ok && getResult.data.id === contactPJId,
      getResult.ok ? `Nome: ${getResult.data.name}` : `Status: ${getResult.status}`
    );
  }
}

async function testUpdateContact() {
  section('4. ATUALIZAR CONTATO');

  if (!contactPFId) {
    console.log(`${colors.yellow}⚠ Pulando testes de atualização (contato não criado)${colors.reset}`);
    return;
  }

  const updateData = {
    name: 'João da Silva Atualizado',
    email: 'joao.atualizado@email.com',
  };

  const result = await request('PATCH', `/contacts/${contactPFId}`, updateData);
  
  testResult(
    'PATCH /contacts/:id - Atualizar dados básicos',
    result.ok && result.data.name === updateData.name,
    result.ok ? `Novo nome: ${result.data.name}` : `Status: ${result.status}`
  );
}

async function testAddAddress() {
  section('5. ADICIONAR ENDEREÇO');

  if (!contactPFId) {
    console.log(`${colors.yellow}⚠ Pulando testes de endereço (contato não criado)${colors.reset}`);
    return;
  }

  const addressData = {
    street: 'Rua das Flores',
    number: '123',
    city: 'Belo Horizonte',
    state: 'MG',
    zipCode: '30130100',
  };

  const result = await request('POST', `/contacts/${contactPFId}/addresses`, addressData);
  
  testResult(
    'POST /contacts/:id/addresses - Adicionar endereço',
    result.ok && result.status === 201,
    result.ok ? `ID: ${result.data.id}` : `Status: ${result.status}`
  );

  if (result.ok) {
    addressId = result.data.id;
  }
}

async function testUpdateAddress() {
  section('6. ATUALIZAR ENDEREÇO');

  if (!contactPFId || !addressId) {
    console.log(`${colors.yellow}⚠ Pulando teste de atualização de endereço${colors.reset}`);
    return;
  }

  const updateData = {
    number: '456',
  };

  const result = await request('PATCH', `/contacts/${contactPFId}/addresses/${addressId}`, updateData);
  
  testResult(
    'PATCH /contacts/:id/addresses/:addressId - Atualizar endereço',
    result.ok && result.data.number === updateData.number,
    result.ok ? `Novo número: ${result.data.number}` : `Status: ${result.status}`
  );
}

async function testEnrichCNPJ() {
  section('7. ENRIQUECIMENTO DE DADOS - CNPJ');

  // CNPJ válido (Natura)
  const validResult = await request('GET', '/contacts/enrich/cnpj?cnpj=27865757000102');
  testResult(
    'GET /contacts/enrich/cnpj - CNPJ válido (Natura)',
    validResult.ok && validResult.data.razao_social,
    validResult.ok ? `Razão Social: ${validResult.data.razao_social}` : `Status: ${validResult.status}`
  );

  // CNPJ inválido
  const invalidResult = await request('GET', '/contacts/enrich/cnpj?cnpj=00000000000000');
  testResult(
    'GET /contacts/enrich/cnpj - CNPJ inválido',
    !invalidResult.ok && (invalidResult.status === 400 || invalidResult.status === 404),
    `Status: ${invalidResult.status}`
  );

  // CNPJ com formato incorreto
  const malformedResult = await request('GET', '/contacts/enrich/cnpj?cnpj=123');
  testResult(
    'GET /contacts/enrich/cnpj - Formato incorreto',
    !malformedResult.ok && malformedResult.status === 400,
    `Status: ${malformedResult.status}`
  );
}

async function testEnrichCEP() {
  section('8. ENRIQUECIMENTO DE DADOS - CEP');

  // CEP válido
  const validResult = await request('GET', '/contacts/enrich/cep?cep=30130100');
  testResult(
    'GET /contacts/enrich/cep - CEP válido (BH)',
    validResult.ok && validResult.data.localidade === 'Belo Horizonte',
    validResult.ok ? `Logradouro: ${validResult.data.logradouro}` : `Status: ${validResult.status}`
  );

  // CEP inválido
  const invalidResult = await request('GET', '/contacts/enrich/cep?cep=00000000');
  testResult(
    'GET /contacts/enrich/cep - CEP inválido',
    !invalidResult.ok && invalidResult.status === 404,
    `Status: ${invalidResult.status}`
  );

  // CEP com formato incorreto
  const malformedResult = await request('GET', '/contacts/enrich/cep?cep=123');
  testResult(
    'GET /contacts/enrich/cep - Formato incorreto',
    !malformedResult.ok && malformedResult.status === 400,
    `Status: ${malformedResult.status}`
  );
}

async function testDeleteAddress() {
  section('9. EXCLUIR ENDEREÇO');

  if (!contactPFId || !addressId) {
    console.log(`${colors.yellow}⚠ Pulando teste de exclusão de endereço${colors.reset}`);
    return;
  }

  const result = await request('DELETE', `/contacts/${contactPFId}/addresses/${addressId}`);
  
  testResult(
    'DELETE /contacts/:id/addresses/:addressId - Excluir endereço',
    result.ok,
    `Status: ${result.status}`
  );
}

async function testDeleteContacts() {
  section('10. EXCLUIR CONTATOS');

  // Excluir Pessoa Física
  if (contactPFId) {
    const result = await request('DELETE', `/contacts/${contactPFId}`);
    testResult(
      'DELETE /contacts/:id - Excluir Pessoa Física',
      result.ok,
      `Status: ${result.status}`
    );
  }

  // Excluir Pessoa Jurídica
  if (contactPJId) {
    const result = await request('DELETE', `/contacts/${contactPJId}`);
    testResult(
      'DELETE /contacts/:id - Excluir Pessoa Jurídica',
      result.ok,
      `Status: ${result.status}`
    );
  }
}

async function testValidations() {
  section('11. VALIDAÇÕES');

  // Tentar criar contato sem campos obrigatórios
  const invalidData = {
    name: '',
    phone: '',
  };

  const result = await request('POST', '/contacts', invalidData);
  testResult(
    'POST /contacts - Validação de campos obrigatórios',
    !result.ok && result.status === 400,
    `Status: ${result.status}`
  );

  // Tentar criar contato com personType inválido
  const invalidTypeData = {
    name: 'Teste',
    phone: '31999887766',
    personType: 'INVALID',
  };

  const typeResult = await request('POST', '/contacts', invalidTypeData);
  testResult(
    'POST /contacts - Validação de personType',
    !typeResult.ok && typeResult.status === 400,
    `Status: ${typeResult.status}`
  );
}

// ============================================================================
// EXECUTAR TODOS OS TESTES
// ============================================================================

async function runAllTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTE AUTOMATIZADO - MÓDULO DE CONTATOS DR.X             ║${colors.reset}`);
  console.log(`${colors.blue}║  API: ${API_URL.padEnd(48)} ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);

  const startTime = Date.now();

  try {
    await testCreateContactPF();
    await testCreateContactPJ();
    await testReadContacts();
    await testUpdateContact();
    await testAddAddress();
    await testUpdateAddress();
    await testEnrichCNPJ();
    await testEnrichCEP();
    await testDeleteAddress();
    await testDeleteContacts();
    await testValidations();
  } catch (error) {
    console.error(`\n${colors.red}Erro fatal durante os testes:${colors.reset}`, error);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Resumo
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}RESUMO DOS TESTES${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`Total de testes: ${totalTests}`);
  console.log(`${colors.green}Aprovados: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Reprovados: ${failedTests}${colors.reset}`);
  console.log(`Tempo de execução: ${duration}s`);
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  console.log(`\nTaxa de sucesso: ${successRate >= 80 ? colors.green : colors.red}${successRate}%${colors.reset}\n`);

  // Código de saída
  process.exit(failedTests > 0 ? 1 : 0);
}

// Executar
runAllTests();
