import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeContacts() {
  const targetId = 'f24d1808-841c-427d-866f-41c64260e546'; // GILMAR CONECTION
  const sourceId = '90f4b947-b608-48a6-9765-7264b7cbcb78'; // Conection Telecomunicações

  console.log(`Iniciando fusão: ${sourceId} -> ${targetId}`);

  try {
    // 1. Mover contatos adicionais (LIDs, JIDs)
    const movedIdentities = await prisma.additionalContact.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId }
    });
    console.log(`Movidos ${movedIdentities.count} identificadores de canal.`);

    // 2. Mover conversas
    const movedConvs = await prisma.agentConversation.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId }
    });
    console.log(`Movidas ${movedConvs.count} conversas.`);

    // 3. Mover tickets
    const movedTickets = await prisma.ticket.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId }
    });
    console.log(`Movidos ${movedTickets.count} tickets.`);

    // 4. Mover mensagens de ticket
    const movedMsgs = await prisma.ticketMessage.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId }
    });
    console.log(`Movidas ${movedMsgs.count} mensagens de ticket.`);

    // 5. Deletar o contato duplicado (agora órfão de dados relevantes)
    await prisma.contact.delete({
      where: { id: sourceId }
    });
    console.log('Contato duplicado removido com sucesso.');

  } catch (error) {
    console.error('Falha na fusão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

mergeContacts();
