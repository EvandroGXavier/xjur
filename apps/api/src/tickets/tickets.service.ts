
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(createTicketDto: CreateTicketDto, tenantId: string, userId: string) {
    // Basic implementation: assumes contactId is valid or null
    // In a real scenario, we would use ContactsService to find/create contact by phone
    
    // Create Ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId,
        title: createTicketDto.title,
        status: 'OPEN',
        priority: createTicketDto.priority || 'MEDIUM',
        channel: createTicketDto.channel,
        contactId: createTicketDto.contactId,
        queue: createTicketDto.queue,
        assigneeId: createTicketDto.assigneeId || userId, // Assign to creator by default or specific assignee
      },
    });

    // Add initial message if provided (e.g. description of the issue)
    if (createTicketDto.description) {
      await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: 'USER', // Created by agent
          senderId: userId,
          content: createTicketDto.description,
          contentType: 'TEXT',
        },
      });
    }

    return ticket;
  }

  async findAll(tenantId: string, filters?: { status?: string, queue?: string, assigneeId?: string }) {
    const where: any = { tenantId };
    
    if (filters?.status) where.status = filters.status;
    if (filters?.queue) where.queue = filters.queue;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;

    return this.prisma.ticket.findMany({
      where,
      include: {
        contact: {
            select: { id: true, name: true, phone: true, email: true }
        },
        _count: {
             select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async addMessage(id: string, createMessageDto: CreateMessageDto, tenantId: string, userId: string) {
    const ticket = await this.findOne(id, tenantId); // Validates existence and tenant access

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'USER',
        senderId: userId,
        content: createMessageDto.content,
        contentType: createMessageDto.contentType || 'TEXT',
        mediaUrl: createMessageDto.mediaUrl,
      },
    });

    // Update ticket updatedAt to bump it to top of list
    await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() } // Manual update to trigger sort
    });

    return message;
  }

  async updateStatus(id: string, status: string, tenantId: string) {
      // Validate ticket
      await this.findOne(id, tenantId);

      return this.prisma.ticket.update({
          where: { id },
          data: { status }
      });
  }

  // Helper for simulation: Create a fake incoming message from customer
  async simulateIncomingMessage(id: string, content: string, tenantId: string) {
      const ticket = await this.findOne(id, tenantId);
      
      const message = await this.prisma.ticketMessage.create({
          data: {
              ticketId: ticket.id,
              senderType: 'CONTACT',
              senderId: ticket.contactId, // Can be null
              content,
              contentType: 'TEXT'
          }
      });
      
      return message;
  }
}
