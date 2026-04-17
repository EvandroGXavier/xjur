
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- CONNECTION ---');
  const connection = await prisma.connection.findUnique({
    where: { id: '49cad3cc-bb68-47c2-95c5-de5ac49556c2' }
  });
  console.log(JSON.stringify(connection, null, 2));

  console.log('\n--- CONTACT ---');
  const contact = await prisma.contact.findFirst({
    where: { name: { contains: 'GILMAR CONECTION' } },
    include: { additionalContacts: true }
  });
  console.log(JSON.stringify(contact, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
