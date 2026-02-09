import * as fs from 'fs';
import * as path from 'path';

// Carregar .env manualmente
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('='); // Rejoin in case value has =
            process.env[key.trim()] = value.trim().replace(/^"|"$/g, '');
        }
    });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cpfUnmasked = '24748889187';
  const cpfMasked = '247.488.891-87';
  
  console.log(`Searching for process with CPF: ${cpfMasked} / ${cpfUnmasked}`);
  
  const processes = await prisma.process.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  let found = false;
  for (const p of processes) {
     const partiesStr = JSON.stringify(p.parties);
     if (partiesStr.includes(cpfUnmasked) || partiesStr.includes(cpfMasked)) {
         found = true;
         console.log('--- PROCESSO ENCONTRADO ---');
         console.log(`CNJ: ${p.cnj}`);
         console.log(`Título: ${p.title}`);
         console.log(`Status: ${p.status}`);
         console.log(`Valor: ${p.value}`);
         console.log(`Data Distribuição: ${p.distributionDate}`);
         console.log(`Juiz: ${p.judge}`);
         console.log('--- PARTES (JSON) ---');
         console.log(JSON.stringify(p.parties, null, 2));
         
         console.log('\n--- CONTATOS VINCULADOS (CPF/CNPJ) ---');
         // Buscar contato com esse CPF
         const contact = await prisma.contact.findFirst({
             where: { 
                 pfDetails: { cpf: cpfUnmasked }
             },
             include: { pfDetails: true }
         });
         
         if (contact) {
             console.log(`Contato encontrado para o CPF: ${contact.name} (${contact.category}) - ID: ${contact.id}`);
         } else {
             console.log('Nenhum contato encontrado com este CPF na tabela Contact (Falha no syncParties?)');
         }

         // Buscar Juiz também
         if (p.judge) {
             const judgeContact = await prisma.contact.findFirst({
                 where: {
                     name: p.judge,
                     category: 'MAGISTRADO'
                 }
             });
             if (judgeContact) {
                 console.log(`Contato Juiz encontrado: ${judgeContact.name} - ID: ${judgeContact.id}`);
             } else {
                console.log(`Contato Juiz NÃO encontrado: ${p.judge}`);
             }
         }
         
         break; // Mostrar só o primeiro encontrado
     }
  }

  if (!found) {
      console.log('Nenhum processo exato encontrado. Listando partes dos recentes para debug:');
      for (const p of processes) {
          console.log(`CNJ: ${p.cnj} | Título: ${p.title}`);
          console.log('Partes:', JSON.stringify(p.parties));
          console.log('---');
      }
  }
}

main()
  .catch(e => {
      console.error(e);
      process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
