const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { whatsapp: { contains: '32189507' } },
        { whatsappE164: { contains: '32189507' } }
      ]
    },
    include: {
        additionalContacts: true,
        _count: {
            select: {
                agentConversations: true,
                tickets: true
            }
        }
    }
  });
  console.log(JSON.stringify(contacts, null, 2));
}

check();
