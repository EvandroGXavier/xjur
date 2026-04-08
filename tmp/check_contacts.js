const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        name: { contains: 'GILMAR', mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        tenantId: true
      }
    });
    console.log(JSON.stringify(contacts, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
