
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.ticketMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      senderType: true,
      contentType: true,
      mediaUrl: true,
      content: true,
      createdAt: true
    }
  });
  console.log(JSON.stringify(messages, null, 2));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
