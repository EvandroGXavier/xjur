import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  construirContatosAdicionaisPorCanal,
  normalizarIdentificadorCanal,
} from '../common/contact-identifiers';

@Injectable()
export class ChannelIdentifiersMigrationService implements OnModuleInit {
  private readonly logger = new Logger(ChannelIdentifiersMigrationService.name);
  private hasRun = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (this.hasRun) return;
    this.hasRun = true;

    try {
      await this.migrateLegacyIdentifiers();
    } catch (error: any) {
      this.logger.error(`Falha ao migrar identificadores legados para additionalContacts: ${error?.message || error}`);
    }
  }

  private buildLegacyAdditionalContacts(contact: any) {
    const values = new Map<string, { type: string; value: string; nomeContatoAdicional: string | null }>();

    const push = (type: string, value?: string | null, nomeContatoAdicional?: string | null) => {
      const normalizedValue = normalizarIdentificadorCanal(value) || String(value || '').trim();
      if (!normalizedValue) return;

      const key = normalizedValue.toLowerCase();
      if (!values.has(key)) {
        values.set(key, {
          type,
          value: normalizedValue,
          nomeContatoAdicional: nomeContatoAdicional || null,
        });
      }
    };

    construirContatosAdicionaisPorCanal('EMAIL', [contact.email]).forEach((item) =>
      push(item.type, item.value, item.nomeContatoAdicional),
    );
    construirContatosAdicionaisPorCanal('WHATSAPP', [
      contact.whatsapp,
      contact.whatsappE164,
      contact.whatsappFullId,
    ]).forEach((item) => push(item.type, item.value, item.nomeContatoAdicional));

    if (contact.phone) {
      push('TELEFONE', contact.phone, 'Telefone Principal');
    }

    const identities = Array.isArray(contact.channelIdentities) ? contact.channelIdentities : [];
    for (const identity of identities) {
      construirContatosAdicionaisPorCanal(identity.channel, [identity.externalId]).forEach((item) =>
        push(item.type, item.value, item.nomeContatoAdicional),
      );
    }

    return Array.from(values.values());
  }

  private async migrateLegacyIdentifiers() {
    const batchSize = 200;
    let skip = 0;
    let migratedContacts = 0;
    let migratedIdentifiers = 0;

    while (true) {
      const contacts = await this.prisma.contact.findMany({
        where: {
          OR: [
            { email: { not: null } },
            { phone: { not: null } },
            { whatsapp: { not: null } },
            { whatsappE164: { not: null } },
            { whatsappFullId: { not: null } },
            { channelIdentities: { some: {} } },
          ],
        },
        include: {
          additionalContacts: {
            select: {
              value: true,
            },
          },
          channelIdentities: {
            select: {
              channel: true,
              externalId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: batchSize,
      });

      if (contacts.length === 0) {
        break;
      }

      for (const contact of contacts) {
        const desiredIdentifiers = this.buildLegacyAdditionalContacts(contact);
        if (desiredIdentifiers.length === 0) {
          continue;
        }

        const existingValues = new Set(
          (contact.additionalContacts || [])
            .map((item: any) => String(item.value || '').trim().toLowerCase())
            .filter(Boolean),
        );

        const toCreate = desiredIdentifiers.filter(
          (item) => !existingValues.has(String(item.value || '').trim().toLowerCase()),
        );

        if (toCreate.length === 0) {
          continue;
        }

        await this.prisma.additionalContact.createMany({
          data: toCreate.map((item) => ({
            contactId: contact.id,
            type: item.type,
            value: item.value,
            nomeContatoAdicional: item.nomeContatoAdicional,
          })),
        });

        migratedContacts += 1;
        migratedIdentifiers += toCreate.length;
      }

      skip += contacts.length;
    }

    if (migratedIdentifiers > 0) {
      this.logger.log(
        `Migracao de identificadores concluida: ${migratedIdentifiers} identificadores em ${migratedContacts} contatos.`,
      );
    }
  }
}
