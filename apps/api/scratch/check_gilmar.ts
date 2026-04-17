import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    where: {
      name: { contains: 'Gilmar', mode: 'insensitive' }
    },
    include: {
      additionalContacts: true,
      agentConversations: {
          orderBy: { createdAt: 'desc' },
          take: 3
      }
    }
  });

  console.log(JSON.stringify(contacts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
