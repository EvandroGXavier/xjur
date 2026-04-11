const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

const dryRun = !process.argv.includes('--apply');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function buildNextMetadata(metadata, integration, bankAccount) {
  const current = isObject(metadata) ? { ...metadata } : {};

  delete current.sigiloContatoId;
  delete current.sigiloContatoNome;

  return {
    ...current,
    sigiloOrigem: 'BANK_ACCOUNT',
    sigiloContaId: integration.bankAccountId,
    sigiloContaTitulo: bankAccount?.title || null,
    sigiloBanco: current.sigiloBanco || integration.provider || 'INTER',
  };
}

async function main() {
  console.log(
    dryRun
      ? 'Executando saneamento em modo DRY-RUN.'
      : 'Executando saneamento em modo APPLY.',
  );

  const allIntegrations = await prisma.bankIntegration.findMany({
    include: {
      bankAccount: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const integrations = allIntegrations.filter((integration) => {
    const metadata = isObject(integration.metadata) ? integration.metadata : {};
    return metadata.sigiloOrigem === 'CONTACT' || Boolean(metadata.sigiloContatoId);
  });

  if (integrations.length === 0) {
    console.log('Nenhuma integração bancária antiga vinculada ao contato foi encontrada.');
    return;
  }

  let migrated = 0;
  let unresolved = 0;

  for (const integration of integrations) {
    const metadata = isObject(integration.metadata) ? integration.metadata : {};
    const oldContactId = String(metadata.sigiloContatoId || '').trim() || null;

    if (!integration.bankAccountId) {
      unresolved += 1;
      console.log(
        `[PENDENTE] Integração ${integration.id} (${integration.displayName}) não possui bankAccountId. Contato antigo: ${oldContactId || 'N/A'}`,
      );
      continue;
    }

    const nextMetadata = buildNextMetadata(
      integration.metadata,
      integration,
      integration.bankAccount,
    );

    const linkedSecretIds = [
      integration.credentialSecretId,
      integration.certificateSecretId,
      integration.webhookSecretId,
    ].filter(Boolean);

    const linkedSecrets = linkedSecretIds.length
      ? await prisma.securitySecret.findMany({
          where: {
            tenantId: integration.tenantId,
            id: { in: linkedSecretIds },
          },
        })
      : [];

    const contactScopedSecrets = linkedSecrets.filter(
      (secret) =>
        secret.entityType === 'CONTACT' &&
        (!oldContactId || secret.entityId === oldContactId),
    );

    console.log(
      `[${dryRun ? 'DRY' : 'APPLY'}] ${integration.displayName} | integração=${integration.id} | conta=${integration.bankAccountId} | segredos_mover=${contactScopedSecrets.length}`,
    );

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        await tx.bankIntegration.update({
          where: { id: integration.id },
          data: {
            metadata: nextMetadata,
          },
        });

        for (const secret of contactScopedSecrets) {
          await tx.securitySecret.update({
            where: { id: secret.id },
            data: {
              entityType: 'BANK_INTEGRATION',
              entityId: integration.id,
            },
          });
        }
      });
    }

    migrated += 1;
  }

  console.log('');
  console.log(`Integrações encontradas: ${integrations.length}`);
  console.log(`Integrações saneadas: ${migrated}`);
  console.log(`Pendências sem conta vinculada: ${unresolved}`);

  if (dryRun) {
    console.log('Nenhuma alteração foi gravada. Execute com --apply para persistir.');
  }
}

main()
  .catch((error) => {
    console.error('Falha ao sanear sigilo bancário do contato:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
