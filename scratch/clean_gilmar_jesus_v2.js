const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanFictitious() {
  const name = 'Gilmar Jesus Alves';
  
  const contacts = await prisma.contact.findMany({
    where: { name: { contains: name } },
    include: { additionalContacts: true }
  });

  for (const contact of contacts) {
    console.log(`Verificando contato: ${contact.id} (${contact.name})`);
    
    const toDelete = contact.additionalContacts.filter(ac => 
      ac.value.includes('9999') || ac.value.includes('(99)')
    );

    if (toDelete.length > 0) {
      console.log(`Removendo ${toDelete.length} contatos fictícios...`);
      await prisma.additionalContact.deleteMany({
        where: { id: { in: toDelete.map(ac => ac.id) } }
      });
    } else {
      console.log('Nenhum contato fictício encontrado para deletar.');
    }
  }
}

cleanFictitious();
