
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findLidContacts() {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        whatsapp: {
          contains: '@lid'
        }
      }
    });

    console.log('Found LID contacts:', contacts);
  } catch (error) {
    console.error('Error finding LID contacts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findLidContacts();
