import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env', override: true }); // carrega o .env de apps/api
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando limpeza de contatos do WhatsApp...');

  // Busca todos os contatos que vieram do WhatsApp (possuem whatsapp preenchido)
  // e verifica se possuem algo diferente de número. 
  // O usuário pediu: "Os contatos, salvos, que o campo Celular/Whatsapp, tem caracteres que não sejam números, apague o contato."
  
  const contacts = await prisma.contact.findMany({
    where: {
      whatsapp: { not: null },
    },
  });

  let deletedCount = 0;

  for (const contact of contacts) {
    if (!contact.whatsapp) continue;
    // Verifica se possui caracteres não numéricos. 
    // Vamos ignorar a regra apenas para o '99 99999999' que ele pediu para criar como fallback
    if (contact.whatsapp === '99 99999999') continue;

    const hasNonNumeric = /[^0-9]/.test(contact.whatsapp);
    
    if (hasNonNumeric) {
      console.log(`Deletando contato ID: ${contact.id} | WhatsApp: ${contact.whatsapp} | Nome: ${contact.name}`);
      try {
        await prisma.contact.delete({
          where: { id: contact.id }
        });
        deletedCount++;
      } catch (err: any) {
        console.log(`Erro ao deletar ${contact.whatsapp}:`, err.message);
      }
    }
  }

  console.log(`Limpeza concluída! ${deletedCount} contatos deletados.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
