
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  try {
    const connections = await prisma.connection.findMany({
        where: { type: 'WHATSAPP' }
    });
    console.log('Connections:', JSON.stringify(connections, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
