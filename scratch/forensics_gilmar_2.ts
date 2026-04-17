
import { PrismaClient } from '@prisma/client';

async function forensic() {
  const prisma = new PrismaClient();
  const contactId = 'f24d1808-841c-427d-866f-41c64260e546';
  
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
        additionalContacts: true
    }
  });

  if (!contact) {
      console.log('Contact not found');
      return;
  }

  console.log(`Contact: ${contact.name} | TenantID: ${contact.tenantId}`);

  // Agora vamos ver se tem OUTRO contato com o mesmo nome ou numero
  const others = await prisma.contact.findMany({
      where: {
          OR: [
              { name: contact.name },
              { whatsapp: contact.whatsapp }
          ],
          id: { not: contactId }
      }
  });

  console.log(`Outros contatos com mesmo nome/numero: ${others.length}`);
  for (const o of others) {
      console.log(`   ID: ${o.id} | Name: ${o.name} | Tenant: ${o.tenantId} | WhatsApp: ${o.whatsapp}`);
  }

  await prisma.$disconnect();
}

forensic();
