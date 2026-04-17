
import { PrismaClient } from '@prisma/client';

async function forensic() {
  const prisma = new PrismaClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentContacts = await prisma.contact.findMany({
    where: {
        createdAt: { gte: oneHourAgo }
    },
    include: {
        additionalContacts: true
    }
  });

  console.log(`Contatos criados na última hora: ${recentContacts.length}`);
  for (const c of recentContacts) {
      console.log(`ID: ${c.id} | Name: ${c.name} | Tenant: ${c.tenantId} | WhatsApp: ${c.whatsapp}`);
      for (const id of c.additionalContacts) {
          console.log(`   ID: ${id.type} | Value: ${id.value}`);
      }
  }

  await prisma.$disconnect();
}

forensic();
