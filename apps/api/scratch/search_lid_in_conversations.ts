
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const convs = await prisma.agentConversation.findMany({
    where: { 
      OR: [ 
        { externalThreadId: '32611955175500@lid' }, 
        { externalParticipantId: '32611955175500@lid' } 
      ] 
    },
    include: { contact: { select: { name: true } } }
  });
  console.log(JSON.stringify(convs, null, 2));
}
main().finally(() => prisma.$disconnect());
