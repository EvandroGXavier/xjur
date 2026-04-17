const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanFictitious() {
  const contactId = '8959d802-32a6-4ff8-a1f5-317f06e9dbc2'; // Gilmar Jesus Alves do print
  
  console.log(`Limpando contatos fictícios para o contato: ${contactId}`);

  try {
    const deleted = await prisma.additionalContact.deleteMany({
      where: {
        contactId: contactId,
        value: { contains: '99999999' }
      }
    });
    console.log(`Removidos ${deleted.count} identificadores fictícios.`);
  } catch (error) {
    console.error('Falha na limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanFictitious();
