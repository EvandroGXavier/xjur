
import { PrismaClient } from '@prisma/client';

async function forensic() {
  const prisma = new PrismaClient();
  
  const events = await prisma.incomingEvent.findMany({
    where: {
        processingError: { not: null }
    },
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Eventos com erro: ${events.length}`);
  for (const e of events) {
      console.log(`[${e.createdAt.toISOString()}] Error: ${e.processingError}`);
      console.log(`   Source: ${e.sourceAddress} | Channel: ${e.channel}`);
  }

  await prisma.$disconnect();
}

forensic();
