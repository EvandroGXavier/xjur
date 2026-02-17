
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findJulie() {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        name: {
          contains: 'JULIE',
          mode: 'insensitive'
        }
      }
    });

    console.log('Found contacts:', contacts);
  } catch (error) {
    console.error('Error finding contact:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findJulie();
