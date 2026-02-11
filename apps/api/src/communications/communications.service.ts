
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
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
          { email: dto.from }
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
          category: 'LEAD'
        }
      });
    }

    // 2. Determine Logic: Add to existing ticket or Create new?
    // Find latest OPEN ticket for this contact
    let ticket = await this.prisma.ticket.findFirst({
      where: {
        tenantId: dto.tenantId,
        contactId: contact.id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (ticket) {
      console.log(`[Communications] Linking to existing Ticket #${ticket.code}`);
      const msg = await this.ticketsService.simulateIncomingMessage(ticket.id, dto.content, dto.tenantId);
      return { action: 'MESSAGE_ADDED', ticketId: ticket.id, messageId: msg.id };
    } else {
      console.log(`[Communications] Creating NEW Ticket`);
      // Find a default user (Agent) or System User
      const defaultUser = await this.prisma.user.findFirst({ where: { tenantId: dto.tenantId } });
      const userId = defaultUser ? defaultUser.id : 'SYSTEM';

      const createDto: CreateTicketDto = {
        title: `Atendimento ${dto.channel} - ${contact.name}`,
        description: dto.content,
        priority: 'MEDIUM',
        channel: dto.channel,
        contactId: contact.id,
        queue: 'GERAL',
        // status is handled by service
      } as any; // Cast to avoid strict type issues if DTO differs slightly

      const newTicket = await this.ticketsService.create(createDto, dto.tenantId, userId);
      return { action: 'TICKET_CREATED', ticketId: newTicket.id, code: newTicket.code };
    }
  }
}
