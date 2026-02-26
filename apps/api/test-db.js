const { PrismaClient } = require('@drx/database');
const prisma = new PrismaClient();

async function main() {
   const contacts = await prisma.contact.findMany({
      where: { name: { contains: 'evandro', mode: 'insensitive' } }
   });
   console.log('Result:', JSON.stringify(contacts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
