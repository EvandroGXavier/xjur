
import { PrismaClient } from '@prisma/client';

async function forensic() {
  const prisma = new PrismaClient();
  const searchValues = ['31982164896', '5531982164896', '553182164896']; // variantes
  
  console.log('--- FORENSICS: Gilmar Search ---');
  
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { name: { contains: 'Gilmar', mode: 'insensitive' } },
        { whatsapp: { in: searchValues } },
        { whatsappE164: { in: searchValues } },
        { whatsappFullId: { contains: '31982164896' } }
      ]
    },
    include: {
      additionalContacts: true
    }
  });

  console.log(`Encontrados ${contacts.length} contatos.`);
  for (const c of contacts) {
    console.log(`ID: ${c.id} | Nome: ${c.name} | WhatsApp: ${c.whatsapp} | E164: ${c.whatsappE164} | JID: ${c.whatsappFullId}`);
    console.log('--- Identidades (additionalContacts) ---');
    for (const id of c.additionalContacts) {
       console.log(`   [${id.type}] ${id.value}`);
    }
  }

  const identities = await prisma.contactChannelIdentity.findMany({
    where: {
        externalId: { contains: '31982164896' }
    }
  });
  console.log(`\n--- ChannelIdentities (Geral) ---`);
  for (const id of identities) {
      console.log(`   ContactID: ${id.contactId} | ExternalID: ${id.externalId}`);
  }

  await prisma.$disconnect();
}

forensic();
