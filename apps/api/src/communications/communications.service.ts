import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';
import { InboxService } from '../inbox/inbox.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private prisma: PrismaService,
    private inboxService: InboxService,
  ) {}

  private normalizeWhatsappIdentity(value?: string | null) {
    if (typeof value !== 'string') return null;

    const normalized = value.trim().replace(/:[0-9]+(?=@)/, '');
    return normalized.length > 0 ? normalized : null;
  }

  private extractWhatsappDigits(value?: string | null) {
    const normalized = this.normalizeWhatsappIdentity(value);
    if (!normalized) return '';
    if (normalized.includes('@lid') || normalized.includes('@g.us')) return '';

    if (normalized.includes('@s.whatsapp.net')) {
      return normalized.split('@')[0].replace(/\D/g, '');
    }

    return normalized.replace(/\D/g, '');
  }

  private buildWhatsappLookupCandidates(value?: string | null) {
    const normalized = this.normalizeWhatsappIdentity(value);
    const candidates = new Set<string>();
    const digits = this.extractWhatsappDigits(value);

    if (normalized) candidates.add(normalized);
    if (digits) {
      candidates.add(digits);
      candidates.add(`${digits}@s.whatsapp.net`);
    }

    return Array.from(candidates);
  }

  async processIncoming(dto: IncomingCommunicationDto) {
    this.logger.log(`Inbound channel=${dto.channel} from=${dto.from}`);

    // 0. Log Raw Communication
    await this.prisma.communicationLog.create({
      data: {
        tenantId: dto.tenantId,
        channel: dto.channel,
        direction: 'INBOUND',
        content: dto.content,
        status: 'RECEIVED',
        processedBy: 'SYSTEM' // Will be updated later
      }
    });

    const normalizedChannel = (dto.channel || '').trim().toUpperCase();
    const whatsappLookupCandidates =
      normalizedChannel === 'WHATSAPP'
        ? this.buildWhatsappLookupCandidates(dto.externalThreadId || dto.from)
        : [];
    const whatsappDigits = normalizedChannel === 'WHATSAPP' ? this.extractWhatsappDigits(dto.from) : '';
    const whatsappThreadId =
      normalizedChannel === 'WHATSAPP'
        ? whatsappLookupCandidates.find((candidate) => candidate.includes('@')) ||
          (whatsappDigits ? `${whatsappDigits}@s.whatsapp.net` : null)
        : null;
    const whatsappParticipantId =
      normalizedChannel === 'WHATSAPP' ? whatsappDigits || this.normalizeWhatsappIdentity(dto.from) : null;

    let contact = null as any;

    if (normalizedChannel === 'WHATSAPP' && whatsappLookupCandidates.length > 0) {
      const identity = await this.prisma.contactChannelIdentity.findFirst({
        where: {
          tenantId: dto.tenantId,
          channel: 'WHATSAPP',
          externalId: {
            in: whatsappLookupCandidates,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (identity?.contactId) {
        contact = await this.prisma.contact.findFirst({
          where: {
            id: identity.contactId,
            tenantId: dto.tenantId,
          },
        });
      }
    }

    if (!contact) {
      contact = await this.prisma.contact.findFirst({
        where: {
          tenantId: dto.tenantId,
          OR: [
            ...(normalizedChannel === 'WHATSAPP'
              ? [
                  { whatsappFullId: { in: whatsappLookupCandidates } },
                  { whatsapp: { in: whatsappLookupCandidates } },
                  ...(whatsappDigits
                    ? [
                        { whatsappE164: whatsappDigits },
                        { phone: whatsappDigits },
                      ]
                    : []),
                ]
              : []),
            { email: dto.from },
            ...(normalizedChannel === 'TELEGRAM'
              ? [{ metadata: { path: ['telegramUserId'], equals: dto.from } } as any]
              : []),
          ],
        },
      });
    }

    if (!contact) {
      this.logger.log(`Creating inbound lead for ${dto.channel}:${dto.from}`);
      contact = await this.prisma.contact.create({
        data: {
          tenantId: dto.tenantId,
          name: dto.name || `Lead ${dto.from}`,
          personType: 'LEAD',
          phone:
            normalizedChannel === 'PHONE'
              ? dto.from
              : normalizedChannel === 'WHATSAPP'
                ? whatsappDigits || undefined
                : undefined,
          whatsapp:
            normalizedChannel === 'WHATSAPP'
              ? whatsappParticipantId || undefined
              : undefined,
          whatsappE164:
            normalizedChannel === 'WHATSAPP' && whatsappDigits
              ? whatsappDigits
              : undefined,
          whatsappFullId:
            normalizedChannel === 'WHATSAPP'
              ? whatsappThreadId || undefined
              : undefined,
          email: dto.channel === 'EMAIL' ? dto.from : undefined,
          category: 'LEAD',
          metadata: dto.channel === 'TELEGRAM'
            ? {
                telegramUserId: dto.from,
                telegramChatId: dto.externalThreadId || null,
                telegramUsername: dto.metadata?.telegramUsername || null,
              }
            : undefined,
        },
      });

      if (normalizedChannel === 'WHATSAPP') {
        for (const externalId of whatsappLookupCandidates) {
          await this.prisma.contactChannelIdentity.upsert({
            where: {
              tenantId_channel_externalId: {
                tenantId: dto.tenantId,
                channel: 'WHATSAPP',
                externalId,
              },
            },
            create: {
              tenantId: dto.tenantId,
              contactId: contact.id,
              channel: 'WHATSAPP',
              provider: 'GENERIC',
              externalId,
            },
            update: {
              contactId: contact.id,
              provider: 'GENERIC',
            },
          });
        }
      }
    } else if (dto.channel === 'TELEGRAM') {
      const currentMetadata =
        contact.metadata && typeof contact.metadata === 'object' && !Array.isArray(contact.metadata)
          ? contact.metadata
          : {};

      const nextMetadata = {
        ...currentMetadata,
        telegramUserId: dto.from,
        telegramChatId: dto.externalThreadId || currentMetadata.telegramChatId || null,
        telegramUsername: dto.metadata?.telegramUsername || currentMetadata.telegramUsername || null,
      };

      const nextName = dto.name?.trim() || contact.name;
      if (
        JSON.stringify(currentMetadata) !== JSON.stringify(nextMetadata) ||
        nextName !== contact.name
      ) {
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: {
            name: nextName,
            metadata: nextMetadata,
          },
        });
      }
    }

    const capture = await this.inboxService.captureExternalMessage({
      tenantId: dto.tenantId,
      channel: dto.channel,
      contactId: contact.id,
      connectionId: dto.connectionId || null,
      externalThreadId:
        normalizedChannel === 'WHATSAPP'
          ? whatsappThreadId || dto.externalThreadId || dto.from
          : dto.externalThreadId || dto.from,
      externalMessageId: dto.externalMessageId || null,
      externalParticipantId:
        normalizedChannel === 'WHATSAPP'
          ? whatsappParticipantId || dto.from
          : dto.from,
      direction: 'INBOUND',
      role: 'contact',
      content: dto.content,
      contentType: dto.contentType || 'TEXT',
      mediaUrl: dto.mediaUrl || null,
      title: `Atendimento ${dto.channel} - ${contact.name}`,
      senderName: dto.name || contact.name,
      senderAddress: dto.from,
      metadata: {
        ...(dto.metadata || {}),
        connectionId: dto.connectionId,
        externalThreadId:
          normalizedChannel === 'WHATSAPP'
            ? whatsappThreadId || dto.externalThreadId || dto.from
            : dto.externalThreadId || dto.from,
        senderAddress: dto.from,
        subject: dto.subject,
        channel: dto.channel,
      },
    });

    return {
      action: capture.created ? 'CONVERSATION_CAPTURED' : 'CONVERSATION_UPDATED',
      created: capture.created,
      conversationId: capture.conversation.id,
      messageId: capture.message.id,
      ticketId: capture.conversation.ticketId || capture.ticket?.id,
      legacyTicketId: capture.conversation.ticketId || capture.ticket?.id,
    };
  }
}
