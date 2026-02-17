
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TicketsGateway } from './tickets.gateway';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private ticketsGateway: TicketsGateway,
  ) {}

  async create(createTicketDto: CreateTicketDto, tenantId: string, userId: string) {
    // If contactPhone was provided and no contactId, find or create contact
    let contactId = createTicketDto.contactId;

    if (!contactId && createTicketDto.contactPhone) {
      const existingContact = await this.prisma.contact.findFirst({
        where: { tenantId, phone: createTicketDto.contactPhone },
      });

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const contactData: any = {
            tenantId,
            name: createTicketDto.contactName || createTicketDto.contactPhone,
            phone: createTicketDto.contactPhone,
            // If channel is WhatsApp, save as whatsapp field too
            whatsapp: createTicketDto.channel === 'WHATSAPP' ? createTicketDto.contactPhone : undefined,
        };

        const newContact = await this.prisma.contact.create({
          data: contactData,
        });
        contactId = newContact.id;
      }
    }

    // Create Ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId,
        title: createTicketDto.title || 'Sem Assunto',
        status: 'OPEN',
        priority: createTicketDto.priority || 'MEDIUM',
        channel: createTicketDto.channel || 'WHATSAPP',
        contactId: contactId, // Ensure contactId is valid or handled if null (schema might allow optional)
        queue: createTicketDto.queue || 'DEFAULT',
        assigneeId: createTicketDto.assigneeId || userId,
      },
    });

    // Add initial message if provided
    if (createTicketDto.description) {
      await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: 'USER',
          senderId: userId,
          content: createTicketDto.description,
          contentType: 'TEXT',
        },
      });
    }

    // 🔌 Emit WebSocket event for new ticket
    const fullTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketCreated(tenantId, fullTicket);

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
            select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true }
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

  async addMessage(id: string, createMessageDto: CreateMessageDto, tenantId: string, userId: string, file?: Express.Multer.File) {
    const ticket = await this.findOne(id, tenantId);

    let contentType = createMessageDto.contentType || 'TEXT';
    let mediaUrl = createMessageDto.mediaUrl;

    if (file) {
        mediaUrl = file.path;
        if (file.mimetype.startsWith('image/')) contentType = 'IMAGE';
        else if (file.mimetype.startsWith('audio/')) contentType = 'AUDIO';
        else contentType = 'FILE'; 
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'USER',
        senderId: userId,
        content: createMessageDto.content || '', // content is optional for media
        contentType: contentType as any,
        mediaUrl: mediaUrl,
      },
    });

    // Update ticket updatedAt
    await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { 
          updatedAt: new Date(),
          // Auto-update status to IN_PROGRESS when agent responds on OPEN tickets
          ...(ticket.status === 'OPEN' ? { status: 'IN_PROGRESS' } : {}),
        }
    });

    // ==========================================
    // SEND VIA WHATSAPP (Baileys) if channel is WHATSAPP
    // ==========================================
    if (ticket.channel === 'WHATSAPP') {
      const phone = ticket.contact?.whatsapp || ticket.contact?.phone;

      if (!phone) {
         this.ticketsGateway.emitTicketError(tenantId, {
             ticketId: ticket.id,
             message: 'Contato sem telefone/WhatsApp cadastrado. Mensagem salva apenas internamente.',
             code: 'NO_PHONE'
         });
      } else {
        try {
          // Find CONNECTED WhatsApp connection for this tenant
          const connection = await this.prisma.connection.findFirst({
            where: { 
              tenantId, 
              type: 'WHATSAPP', 
              status: 'CONNECTED' 
            },
          });

          if (connection) {
            let externalId: string | undefined;

            if (contentType === 'TEXT') {
                const safeContent = message.content || '';
                externalId = await this.whatsappService.sendText(connection.id, phone, safeContent);
            } else {
                 let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
                 if (contentType === 'IMAGE') mediaType = 'image';
                 else if (contentType === 'AUDIO') mediaType = 'audio';
                 else if (file?.mimetype?.startsWith('video/')) mediaType = 'video';
                 
                 externalId = await this.whatsappService.sendMedia(
                     connection.id, 
                     phone, 
                     mediaType, 
                     mediaUrl, 
                     message.content || '',
                     file?.mimetype,
                     file?.originalname
                 );
            }
            
            if (externalId && typeof externalId === 'string') {
                await this.prisma.ticketMessage.update({
                    where: { id: message.id },
                    data: { externalId, status: 'SENT' }
                });
            }

            this.logger.log(`✅ WhatsApp message sent to ${phone} via connection ${connection.id}`);
          } else {
            this.logger.warn(`⚠️ No CONNECTED WhatsApp connection for tenant ${tenantId}.`);
            this.ticketsGateway.emitTicketError(tenantId, {
                ticketId: ticket.id,
                message: 'Nenhuma conexão WhatsApp ativa. Verifique o menu Conexões.',
                code: 'NO_CONNECTION'
            });
          }
        } catch (error) {
          this.logger.error(`❌ Failed to send WhatsApp message to ${phone}: ${error.message}`);
          this.ticketsGateway.emitTicketError(tenantId, {
              ticketId: ticket.id,
              message: `Erro ao enviar WhatsApp: ${error.message}`,
              code: 'SEND_ERROR'
          });
        }
      }
    }

    // 🔌 Emit WebSocket event for new message
    this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

    // Also emit ticket:updated so the ticket list refreshes
    const updatedTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketUpdated(tenantId, updatedTicket);

    return message;
  }

  async updateStatus(id: string, status: string, tenantId: string) {
      // Validate ticket
      await this.findOne(id, tenantId);

      const updated = await this.prisma.ticket.update({
          where: { id },
          data: { status },
          include: {
            contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true } },
            _count: { select: { messages: true } },
          },
      });

      // 🔌 Emit WebSocket event for status change
      this.ticketsGateway.emitTicketUpdated(tenantId, updated);

      return updated;
  }

  // Helper for simulation: Create a fake incoming message from customer
  async simulateIncomingMessage(id: string, content: string, tenantId: string) {
      const ticket = await this.findOne(id, tenantId);
      
      const message = await this.prisma.ticketMessage.create({
          data: {
              ticketId: ticket.id,
              senderType: 'CONTACT',
              senderId: ticket.contactId,
              content,
              contentType: 'TEXT'
          }
      });

      // Update ticket updatedAt
      await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { updatedAt: new Date() }
      });

      // 🔌 Emit WebSocket event for simulated incoming message
      this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

      const updatedTicket = await this.prisma.ticket.findFirst({
        where: { id: ticket.id },
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true } },
          _count: { select: { messages: true } },
        },
      });
      this.ticketsGateway.emitTicketUpdated(tenantId, updatedTicket);
      
      return message;
  }

  async deleteMessage(messageId: string, tenantId: string, userId: string) {
    const message = await this.prisma.ticketMessage.findFirst({
        where: { id: messageId, ticket: { tenantId } },
        include: { ticket: { include: { contact: true } } }
    });
    
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    // Attempt to delete from WhatsApp (Best Effort)
    if (message.ticket.channel === 'WHATSAPP') {
        try {
            const connection = await this.prisma.connection.findFirst({
                where: { tenantId, type: 'WHATSAPP', status: 'CONNECTED' }
            });
            if (connection) {
                if (message.externalId) {
                    const phone = message.ticket.contact?.whatsapp || message.ticket.contact?.phone;
                    await this.whatsappService.deleteMessage(connection.id, phone, message.externalId, true);
                    this.logger.log(`✅ Remote delete executed for message ${messageId}`);
                } else {
                    this.logger.warn(`Skipping remote delete for message ${messageId} as externalId is missing.`);
                }
            }
        } catch (e) {
            this.logger.error(`Failed to delete WhatsApp message: ${e.message}`);
        }
    }


    // Delete from DB
    await this.prisma.ticketMessage.delete({
        where: { id: messageId }
    });

    // Notify Frontend
    this.ticketsGateway.emitMessageDeleted(tenantId, message.ticketId, messageId);

    return { success: true };
  }


  async markAsRead(ticketId: string, tenantId: string) {
      const ticket = await this.findOne(ticketId, tenantId);
      
      const unreadMessages = await this.prisma.ticketMessage.findMany({
          where: { ticketId, status: { not: 'READ' }, senderType: 'CONTACT', externalId: { not: null } }
      });
      
      if (unreadMessages.length === 0) return;
      
      // Update local first
      await this.prisma.ticketMessage.updateMany({
          where: { id: { in: unreadMessages.map(m => m.id) } },
          data: { status: 'READ', readAt: new Date() }
      });
      
      // Send to WhatsApp
      try {
          const connection = await this.prisma.connection.findFirst({
              where: { tenantId, type: 'WHATSAPP', status: 'CONNECTED' }
          });
          
          if (connection && ticket.contact?.whatsapp) {
              const fullJid = ticket.contact.whatsapp;
              // Only call if method exists (in case it wasn't added yet properly)
              if (this.whatsappService.markRead) {
                  await this.whatsappService.markRead(connection.id, fullJid, unreadMessages.map(m => m.externalId));
              }
          }
      } catch (e) {
          this.logger.warn(`Failed to sync read status with WhatsApp: ${e.message}`);
      }
      
      // Emit update
      this.ticketsGateway.emitTicketUpdated(tenantId, { ...ticket, _count: { messages: 0 } }); 
  }
}
