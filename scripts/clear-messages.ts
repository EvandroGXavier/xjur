
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Cleaning all chat messages...');
  
  try {
    // Delete all ticket messages
    const deletedMessages = await prisma.ticketMessage.deleteMany({});
    console.log(`✅ Deleted ${deletedMessages.count} messages.`);

    // Optionally, we could delete tickets too, but the request was "messages".
    // const deletedTickets = await prisma.ticket.deleteMany({});
    // console.log(`✅ Deleted ${deletedTickets.count} tickets.`);
    
  } catch (error) {
    console.error('❌ Error cleaning messages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
