import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const conversation = await prisma.agentConversation.findUnique({
    where: { id: '168447c6-0e2d-4588-ac21-a90e01be09af' },
    include: {
        contact: {
            include: {
                additionalContacts: true
            }
        }
    }
  });

  console.log(JSON.stringify(conversation, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
