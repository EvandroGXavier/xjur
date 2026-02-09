
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of CommunicationLogs to Tickets...');

  // 1. Fetch all logs
  const logs = await prisma.communicationLog.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${logs.length} logs to migrate.`);

  // 2. Group by Contact and Date
  const groupedLogs: Record<string, Record<string, typeof logs>> = {};

  for (const log of logs) {
    if (!log.contactId) {
        console.warn(`Log ${log.id} has no contactId. Skipping.`);
        continue;
    }

    const contactId = log.contactId;
    const dateKey = log.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!groupedLogs[contactId]) {
      groupedLogs[contactId] = {};
    }
    if (!groupedLogs[contactId][dateKey]) {
      groupedLogs[contactId][dateKey] = [];
    }
    groupedLogs[contactId][dateKey].push(log);
  }

  // 3. Process groups
  for (const contactId in groupedLogs) {
    const dates = groupedLogs[contactId];
    for (const dateKey in dates) {
      const dayLogs = dates[dateKey];
      
      // Determine ticket status based on logs
      // If any log is not ARCHIVED/TRIAGED, ticket is OPEN?
      // Or just default to CLOSED since these are old logs?
      // Let's check the last log status.
      const lastLog = dayLogs[dayLogs.length - 1];
      let ticketStatus = 'CLOSED';
      if (lastLog.status === 'RECEIVED') ticketStatus = 'OPEN';
      if (lastLog.status === 'TRIAGED') ticketStatus = 'RESOLVED';

      // Create Ticket
      const ticket = await prisma.ticket.create({
        data: {
          tenantId: dayLogs[0].tenantId,
          contactId: contactId,
          title: `Atendimento Importado - ${dateKey}`,
          status: ticketStatus,
          priority: 'MEDIUM',
          channel: dayLogs[0].channel || 'WHATSAPP',
          createdAt: dayLogs[0].createdAt,
          updatedAt: lastLog.createdAt,
        }
      });

      console.log(`Created Ticket ${ticket.code} for Contact ${contactId} on ${dateKey}`);

      // Create Messages
      for (const log of dayLogs) {
        const senderType = log.direction === 'INBOUND' ? 'CONTACT' : 'USER'; // Assuming OUTBOUND is USER/AGENT
        
        await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                senderType: senderType,
                senderId: senderType === 'CONTACT' ? contactId : undefined, // We don't have userID easily for outbound unless we inferred it, leaving undefined for now
                content: log.content,
                contentType: log.mediaUrl ? (log.mediaType || 'FILE') : 'TEXT', // Fallback
                mediaUrl: log.mediaUrl,
                createdAt: log.createdAt,
                readAt: log.status !== 'RECEIVED' ? log.createdAt : null // Assume read if processed
            }
        });
      }
    }
  }

  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
