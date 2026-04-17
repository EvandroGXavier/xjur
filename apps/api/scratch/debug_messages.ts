
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const messages = await prisma.agentMessage.findMany({
    where: { tenantId: 'f6da8386-9878-4f21-9aa0-2bfa1dd1a709' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { conversation: { select: { contactId: true, contact: { select: { name: true } } } } }
  });
  console.log(JSON.stringify(messages, null, 2));
}
main().finally(() => prisma.$disconnect());
