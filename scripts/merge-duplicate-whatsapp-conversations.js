/*
  Merge duplicate WhatsApp conversations/tickets that were created due to mismatched thread identifiers
  (e.g. digits-only vs `${digits}@s.whatsapp.net`, or provider variants).

  Default is DRY RUN. To execute, set:
    DRX_MERGE_APPLY=1

  Optional:
    DRX_TENANT_ID=<tenant uuid>   # limit to one tenant

  Usage:
    node scripts/merge-duplicate-whatsapp-conversations.js
*/

const { PrismaClient } = require('@prisma/client');

const APPLY = process.env.DRX_MERGE_APPLY === '1';
const TENANT_FILTER = (process.env.DRX_TENANT_ID || '').trim() || null;

function normalizeJid(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/:[0-9]+(?=@)/, '');
}

function extractWhatsappDigits(value) {
  const normalized = normalizeJid(value);
  if (!normalized) return '';
  return normalized
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
    .replace(/\D/g, '');
}

function plausibleDigits(digits) {
  return typeof digits === 'string' && /^\d{10,15}$/.test(digits);
}

function canonicalThreadIdFromDigits(digits) {
  return `${digits}@s.whatsapp.net`;
}

async function main() {
  const prisma = new PrismaClient();

  const where = {
    channel: 'WHATSAPP',
    status: { not: 'ARCHIVED' },
    ...(TENANT_FILTER ? { tenantId: TENANT_FILTER } : {}),
  };

  const conversations = await prisma.agentConversation.findMany({
    where,
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      contactId: true,
      connectionId: true,
      status: true,
      externalThreadId: true,
      externalParticipantId: true,
      lastMessageAt: true,
      updatedAt: true,
      createdAt: true,
      metadata: true,
      contact: {
        select: {
          id: true,
          whatsappFullId: true,
          whatsappE164: true,
          whatsapp: true,
          phone: true,
        },
      },
    },
  });

  // Preload message counts (helps pick the best primary).
  const messageCounts = await prisma.agentMessage.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: conversations.map((c) => c.id) } },
    _count: { _all: true },
  });
  const msgCountByConv = new Map(messageCounts.map((row) => [row.conversationId, row._count._all]));

  const groups = new Map();
  for (const conv of conversations) {
    const candidates = [
      conv.externalThreadId,
      conv.externalParticipantId,
      conv.contact?.whatsappFullId,
      conv.contact?.whatsappE164,
      conv.contact?.whatsapp,
      conv.contact?.phone,
    ].filter(Boolean);

    const digits = candidates.map(extractWhatsappDigits).find((d) => plausibleDigits(d)) || '';
    if (!plausibleDigits(digits)) continue;

    const key = `${conv.tenantId}:${digits}`;
    if (!groups.has(key)) groups.set(key, { tenantId: conv.tenantId, digits, convs: [] });
    groups.get(key).convs.push(conv);
  }

  const dupGroups = Array.from(groups.values()).filter((g) => g.convs.length > 1);
  dupGroups.sort((a, b) => b.convs.length - a.convs.length);

  console.log(
    `WhatsApp duplicate scan: conversations=${conversations.length} groups=${groups.size} duplicateGroups=${dupGroups.length} apply=${APPLY ? 'YES' : 'NO'}`,
  );

  let mergedGroups = 0;
  let archivedConversations = 0;
  let movedMessages = 0;
  let movedTicketMessages = 0;

  for (const group of dupGroups) {
    // Select primary:
    // - prefer with ticketId
    // - then higher message count
    // - then latest lastMessageAt/updatedAt
    const sorted = group.convs.slice().sort((a, b) => {
      const aHasTicket = a.ticketId ? 1 : 0;
      const bHasTicket = b.ticketId ? 1 : 0;
      if (aHasTicket !== bHasTicket) return bHasTicket - aHasTicket;

      const aCount = msgCountByConv.get(a.id) || 0;
      const bCount = msgCountByConv.get(b.id) || 0;
      if (aCount !== bCount) return bCount - aCount;

      const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    const canonicalThreadId = canonicalThreadIdFromDigits(group.digits);

    console.log(
      `\nGroup tenant=${group.tenantId} digits=${group.digits} size=${group.convs.length} primary=${primary.id} dup=${duplicates
        .map((d) => d.id)
        .join(',')}`,
    );

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      // Ensure primary thread ids are canonical.
      await tx.agentConversation.update({
        where: { id: primary.id },
        data: {
          externalThreadId: canonicalThreadId,
          externalParticipantId: primary.externalParticipantId || canonicalThreadId,
        },
      });

      for (const dup of duplicates) {
        // Move AgentRuns
        await tx.agentRun.updateMany({
          where: { conversationId: dup.id },
          data: { conversationId: primary.id },
        });

        // Merge participants and remap message.participantId
        const [dupParticipants, primaryParticipants] = await Promise.all([
          tx.agentParticipant.findMany({ where: { conversationId: dup.id } }),
          tx.agentParticipant.findMany({ where: { conversationId: primary.id } }),
        ]);

        const findMatchingPrimaryParticipant = (p) =>
          primaryParticipants.find((pp) => {
            return (
              (pp.userId || null) === (p.userId || null) &&
              (pp.contactId || null) === (p.contactId || null) &&
              String(pp.role || '') === String(p.role || '') &&
              String(pp.label || '') === String(p.label || '') &&
              String(pp.externalAddress || '') === String(p.externalAddress || '')
            );
          });

        const participantIdMap = new Map();
        for (const p of dupParticipants) {
          let target = findMatchingPrimaryParticipant(p);
          if (!target) {
            target = await tx.agentParticipant.create({
              data: {
                tenantId: p.tenantId,
                conversationId: primary.id,
                userId: p.userId || null,
                contactId: p.contactId || null,
                role: p.role,
                label: p.label || null,
                externalAddress: p.externalAddress || null,
                isPrimary: false,
                joinedAt: p.joinedAt,
                metadata: p.metadata,
              },
            });
            primaryParticipants.push(target);
          }
          participantIdMap.set(p.id, target.id);
        }

        for (const [fromId, toId] of participantIdMap.entries()) {
          await tx.agentMessage.updateMany({
            where: { conversationId: dup.id, participantId: fromId },
            data: { participantId: toId },
          });
        }

        // Move messages
        const msgMove = await tx.agentMessage.updateMany({
          where: { conversationId: dup.id },
          data: { conversationId: primary.id },
        });
        movedMessages += msgMove.count;

        // Merge tickets (legacy projection)
        if (dup.ticketId && dup.ticketId !== primary.ticketId) {
          if (!primary.ticketId) {
            await tx.agentConversation.update({
              where: { id: primary.id },
              data: { ticketId: dup.ticketId },
            });
            primary.ticketId = dup.ticketId;
          } else {
            const move = await tx.ticketMessage.updateMany({
              where: { ticketId: dup.ticketId },
              data: { ticketId: primary.ticketId },
            });
            movedTicketMessages += move.count;

            // Detach duplicate conversation from its old ticket.
            await tx.agentConversation.update({
              where: { id: dup.id },
              data: { ticketId: null },
            });

            // Delete old ticket if now orphaned.
            const [remainingMsgs, remainingConvs] = await Promise.all([
              tx.ticketMessage.count({ where: { ticketId: dup.ticketId } }),
              tx.agentConversation.count({ where: { ticketId: dup.ticketId } }),
            ]);
            if (remainingMsgs === 0 && remainingConvs === 0) {
              await tx.ticket.delete({ where: { id: dup.ticketId } });
            }
          }
        }

        // If primary has no contactId but duplicate has, keep it.
        if (!primary.contactId && dup.contactId) {
          await tx.agentConversation.update({
            where: { id: primary.id },
            data: { contactId: dup.contactId },
          });
          primary.contactId = dup.contactId;
        }

        // Archive duplicate conversation (keep trace in metadata).
        await tx.agentConversation.update({
          where: { id: dup.id },
          data: {
            status: 'ARCHIVED',
            unreadCount: 0,
            waitingReply: false,
            metadata: {
              ...(dup.metadata && typeof dup.metadata === 'object' ? dup.metadata : {}),
              mergedInto: primary.id,
              mergedAt: new Date().toISOString(),
              mergedKey: `whatsapp:${group.digits}`,
            },
          },
        });

        archivedConversations += 1;
      }
    });

    mergedGroups += 1;
  }

  await prisma.$disconnect();

  console.log(
    `\nDone. mergedGroups=${mergedGroups} archivedConversations=${archivedConversations} movedMessages=${movedMessages} movedTicketMessages=${movedTicketMessages}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

