const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeGilmar() {
  const mainId = '8959d802-32a6-4ff8-a1f5-317f06e9dbc2'; // Gilmar Jesus Alves (Correto)
  const duplicateId = 'a6e4b447-0bbd-4043-829a-b2f502c1a706'; // O "550509754529"
  
  console.log(`Fundindo duplicado ${duplicateId} no principal ${mainId}`);

  try {
    // 1. Pegar identificadores do duplicado
    const dupIdentities = await prisma.additionalContact.findMany({
      where: { contactId: duplicateId }
    });

    // 2. Mover identificadores para o principal (se não existirem)
    const mainIdentities = await prisma.additionalContact.findMany({
      where: { contactId: mainId }
    });
    const mainValues = new Set(mainIdentities.map(i => i.value.toLowerCase()));

    for (const identity of dupIdentities) {
      if (!mainValues.has(identity.value.toLowerCase())) {
        console.log(`Movendo identificador: ${identity.value}`);
        await prisma.additionalContact.update({
          where: { id: identity.id },
          data: { contactId: mainId }
        });
      } else {
        await prisma.additionalContact.delete({ where: { id: identity.id } });
      }
    }

    // 3. Adicionar o LID das notas aos additionalContacts se faltar
    const lidValue = '32611955175500@lid';
    if (!mainValues.has(lidValue)) {
      await prisma.additionalContact.create({
        data: {
          contactId: mainId,
          type: 'WHATSAPP_LID',
          value: lidValue,
          nomeContatoAdicional: 'WhatsApp LID'
        }
      });
      console.log(`LID adicionado aos contatos adicionais de Gilmar.`);
    }

    // 4. Mover Atendimentos/Tickets
    await prisma.ticket.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: mainId }
    });

    // 5. Mover Conversas do Agent System
    await prisma.agentParticipant.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: mainId }
    });

    await prisma.agentConversation.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: mainId }
    });

    // 6. Deletar o duplicado
    await prisma.contact.delete({ where: { id: duplicateId } });

    console.log('Fusão concluída com sucesso.');

  } catch (error) {
    console.error('Erro na fusão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

mergeGilmar();
