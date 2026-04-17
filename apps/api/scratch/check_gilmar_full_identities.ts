
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ids = await prisma.contactChannelIdentity.findMany({
    where: { contactId: 'f24d1808-841c-427d-866f-41c64260e546' }
  });
  console.log(JSON.stringify(ids, null, 2));
}
main().finally(() => prisma.$disconnect());
