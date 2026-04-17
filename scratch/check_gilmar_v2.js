const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const contact = await prisma.contact.findUnique({
    where: { id: 'f24d1808-841c-427d-866f-41c64260e546' },
  });
  console.log('GILMAR:', contact);

  const all = await prisma.contact.findMany({
    take: 50,
    orderBy: { updatedAt: 'desc' }
  });
  console.log('LISTA RECENTE:', all.map(c => ({ id: c.id, name: c.name, whatsapp: c.whatsapp })));
}

check();
