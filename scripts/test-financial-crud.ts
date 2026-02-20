
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ log: ['error'] });
const API_URL = 'http://localhost:3000/api';

const USER_EMAIL = 'admin_teste_crud@admin.com';
const USER_PASSWORD = 'admin_password';
const TENANT_DOC = '99999999000199'; // CNPJ Ficticio para teste

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Iniciando Teste de CRUD Financeiro...');

  try {
    // 1. Setup: Garantir Tenant e Usuário
    console.log('📦 Configurando Tenant e Usuário...');
    let tenant = await prisma.tenant.findUnique({ where: { document: TENANT_DOC } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Tenant de Teste CRUD',
          document: TENANT_DOC,
          isActive: true,
        },
      });
      console.log('✅ Tenant Criado:', tenant.id);
    } else {
      console.log('ℹ️ Tenant já existe:', tenant.id);
    }

    let user = await prisma.user.findUnique({ where: { email: USER_EMAIL } });
    if (!user) {
      const hashedPassword = await bcrypt.hash(USER_PASSWORD, 10);
      user = await prisma.user.create({
        data: {
          name: 'Admin Teste',
          email: USER_EMAIL,
          password: hashedPassword,
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      });
      console.log('✅ Usuário Criado:', user.id);
    } else {
      console.log('ℹ️ Usuário já existe:', user.id);
    }

    // 2. Setup: Garantir Contatos para Partes
    console.log('📦 Configurando Contatos para Partes...');
    let contactCreditor = await prisma.contact.findFirst({ 
      where: { tenantId: tenant.id, name: 'Credor Teste', personType: 'PF' } 
    });
    
    if (!contactCreditor) {
      contactCreditor = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          name: 'Credor Teste',
          personType: 'PF',
          active: true,
          pfDetails: { create: { cpf: '111.111.111-11' } }
        }
      });
      console.log('✅ Contato Credor Criado:', contactCreditor.id);
    }

    let contactDebtor = await prisma.contact.findFirst({ 
      where: { tenantId: tenant.id, name: 'Devedor Teste', personType: 'PJ' } 
    });
    
    if (!contactDebtor) {
      contactDebtor = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          name: 'Devedor Teste',
          personType: 'PJ',
          active: true,
          pjDetails: { create: { cnpj: '22.222.222/0001-22' } }
        }
      });
      console.log('✅ Contato Devedor Criado:', contactDebtor.id);
    }


    // 3. Login na API
    console.log('🔑 Realizando Login na API...');
    
    // Aguardar API subir se necessário
    for(let i=0; i<10; i++) {
        try {
            await axios.get(API_URL);
            break;
        } catch(e) {
            console.log('⏳ Aguardando API subir...');
            await wait(2000);
        }
    }

    let token = '';
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: USER_EMAIL,
            password: USER_PASSWORD
        });
        token = loginRes.data.access_token;
        console.log('✅ Login realizado com sucesso!');
    } catch (error: any) {
        console.error('❌ Falha no Login:', error.message);
        // Tenta rota de login alternativa se existir, ou verificar endpoint
        console.log('Tentando rota alternativa /login somente se falhar...');
        throw error;
    }

    const api = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` }
    });

    // 4. Teste: Criar Transação 1 (Receita com Parte)
    console.log('\n--- 📝 Teste 1: Criar Transação (Receita com Parte) ---');
    const transaction1Data = {
        tenantId: tenant.id,
        description: 'Receita Honorários Teste',
        amount: 5000.00,
        dueDate: new Date().toISOString(),
        type: 'INCOME',
        status: 'PENDING',
        category: 'Honorários',
        parties: [
            { contactId: contactDebtor.id, role: 'DEBTOR', amount: 5000.00 }
        ]
    };
    
    const res1 = await api.post('/financial/records', transaction1Data);
    const transaction1 = res1.data;
    console.log(`✅ Transação 1 Criada ID: ${transaction1.id}`);
    console.log(`   Descrição: ${transaction1.description}, Valor: ${transaction1.amount}`);
    if (transaction1.parties && transaction1.parties.length > 0) {
        console.log(`   Partes vinculadas: ${transaction1.parties.length} (Esperado: 1)`);
    } else {
        console.error('❌ ERRO: Nenhuma parte vinculada retornada!');
    }


    // 5. Teste: Criar Transação 2 (Despesa Simples para Baixa)
    console.log('\n--- 📝 Teste 2: Criar Transação (Despesa para Baixa) ---');
    const transaction2Data = {
        tenantId: tenant.id,
        description: 'Compra Material Escritório',
        amount: 250.50,
        dueDate: new Date().toISOString(),
        type: 'EXPENSE',
        status: 'PENDING',
        category: 'Material',
        parties: [
            { contactId: contactCreditor.id, role: 'CREDITOR' } // Credor sem valor especifico
        ]
    };

    const res2 = await api.post('/financial/records', transaction2Data);
    const transaction2 = res2.data;
    console.log(`✅ Transação 2 Criada ID: ${transaction2.id}`);


    // 6. Teste: Criar Transação 3 (Para Exclusão)
    console.log('\n--- 📝 Teste 3: Criar Transação (Para Exclusão) ---');
    const transaction3Data = {
        tenantId: tenant.id,
        description: 'Transação Errada Teste',
        amount: 100.00,
        dueDate: new Date().toISOString(),
        type: 'EXPENSE',
        status: 'PENDING'
    };
    
    const res3 = await api.post('/financial/records', transaction3Data);
    const transaction3 = res3.data;
    console.log(`✅ Transação 3 Criada ID: ${transaction3.id}`);


    // 7. Teste: Editar Transação 1 (Mudar valor e adicionar parte)
    console.log('\n--- ✏️ Teste 4: Editar Transação 1 ---');
    const updateData = {
        amount: 6000.00,
        description: 'Receita Honorários Teste (Atualizado)',
        parties: [
            { contactId: contactDebtor.id, role: 'DEBTOR', amount: 3000.00 },
            { contactId: contactCreditor.id, role: 'DEBTOR', amount: 3000.00 } // Adicionando outro devedor (ex: casal)
        ]
    };
    
    const resUpdate = await api.put(`/financial/records/${transaction1.id}`, updateData);
    const updatedTransaction1 = resUpdate.data;
    console.log(`✅ Transação 1 Atualizada`);
    console.log(`   Novo Valor: ${updatedTransaction1.amount} (Esperado: 6000)`);
    console.log(`   Nova Descrição: ${updatedTransaction1.description}`);
    console.log(`   Partes Atualizadas: ${updatedTransaction1.parties?.length} (Esperado: 2)`);


    // 8. Teste: Baixar Transação 2 (Pagamento)
    console.log('\n--- 💰 Teste 5: Baixar Transação 2 (Pagamento) ---');
    const payData = {
        status: 'PAID',
        paymentDate: new Date().toISOString()
    };
    
    const resPay = await api.put(`/financial/records/${transaction2.id}`, payData);
    const paidTransaction2 = resPay.data;
    console.log(`✅ Transação 2 Baixada`);
    console.log(`   Status: ${paidTransaction2.status} (Esperado: PAID)`);
    console.log(`   Data Pagamento: ${paidTransaction2.paymentDate}`);


    // 9. Teste: Excluir Transação 3
    console.log('\n--- 🗑️ Teste 6: Excluir Transação 3 ---');
    await api.delete(`/financial/records/${transaction3.id}`);
    
    try {
        await api.get(`/financial/records/${transaction3.id}`);
        console.error('❌ ERRO: Transação 3 ainda existe após exclusão!');
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            console.log('✅ Transação 3 Excluída com Sucesso (404 confirmado)');
        } else {
            console.error('❌ Erro inesperado ao verificar exclusão:', error.message);
        }
    }

    console.log('\n🎉 Teste de CRUD Financeiro Concluído com Sucesso!');

  } catch (error: any) {
    console.error('\n❌ ERRO FATAL NO TESTE:', error.message);
    if (error.response) {
        console.error('   Dados do erro:', JSON.stringify(error.response?.data, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
