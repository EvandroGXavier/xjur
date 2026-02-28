const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearWhatsAppTickets() {
  try {
    console.log('🧹 Iniciando limpeza de atendimentos e mensagens do WhatsApp...');

    // As tabelas dependentes (TicketMessage) geralmente têm onDelete: Cascade,
    // mas por segurança e para evitar erros de FK (Foreign Key), apagamos as mensagens primeiro.
    const deletedMessages = await prisma.ticketMessage.deleteMany({});
    console.log(`✅ ${deletedMessages.count} mensagens apagadas.`);

    // Apagar os tickets
    const deletedTickets = await prisma.ticket.deleteMany({});
    console.log(`✅ ${deletedTickets.count} atendimentos (tickets) apagados.`);

    console.log('✨ Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao limpar atendimentos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearWhatsAppTickets();
