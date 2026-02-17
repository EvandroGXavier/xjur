
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentMessages() {
  try {
    const messages = await prisma.ticketMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { ticket: true }
    });

    console.log('Recent Messages:', JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentMessages();
