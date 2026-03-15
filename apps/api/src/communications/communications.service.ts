import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { InboxService } from '../inbox/inbox.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
    private inboxService: InboxService,
  ) {}

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

    // 1. Find or Create Contact
    let contact = await this.prisma.contact.findFirst({
      where: {
        tenantId: dto.tenantId,
        OR: [
          { phone: { contains: dto.from } },
          { whatsapp: { contains: dto.from } },
          { email: dto.from },
          ...(dto.channel === 'TELEGRAM'
            ? [{ metadata: { path: ['telegramUserId'], equals: dto.from } } as any]
            : []),
        ]
      }
    });

    if (!contact) {
      this.logger.log(`Creating inbound lead for ${dto.channel}:${dto.from}`);
      contact = await this.prisma.contact.create({
        data: {
          tenantId: dto.tenantId,
          name: dto.name || `Lead ${dto.from}`,
          personType: 'LEAD',
          phone: (dto.channel === 'WHATSAPP' || dto.channel === 'PHONE') ? dto.from : undefined,
          email: dto.channel === 'EMAIL' ? dto.from : undefined,
          category: 'LEAD',
          metadata: dto.channel === 'TELEGRAM'
            ? {
                telegramUserId: dto.from,
                telegramChatId: dto.externalThreadId || null,
                telegramUsername: dto.metadata?.telegramUsername || null,
              }
            : undefined,
        }
      });
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
      externalThreadId: dto.externalThreadId || dto.from,
      externalMessageId: dto.externalMessageId || null,
      externalParticipantId: dto.from,
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
        externalThreadId: dto.externalThreadId || dto.from,
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
      ticketId: capture.conversation.ticketId,
    };
  }
}
