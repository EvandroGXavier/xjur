import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env', override: true }); // carrega o .env de apps/api
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando limpeza de contatos do WhatsApp...');

  // Busca todos os contatos
  // O usuário pediu: "Os contatos, salvos, que o campo Celular/Whatsapp, tem caracteres que não sejam números, ou se estiver em branco ou null, apague o contato."
  
  const contacts = await prisma.contact.findMany();

  let deletedCount = 0;

  for (const contact of contacts) {
    // Ignorar a regra apenas para o '99 99999999' que foi criado como fallback
    if (contact.whatsapp === '99 99999999') continue;

    // Se estiver vazio, nulo ou composto apenas por espaços
    const isEmptyOrNull = !contact.whatsapp || contact.whatsapp.trim() === '';
    
    // Verifica se possui caracteres não numéricos (apenas se não for vazio/nulo)
    const hasNonNumeric = !isEmptyOrNull && /[^0-9]/.test(contact.whatsapp!);
    
    if (isEmptyOrNull || hasNonNumeric) {
      console.log(`Deletando contato ID: ${contact.id} | WhatsApp: ${contact.whatsapp || 'VAZIO/NULL'} | Nome: ${contact.name}`);
      try {
        await prisma.contact.delete({
          where: { id: contact.id }
        });
        deletedCount++;
      } catch (err: any) {
        console.log(`Erro ao deletar ${contact.whatsapp || 'VAZIO/NULL'}:`, err.message);
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
