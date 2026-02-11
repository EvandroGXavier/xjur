
/**
 * DR.X - FULL SYSTEM HEALTH CHECK
 * Executa testes E2E em todos os módulos principais.
 */

const BASE_URL = 'http://localhost:3000/api';
const EMAIL = 'admin@drx.local';
const PASSWORD = '123';

// Cores para o terminal
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

async function runTests() {
  console.log(`${colors.cyan}==========================================${colors.reset}`);
  console.log(`${colors.cyan}   DR.X - INICIANDO BATERIA DE TESTES E2E   ${colors.reset}`);
  console.log(`${colors.cyan}==========================================${colors.reset}\n`);

  let token = '';
  let tenantId = '';
  let userId = '';

  // 1. AUTHENTICATION
  try {
    console.log(`${colors.yellow}[AUTH] Autenticando...${colors.reset}`);
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    
    if (!loginRes.ok) throw new Error(`Falha no login: ${loginRes.status}`);
    const loginData = await loginRes.json();
    token = loginData.access_token;
    userId = loginData.user.id;
    tenantId = loginData.user.tenantId;

    if (!token) throw new Error('Token não recebido');
    console.log(`${colors.green}✔ Login Sucesso! User: ${loginData.user.name}${colors.reset}\n`);
  } catch (e) {
    console.error(`${colors.red}❌ ERRO CRÍTICO NO LOGIN: ${e.message}${colors.reset}`);
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. CONTACTS MODULE
  let contactId = '';
  try {
    console.log(`${colors.yellow}[CONTACTS] Testando criação...${colors.reset}`);
    const contactData = {
      name: `Contato Teste ${Date.now()}`,
      email: `teste${Date.now()}@drx.local`,
      phone: '11999999999',
      personType: 'PF',
      category: 'Teste Automatizado'
    };

    const createRes = await fetch(`${BASE_URL}/contacts`, {
      method: 'POST', headers, body: JSON.stringify(contactData)
    });
    if (!createRes.ok) throw new Error(`Erro POST Contacts: ${createRes.status}`);
    const contact = await createRes.json();
    contactId = contact.id;
    console.log(`${colors.green}✔ Contato Criado: ${contact.name} (ID: ${contact.id})${colors.reset}`);

    // Update
    console.log(`${colors.yellow}[CONTACTS] Testando edição...${colors.reset}`);
    const updateRes = await fetch(`${BASE_URL}/contacts/${contactId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ notes: 'Atualizado pelo robô' })
    });
    if (!updateRes.ok) throw new Error(`Erro PATCH Contacts: ${updateRes.status}`);
    console.log(`${colors.green}✔ Contato Atualizado com sucesso${colors.reset}\n`);

  } catch (e) {
    console.error(`${colors.red}❌ ERRO EM CONTACTS: ${e.message}${colors.reset}\n`);
  }

  // 3. FINANCIAL MODULE
  try {
    console.log(`${colors.yellow}[FINANCIAL] Testando lançamentos...${colors.reset}`);
    const recordData = {
      tenantId: tenantId,
      description: `Despesa Teste ${Date.now()}`,
      amount: 150.50,
      type: 'EXPENSE',
      status: 'PAID',
      dueDate: new Date().toISOString(),
      paymentMethod: 'PIX',
      category: 'Testes'
    };

    const finRes = await fetch(`${BASE_URL}/financial/records`, {
      method: 'POST', headers, body: JSON.stringify(recordData)
    });
    
    // NOTA: Se o endpoint falhar, pode ser validação. Vamos ler o erro.
    if (!finRes.ok) {
        const errTxt = await finRes.text();
        throw new Error(`Erro POST Financial: ${finRes.status} - ${errTxt}`);
    }
    const record = await finRes.json();
    console.log(`${colors.green}✔ Despesa Lançada: ${record.description} - R$ ${record.amount}${colors.reset}\n`);

  } catch (e) {
    console.error(`${colors.red}❌ ERRO EM FINANCIAL: ${e.message}${colors.reset}\n`);
  }

  // 4. USERS MODULE (Read Only)
  try {
    console.log(`${colors.yellow}[USERS] Listando usuários...${colors.reset}`);
    const usersRes = await fetch(`${BASE_URL}/users`, { headers });
    if (!usersRes.ok) throw new Error(`Erro GET Users`);
    const users = await usersRes.json();
    console.log(`${colors.green}✔ ${users.length} usuários encontrados.${colors.reset}\n`);
  } catch (e) {
    console.error(`${colors.red}❌ ERRO EM USERS: ${e.message}${colors.reset}\n`);
  }

  console.log(`${colors.cyan}==========================================${colors.reset}`);
  console.log(`${colors.cyan}   BATERIA DE TESTES FINALIZADA           ${colors.reset}`);
  console.log(`${colors.cyan}==========================================${colors.reset}`);
}

runTests();
