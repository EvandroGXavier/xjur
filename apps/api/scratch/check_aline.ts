import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    where: {
      name: { contains: 'Aline', mode: 'insensitive' }
    },
    include: {
      additionalContacts: true
    }
  });

  console.log(JSON.stringify(contacts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
