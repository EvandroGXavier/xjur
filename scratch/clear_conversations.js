const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearConversations() {
  const contactId = 'f24d1808-841c-427d-866f-41c64260e546'; // GILMAR CONECTION

  console.log(`Iniciando limpeza total para o contato: ${contactId}`);

  try {
    // 1. Localizar conversas do agente
    const conversations = await prisma.agentConversation.findMany({
      where: { contactId: contactId },
      select: { id: true, ticketId: true }
    });

    for (const conv of conversations) {
      console.log(`Limpando conversa ${conv.id}...`);
      
      // Deletar eventos de mensagem do agente
      await prisma.agentMessageEvent.deleteMany({
        where: { message: { conversationId: conv.id } }
      });

      // Deletar mensagens do agente
      await prisma.agentMessage.deleteMany({
        where: { conversationId: conv.id }
      });

      // Deletar a conversa em si
      await prisma.agentConversation.delete({
        where: { id: conv.id }
      });

      // Se houver ticket legado, limpamos também
      if (conv.ticketId) {
        await prisma.ticketMessage.deleteMany({
          where: { ticketId: conv.ticketId }
        });
        await prisma.ticket.delete({
          where: { id: conv.ticketId }
        });
        console.log(`Ticket legado ${conv.ticketId} removido.`);
      }
    }

    console.log('Limpeza concluída com sucesso.');

  } catch (error) {
    console.error('Falha na limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearConversations();
