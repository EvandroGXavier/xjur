
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ids = await prisma.contactChannelIdentity.findMany({
    where: { externalId: '32611955175500@lid' },
    include: { contact: { select: { name: true } } }
  });
  console.log(JSON.stringify(ids, null, 2));
}
main().finally(() => prisma.$disconnect());
