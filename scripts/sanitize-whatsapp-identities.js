const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function normalizeWhatsappIdentity(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/:[0-9]+(?=@)/, '');
  return normalized.length > 0 ? normalized : null;
}

function extractWhatsappDigits(value) {
  const normalized = normalizeWhatsappIdentity(value);
  if (!normalized) return '';
  if (normalized.includes('@lid') || normalized.includes('@g.us')) return '';

  if (normalized.includes('@s.whatsapp.net')) {
    return normalized.split('@')[0].replace(/\D/g, '');
  }

  return normalized.replace(/\D/g, '');
}

function isPlausibleWhatsappDigits(value) {
  return typeof value === 'string' && /^\d{10,15}$/.test(value);
}

async function upsertIdentity(tenantId, contactId, externalId) {
  await prisma.contactChannelIdentity.upsert({
    where: {
      tenantId_channel_externalId: {
        tenantId,
        channel: 'WHATSAPP',
        externalId,
      },
    },
    create: {
      tenantId,
      contactId,
      channel: 'WHATSAPP',
      provider: 'SANITIZER',
      externalId,
    },
    update: {
      contactId,
      provider: 'SANITIZER',
    },
  });
}

async function main() {
  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      tenantId: true,
      name: true,
      phone: true,
      whatsapp: true,
      whatsappE164: true,
      whatsappFullId: true,
    },
  });

  const conversations = await prisma.agentConversation.findMany({
    where: {
      channel: 'WHATSAPP',
    },
    select: {
      id: true,
      externalThreadId: true,
      externalParticipantId: true,
      metadata: true,
    },
  });

  let identityUpserts = 0;
  let contactUpdates = 0;
  let conversationUpdates = 0;
  const ambiguousLids = [];

  for (const contact of contacts) {
    const explicitIds = [
      contact.whatsappFullId,
      contact.whatsapp,
    ]
      .map((value) => normalizeWhatsappIdentity(value))
      .filter(Boolean);

    const digitsCandidates = [
      contact.whatsappE164,
      contact.whatsapp,
      contact.phone,
      contact.whatsappFullId,
    ]
      .map((value) => extractWhatsappDigits(value))
      .filter((value) => isPlausibleWhatsappDigits(value));

    const phoneDigits = Array.from(new Set(digitsCandidates))[0] || null;
    const updates = {};

    const normalizedFullId = normalizeWhatsappIdentity(contact.whatsappFullId);
    if (normalizedFullId && normalizedFullId !== contact.whatsappFullId) {
      updates.whatsappFullId = normalizedFullId;
    }

    if (!contact.whatsappE164 && phoneDigits) {
      updates.whatsappE164 = phoneDigits;
    }

    if (
      normalizedFullId &&
      normalizedFullId.endsWith('@lid') &&
      !explicitIds.some((value) => value.endsWith('@s.whatsapp.net')) &&
      !phoneDigits
    ) {
      ambiguousLids.push({
        id: contact.id,
        name: contact.name,
        whatsapp: contact.whatsapp,
        whatsappFullId: contact.whatsappFullId,
      });
    }

    if (apply && Object.keys(updates).length > 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: updates,
      });
    }

    if (Object.keys(updates).length > 0) {
      contactUpdates += 1;
    }

    const identities = new Set(explicitIds);
    if (phoneDigits) {
      identities.add(phoneDigits);
      identities.add(`${phoneDigits}@s.whatsapp.net`);
    }

    for (const externalId of identities) {
      if (!apply) {
        identityUpserts += 1;
        continue;
      }

      await upsertIdentity(contact.tenantId, contact.id, externalId);
      identityUpserts += 1;
    }
  }

  for (const conversation of conversations) {
    const metadata =
      conversation.metadata &&
      typeof conversation.metadata === 'object' &&
      !Array.isArray(conversation.metadata)
        ? conversation.metadata
        : {};

    const normalizedThreadId =
      normalizeWhatsappIdentity(conversation.externalThreadId) ||
      normalizeWhatsappIdentity(metadata.remoteJid) ||
      null;

    const participantDigits = extractWhatsappDigits(conversation.externalParticipantId);
    const nextParticipantId = isPlausibleWhatsappDigits(participantDigits)
      ? participantDigits
      : normalizeWhatsappIdentity(conversation.externalParticipantId);

    const updates = {};

    if (normalizedThreadId && normalizedThreadId !== conversation.externalThreadId) {
      updates.externalThreadId = normalizedThreadId;
    }

    if (nextParticipantId && nextParticipantId !== conversation.externalParticipantId) {
      updates.externalParticipantId = nextParticipantId;
    }

    if (apply && Object.keys(updates).length > 0) {
      await prisma.agentConversation.update({
        where: { id: conversation.id },
        data: updates,
      });
    }

    if (Object.keys(updates).length > 0) {
      conversationUpdates += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        contactUpdates,
        identityUpserts,
        conversationUpdates,
        ambiguousLids,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
