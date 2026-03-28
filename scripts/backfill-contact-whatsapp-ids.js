/*
  Backfill canonical WhatsApp fields for existing contacts and register aliases.

  Usage:
    node scripts/backfill-contact-whatsapp-ids.js

  Notes:
  - Requires DATABASE_URL env var.
  - Safe to run multiple times (idempotent).
*/

const { PrismaClient } = require('@prisma/client');

function normalizeJid(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Remove device suffix like ":1@..." when present.
  return trimmed.replace(/:[0-9]+(?=@)/, '');
}

function extractDigits(value) {
  const normalized = normalizeJid(value);
  if (!normalized) return '';
  return normalized
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
    .replace(/\D/g, '');
}

function buildFullIdFromDigits(digits) {
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

async function main() {
  const prisma = new PrismaClient();

  const contacts = await prisma.contact.findMany({
    select: { id: true, tenantId: true, whatsapp: true, phone: true, notes: true, whatsappE164: true, whatsappFullId: true },
  });

  let updated = 0;
  let aliasUpserts = 0;

  for (const c of contacts) {
    const candidates = [c.whatsapp, c.phone]
      .concat(typeof c.notes === 'string' ? c.notes.split(/\s+/) : [])
      .filter(Boolean);

    // Prefer anything that looks like a phone JID.
    const jidCandidate = candidates.find((v) => typeof v === 'string' && String(v).includes('@s.whatsapp.net'));
    const lidCandidate = candidates.find((v) => typeof v === 'string' && String(v).includes('@lid'));

    const digits =
      extractDigits(jidCandidate || c.whatsapp || c.phone || '') ||
      '';

    const nextE164 = digits && /^\d{10,15}$/.test(digits) ? digits : null;
    const nextFullId = nextE164 ? buildFullIdFromDigits(nextE164) : null;

    const data = {};
    if (nextE164 && c.whatsappE164 !== nextE164) data.whatsappE164 = nextE164;
    if (nextFullId && c.whatsappFullId !== nextFullId) data.whatsappFullId = nextFullId;

    const shouldUpdate = Object.keys(data).length > 0;
    if (shouldUpdate) {
      await prisma.contact.update({ where: { id: c.id }, data });
      updated += 1;
    }

    // Register aliases (best-effort).
    const identities = [];
    if (nextFullId) identities.push(nextFullId);
    if (nextE164) identities.push(nextE164);
    if (jidCandidate) identities.push(normalizeJid(jidCandidate));
    if (lidCandidate) identities.push(normalizeJid(lidCandidate));

    for (const externalId of Array.from(new Set(identities)).filter(Boolean)) {
      try {
        await prisma.contactChannelIdentity.upsert({
          where: {
            tenantId_channel_externalId: {
              tenantId: c.tenantId,
              channel: 'WHATSAPP',
              externalId,
            },
          },
          create: {
            id: cryptoRandomUuid(),
            tenantId: c.tenantId,
            contactId: c.id,
            channel: 'WHATSAPP',
            provider: 'BACKFILL',
            externalId,
          },
          update: {
            contactId: c.id,
          },
        });
        aliasUpserts += 1;
      } catch {
        // ignore conflicts due to historic duplicates; those should be resolved by manual merge
      }
    }
  }

  await prisma.$disconnect();
  console.log(`Backfill complete. Contacts updated=${updated}, identity upserts=${aliasUpserts}`);
}

function cryptoRandomUuid() {
  // Node 16+ supports crypto.randomUUID()
  const crypto = require('crypto');
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.randomBytes(1)[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

