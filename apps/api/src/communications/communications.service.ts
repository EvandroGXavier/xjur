
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { InboxService } from '../inbox/inbox.service';

@Injectable()
export class CommunicationsService {
  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
    private inboxService: InboxService,
  ) {}

  async processIncoming(dto: IncomingCommunicationDto) {
    console.log(`[Communications] Received from ${dto.from} via ${dto.channel}`);

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
      console.log(`[Communications] Contact not found. Creating LEAD for ${dto.from}`);
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
      conversationId: capture.conversation.id,
      messageId: capture.message.id,
      ticketId: capture.conversation.ticketId,
    };
  }
}
