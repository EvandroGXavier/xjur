
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contact = await prisma.contact.findUnique({
    where: { id: 'f24d1808-841c-427d-866f-41c64260e546' },
    include: { additionalContacts: true }
  });
  console.log(JSON.stringify(contact, null, 2));
}

main().finally(() => prisma.$disconnect());
