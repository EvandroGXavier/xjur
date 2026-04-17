
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const conv = await prisma.agentConversation.findUnique({
    where: { id: 'a368a3e9-d7e1-4354-a2fc-14e6bf81ff52' }
  });
  console.log(JSON.stringify(conv, null, 2));
}

main().finally(() => prisma.$disconnect());
