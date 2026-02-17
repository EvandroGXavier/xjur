
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Diagnosing Connections...');
  
  const connections = await prisma.connection.findMany();
  
  if (connections.length === 0) {
    console.log('❌ No connections found in database.');
    return;
  }

  connections.forEach(conn => {
    console.log(`\nConnection [${conn.name}]:`);
    console.log(`  ID: ${conn.id}`);
    console.log(`  Type: ${conn.type}`);
    console.log(`  Status: ${conn.status}`);
    console.log(`  QRCode Length: ${conn.qrCode ? conn.qrCode.length : 0} chars`);
    console.log(`  Config: ${JSON.stringify(conn.config)}`);
    console.log(`  TenantId: ${conn.tenantId}`);
  });

  const contacts = await prisma.contact.findMany({ 
    take: 5,
    select: { name: true, phone: true, whatsapp: true } 
  });
  console.log('\nSample Contacts (Verify number format):');
  contacts.forEach(c => {
    console.log(`  - ${c.name}: Phone [${c.phone}], WA [${c.whatsapp}]`);
  });
}

diagnose()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
