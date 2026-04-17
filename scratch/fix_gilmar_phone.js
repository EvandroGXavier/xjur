const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGilmar() {
  const contactId = 'f24d1808-841c-427d-866f-41c64260e546';
  
  console.log(`Corrigindo dados do contato Gilmar: ${contactId}`);

  try {
    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        whatsapp: '(31) 3218-9507',
        whatsappE164: '3132189507', // Agora correto!
        phone: '(31) 3218-9507',
        whatsappFullId: '553132189507@s.whatsapp.net',
        metadata: {
            whatsappPresence: {
                '553132189507': true
            }
        }
      }
    });
    console.log('Contato Gilmar atualizado com sucesso:', updated.whatsappE164);
  } catch (error) {
    console.error('Falha na correção:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGilmar();
