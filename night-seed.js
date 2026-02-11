
/**
 * DR.X - CARGA DE DADOS NOTURNA (SIMULAÇÃO COMPLETA) v2
 * Popula o sistema com dados fictícios para testes.
 */

const BASE_URL = 'http://localhost:3000/api';
const EMAIL = 'admin@drx.local';
const PASSWORD = '123';
const TIMESTAMP = Date.now();

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

async function seed() {
  console.log(`${colors.blue}==========================================${colors.reset}`);
  console.log(`${colors.blue}   DR.X - INICIANDO CARGA DE DADOS v2     ${colors.reset}`);
  console.log(`${colors.blue}==========================================${colors.reset}\n`);

  // 1. LOGIN
  let token, tenantId, userId;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Erro Login");
    token = data.access_token;
    tenantId = data.user.tenantId;
    userId = data.user.id;
    console.log(`${colors.green}✔ Login OK. Tenant: ${tenantId}${colors.reset}\n`);
  } catch (e) {
    console.error(`Falha no login: ${e.message}`);
    process.exit(1);
  }

  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // HELPER FUNCTION
  const post = async (endpoint, body, label) => {
    try {
      const r = await fetch(`${BASE_URL}/${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) {
        // Tentar ler a mensagem de erro detalhada
        const msg = Array.isArray(d.message) ? d.message.join(', ') : d.message;
        throw new Error(`${r.status} ${d.error || ''} - ${msg || JSON.stringify(d)}`);
      }
      console.log(`${colors.green}✔ ${label}: ${d.id || "OK"}${colors.reset}`);
      return d;
    } catch (e) {
      console.log(`${colors.red}❌ Erro ${label}: ${e.message}${colors.reset}`);
      return null;
    }
  };

  // 2. CONTATOS (Randomizados para evitar duplicidade)
  console.log(`${colors.yellow}[CARGA] Criando Contatos...${colors.reset}`);
  const c1 = await post("contacts", { 
      name: `Maria Silva ${TIMESTAMP}`, 
      personType: "PF", 
      email: `maria${TIMESTAMP}@example.com`, 
      phone: "11988887777", 
      category: "Cliente" 
  }, "Contato PF");
  
  const c2 = await post("contacts", { 
      name: `Tech Solutions ${TIMESTAMP}`, 
      personType: "PJ", 
      cnpj: `${TIMESTAMP}`.substring(0,14), 
      category: "Fornecedor" 
  }, "Contato PJ");

  // 3. PROCESSOS
  console.log(`${colors.yellow}\n[CARGA] Criando Processos...${colors.reset}`);
  if (c1) {
    await post("processes", {
      title: `Ação Cível ${TIMESTAMP}`,
      description: "Cobrança indevida.",
      status: "ATIVO",
      area: "Cível",
      value: 50000.00,
      contactId: c1.id,
      distributionDate: new Date().toISOString()
    }, "Processo Cível");
  }
  
  // 4. AGENDA
  console.log(`${colors.yellow}\n[CARGA] Criando Agenda...${colors.reset}`);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  await post("appointments", {
    title: `Audiência ${TIMESTAMP}`,
    description: "Conciliação",
    type: "AUDIENCIA",
    startAt: tomorrow.toISOString(),
    endAt: new Date(tomorrow.getTime() + 3600000).toISOString(),
    status: "SCHEDULED"
  }, "Audiência");

  // 5. FINANCEIRO
  console.log(`${colors.yellow}\n[CARGA] Criando Financeiro...${colors.reset}`);
  await post("financial/records", {
    tenantId, description: `Honorários ${TIMESTAMP}`,
    amount: 1500.00, type: "INCOME", status: "PAID",
    dueDate: new Date().toISOString(), paymentMethod: "PIX", category: "Honorários"
  }, "Receita");

  // 6. ESTOQUE (Tentativa com valores numéricos simples)
  console.log(`${colors.yellow}\n[CARGA] Criando Estoque...${colors.reset}`);
  // Tentar sem preços decimais para isolar o erro
  await post("products", {
    name: `Papel A4 ${TIMESTAMP}`,
    description: "Caixa 500 folhas",
    currentStock: 100,
    minStock: 10,
    // costPrice: 25.0, // Comentado para teste
    // sellPrice: 35.0  // Comentado para teste
  }, "Produto Simples");

  // 7. TICKETS
  console.log(`${colors.yellow}\n[CARGA] Criando Tickets...${colors.reset}`);
  if (c1) {
    await post("tickets", {
      title: `Suporte ${TIMESTAMP}`,
      description: "Cliente relata problema no acesso.",
      status: "OPEN",
      priority: "HIGH",
      channel: "WHATSAPP", // Verifique se é Enum
      contactId: c1.id,
      queue: "SUPORTE"
    }, "Ticket Suporte");
  }

  // 8. DOCUMENT CATEGORIES (Teste extra)
  console.log(`${colors.yellow}\n[CARGA] Documentos...${colors.reset}`);
  // Não temos DTO, mas vamos tentar GET
  try {
      const docs = await fetch(`${BASE_URL}/documents`, { headers });
      if(docs.ok) console.log(`${colors.green}✔ GET Documents: OK${colors.reset}`);
      else console.log(`${colors.red}❌ GET Documents: ${docs.status}${colors.reset}`);
  } catch(e) {}

  console.log(`${colors.blue}\n==========================================${colors.reset}`);
  console.log(`${colors.blue}   CARGA v2 CONCLUÍDA                     ${colors.reset}`);
  console.log(`${colors.blue}==========================================${colors.reset}`);
}

seed();
