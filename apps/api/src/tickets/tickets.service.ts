import { Injectable, NotFoundException, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { TelegramService } from '../telegram/telegram.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TicketsGateway } from './tickets.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  // Helper to format phone numbers for WhatsApp/Evolution
  private formatNumber(number: string): string {
    // Keep group JIDs and LIDs intact
    if (number.includes('@g.us') || number.includes('@lid') || number.includes('@s.whatsapp.net')) return number;
    // Strip any suffix after '@' or ':'
    const base = number.split('@')[0].split(':')[0];
    const cleaned = base.replace(/\D/g, '');
    if (cleaned.startsWith('55')) return cleaned;
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      return '55' + cleaned;
    }
    return cleaned;
  }

  private asMetadataObject(metadata: any): Record<string, any> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  }

  private buildMessageMetadata(
    connectionId?: string | null,
    file?: Express.Multer.File,
    extras: Record<string, any> = {},
  ): Record<string, any> | undefined {
    const metadata: Record<string, any> = { ...extras };

    if (connectionId) {
      metadata.connectionId = connectionId;
    }

    if (file) {
      metadata.fileName = file.originalname;
      metadata.mimeType = file.mimetype;
      metadata.fileSize = file.size;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private resolveAgentThreadId(ticket: any, metadata: Record<string, any>) {
    if (typeof metadata.remoteJid === 'string' && metadata.remoteJid.trim().length > 0) {
      return metadata.remoteJid.trim();
    }

    if (typeof metadata.externalThreadId === 'string' && metadata.externalThreadId.trim().length > 0) {
      return metadata.externalThreadId.trim();
    }

    if (ticket.channel === 'WHATSAPP') {
      return ticket.contact?.whatsapp || ticket.contact?.phone || 'ticket:' + ticket.id;
    }

    if (ticket.channel === 'EMAIL') {
      return ticket.contact?.email || 'ticket:' + ticket.id;
    }

    if (ticket.channel === 'TELEGRAM') {
      return (
        metadata.telegramChatId
        || metadata.senderAddress
        || metadata.telegramUserId
        || ticket.contact?.metadata?.telegramChatId
        || 'ticket:' + ticket.id
      );
    }

    return 'ticket:' + ticket.id;
  }

  private async captureTicketMessageForAgent(
    ticket: any,
    message: any,
    direction: 'INBOUND' | 'OUTBOUND',
    role: string,
  ) {
    const metadata = this.asMetadataObject(message.metadata);
    const senderAddress =
      metadata.remoteJid
      || metadata.senderAddress
      || (ticket.channel === 'TELEGRAM' ? ticket.contact?.metadata?.telegramChatId : null)
      || (ticket.channel === 'EMAIL' ? ticket.contact?.email : null)
      || ticket.contact?.whatsapp
      || ticket.contact?.phone
      || null;

    await this.agentService.captureMessage({
      tenantId: ticket.tenantId,
      channel: ticket.channel,
      ticketId: ticket.id,
      ticketMessageId: message.id,
      contactId: ticket.contactId,
      connectionId: metadata.connectionId || null,
      externalThreadId: this.resolveAgentThreadId(ticket, metadata),
      externalMessageId: message.externalId || metadata.externalMessageId || null,
      externalParticipantId: senderAddress,
      title: ticket.title,
      direction,
      role,
      content: message.content || '',
      contentType: message.contentType || 'TEXT',
      senderName: direction === 'INBOUND' ? ticket.contact?.name || null : null,
      senderAddress,
      mediaUrl: message.mediaUrl || null,
      metadata,
      createdAt: message.createdAt,
    });
  }

  private async resolveWhatsappConnection(tenantId: string, ticket: { id: string }, preferredConnectionId?: string | null) {
    const normalizedConnectionId = preferredConnectionId?.trim();

    if (normalizedConnectionId) {
      const connection = await this.prisma.connection.findFirst({
        where: {
          id: normalizedConnectionId,
          tenantId,
          type: 'WHATSAPP',
          status: 'CONNECTED',
        },
      });

      if (!connection) {
        throw new BadRequestException('A conexao WhatsApp selecionada nao esta conectada.');
      }

      return connection;
    }

    const recentMessages = await this.prisma.ticketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { metadata: true },
    });

    const storedConnectionId = recentMessages
      .map((ticketMessage) => this.asMetadataObject(ticketMessage.metadata).connectionId)
      .find((value) => typeof value === 'string' && value.trim().length > 0);

    if (storedConnectionId) {
      const connection = await this.prisma.connection.findFirst({
        where: {
          id: storedConnectionId,
          tenantId,
          type: 'WHATSAPP',
          status: 'CONNECTED',
        },
      });

      if (!connection) {
        throw new BadRequestException('Este atendimento esta vinculado a uma conexao WhatsApp que nao esta conectada.');
      }

      return connection;
    }

    const connectedConnections = await this.prisma.connection.findMany({
      where: { tenantId, type: 'WHATSAPP', status: 'CONNECTED' },
      orderBy: { createdAt: 'asc' },
    });

    if (connectedConnections.length === 0) {
      return null;
    }

    if (connectedConnections.length === 1) {
      return connectedConnections[0];
    }

    throw new BadRequestException('Ha multiplas conexoes WhatsApp ativas e este atendimento ainda nao esta vinculado a uma instancia.');
  }

  private async resolveTelegramConnection(
    tenantId: string,
    ticket: { id: string },
    preferredConnectionId?: string | null,
  ) {
    const normalizedConnectionId = preferredConnectionId?.trim();

    if (normalizedConnectionId) {
      const connection = await this.prisma.connection.findFirst({
        where: {
          id: normalizedConnectionId,
          tenantId,
          type: 'TELEGRAM',
          status: 'CONNECTED',
        },
      });

      if (!connection) {
        throw new BadRequestException('A conexao Telegram selecionada nao esta conectada.');
      }

      return connection;
    }

    const recentMessages = await this.prisma.ticketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { metadata: true },
    });

    const storedConnectionId = recentMessages
      .map((ticketMessage) => this.asMetadataObject(ticketMessage.metadata).connectionId)
      .find((value) => typeof value === 'string' && value.trim().length > 0);

    if (storedConnectionId) {
      const connection = await this.prisma.connection.findFirst({
        where: {
          id: storedConnectionId,
          tenantId,
          type: 'TELEGRAM',
          status: 'CONNECTED',
        },
      });

      if (!connection) {
        throw new BadRequestException('Este atendimento esta vinculado a uma conexao Telegram que nao esta conectada.');
      }

      return connection;
    }

    const connectedConnections = await this.prisma.connection.findMany({
      where: { tenantId, type: 'TELEGRAM', status: 'CONNECTED' },
      orderBy: { createdAt: 'asc' },
    });

    if (connectedConnections.length === 0) {
      return null;
    }

    if (connectedConnections.length === 1) {
      return connectedConnections[0];
    }

    throw new BadRequestException(
      'Ha multiplas conexoes Telegram ativas e este atendimento ainda nao esta vinculado a um bot.',
    );
  }

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private whatsappService: WhatsappService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
    private ticketsGateway: TicketsGateway,
    private agentService: AgentService,
  ) {}

  async listMessagesAudit(
    tenantId: string,
    filters?: {
      search?: string;
      channel?: string;
      direction?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const page = Math.max(Number(filters?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(filters?.pageSize) || 50, 1), 200);
    const skip = (page - 1) * pageSize;
    const tenantScope = {
      OR: [{ tenantId }, { ticket: { is: { tenantId } } }, { contact: { is: { tenantId } } }],
    };
    const where: any = { AND: [tenantScope] };

    const normalizedChannel = filters?.channel?.trim().toUpperCase();
    if (normalizedChannel && normalizedChannel !== 'ALL') {
      where.AND.push({ channel: normalizedChannel });
    }

    const normalizedDirection = filters?.direction?.trim().toUpperCase();
    if (normalizedDirection && normalizedDirection !== 'ALL') {
      where.AND.push({ direction: normalizedDirection });
    }

    const normalizedStatus = filters?.status?.trim().toUpperCase();
    if (normalizedStatus && normalizedStatus !== 'ALL') {
      where.AND.push({ status: normalizedStatus });
    }

    const createdAt: Record<string, Date> = {};
    if (filters?.dateFrom) {
      const parsedFrom = new Date(filters.dateFrom);
      if (!Number.isNaN(parsedFrom.getTime())) {
        createdAt.gte = parsedFrom;
      }
    }
    if (filters?.dateTo) {
      const parsedTo = new Date(filters.dateTo);
      if (!Number.isNaN(parsedTo.getTime())) {
        parsedTo.setHours(23, 59, 59, 999);
        createdAt.lte = parsedTo;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      where.AND.push({ createdAt });
    }

    const search = filters?.search?.trim();
    if (search) {
      where.AND.push({
        OR: [
          { content: { contains: search, mode: 'insensitive' } },
          { textContent: { contains: search, mode: 'insensitive' } },
          { externalId: { contains: search, mode: 'insensitive' } },
          { externalThreadId: { contains: search, mode: 'insensitive' } },
          { externalParticipantId: { contains: search, mode: 'insensitive' } },
          { contact: { is: { name: { contains: search, mode: 'insensitive' } } } },
          { contact: { is: { phone: { contains: search } } } },
          { contact: { is: { whatsapp: { contains: search } } } },
          { ticket: { is: { title: { contains: search, mode: 'insensitive' } } } },
          { process: { is: { cnj: { contains: search } } } },
          { process: { is: { title: { contains: search, mode: 'insensitive' } } } },
          { connection: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.ticketMessage.count({ where }),
      this.prisma.ticketMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              whatsapp: true,
            },
          },
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
              queue: true,
            },
          },
          process: {
            select: {
              id: true,
              cnj: true,
              code: true,
              title: true,
            },
          },
          connection: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((message) => ({
        id: message.id,
        tenantId: message.tenantId,
        ticketId: message.ticketId,
        contactId: message.contactId,
        processId: message.processId,
        connectionId: message.connectionId,
        financialRecordId: message.financialRecordId,
        incomingEventId: message.incomingEventId,
        channel: message.channel,
        direction: message.direction,
        status: message.status,
        senderType: message.senderType,
        contentType: message.contentType,
        content: message.content,
        textContent: message.textContent,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
        scheduledAt: message.scheduledAt,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        readAt: message.readAt,
        externalId: message.externalId,
        externalThreadId: message.externalThreadId,
        externalParticipantId: message.externalParticipantId,
        contact: message.contact,
        ticket: message.ticket,
        process: message.process,
        connection: message.connection,
      })),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async create(createTicketDto: CreateTicketDto, tenantId: string, userId: string) {
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
          whatsapp: createTicketDto.channel === 'WHATSAPP' ? createTicketDto.contactPhone : undefined,
        };

        const newContact = await this.prisma.contact.create({
          data: contactData,
        });
        contactId = newContact.id;
      }
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId,
        title: createTicketDto.title || 'Sem Assunto',
        status: 'OPEN',
        priority: createTicketDto.priority || 'MEDIUM',
        channel: createTicketDto.channel || 'WHATSAPP',
        contactId,
        queue: createTicketDto.queue || 'DEFAULT',
        assigneeId: createTicketDto.assigneeId || userId,
      },
    });

    if (createTicketDto.description) {
      await this.prisma.ticketMessage.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          contactId: contactId || null,
          channel: createTicketDto.channel || 'WHATSAPP',
          direction: 'OUTBOUND',
          senderType: 'USER',
          senderId: userId,
          content: createTicketDto.description,
          textContent: createTicketDto.description,
          contentType: 'TEXT',
          sentAt: new Date(),
        },
      });
    }

    const fullTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketCreated(tenantId, fullTicket);

    return ticket;
  }

  async findAll(tenantId: string, filters?: { status?: string; queue?: string; assigneeId?: string }) {
    const where: any = { tenantId };

    if (filters?.status) where.status = filters.status;
    if (filters?.queue) where.queue = filters.queue;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;

    return this.prisma.ticket.findMany({
      where,
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true },
        },
        _count: {
          select: { messages: true },
        },
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
      mediaUrl = file.path.replace(/\\/g, '/');
      const isAudio = file.mimetype.startsWith('audio/') || file.mimetype.includes('webm');
      if (file.mimetype.startsWith('image/')) contentType = 'IMAGE';
      else if (isAudio) contentType = 'AUDIO';
      else contentType = 'FILE';
    }

    const scheduledAt = createMessageDto.scheduledAt ? new Date(createMessageDto.scheduledAt) : null;
    const isScheduled = scheduledAt && scheduledAt > new Date();
    const metadata = this.buildMessageMetadata(createMessageDto.connectionId, file);

    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        connectionId: createMessageDto.connectionId || null,
        channel: ticket.channel,
        direction: 'OUTBOUND',
        senderType: 'USER',
        senderId: userId,
        content: createMessageDto.content || '',
        textContent: createMessageDto.content || '',
        contentType: contentType as any,
        mediaUrl,
        scheduledAt: isScheduled ? scheduledAt : null,
        status: isScheduled ? 'SCHEDULED' : 'PENDING',
        quotedId: createMessageDto.quotedId,
        metadata,
      } as any,
    });

    await this.captureTicketMessageForAgent(ticket, message, 'OUTBOUND', 'operator');

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        waitingReply: false,
      } as any,
    });

    if (!isScheduled) {
      if (ticket.channel === 'WHATSAPP') {
        await this.sendToWhatsApp(tenantId, ticket, message, file, createMessageDto.connectionId);
      }

      if (ticket.channel === 'TELEGRAM') {
        await this.sendToTelegram(tenantId, ticket, message, file, createMessageDto.connectionId);
      }
    }

    this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

    const updatedTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketUpdated(tenantId, updatedTicket);

    return message;
  }

  async updateTicket(id: string, updateData: any, tenantId: string) {
    await this.findOne(id, tenantId);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true } },
        _count: { select: { messages: true } },
      },
    });

    this.ticketsGateway.emitTicketUpdated(tenantId, updated);

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.ticket.delete({
      where: { id },
    });

    return { success: true };
  }

  async simulateIncomingMessage(
    id: string,
    content: string,
    tenantId: string,
    options?: {
      contentType?: string;
      mediaUrl?: string | null;
      externalId?: string | null;
      metadata?: Record<string, any>;
    },
  ) {
    const ticket = await this.findOne(id, tenantId);

    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        channel: ticket.channel,
        direction: 'INBOUND',
        senderType: 'CONTACT',
        senderId: ticket.contactId,
        content,
        textContent: content,
        contentType: options?.contentType || 'TEXT',
        mediaUrl: options?.mediaUrl || null,
        externalId: options?.externalId || null,
        externalThreadId: options?.metadata?.externalThreadId || null,
        externalParticipantId: options?.metadata?.senderAddress || null,
        metadata: options?.metadata,
        deliveredAt: new Date(),
        status: 'DELIVERED',
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        waitingReply: true,
      } as any,
    });

    await this.captureTicketMessageForAgent(ticket, message, 'INBOUND', 'contact');

    this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

    const updatedTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketUpdated(tenantId, updatedTicket);

    return message;
  }

  async createSystemMessage(
    ticketId: string,
    tenantId: string,
    payload: {
      content: string;
      contentType?: string;
      mediaUrl?: string | null;
      externalId?: string | null;
      metadata?: Record<string, any>;
      status?: string;
    },
  ) {
    const ticket = await this.findOne(ticketId, tenantId);
    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        channel: ticket.channel,
        direction: 'OUTBOUND',
        senderType: 'SYSTEM',
        senderId: null,
        content: payload.content || '',
        textContent: payload.content || '',
        contentType: payload.contentType || 'TEXT',
        mediaUrl: payload.mediaUrl || null,
        externalId: payload.externalId || null,
        metadata: payload.metadata,
        status: payload.status || 'SENT',
        sentAt: (payload.status || 'SENT') === 'SENT' ? new Date() : null,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        waitingReply: false,
      } as any,
    });

    await this.captureTicketMessageForAgent(ticket, message, 'OUTBOUND', 'assistant');
    this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

    const updatedTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, whatsappFullId: true, whatsappE164: true, category: true } },
        _count: { select: { messages: true } },
      },
    });
    this.ticketsGateway.emitTicketUpdated(tenantId, updatedTicket);

    return message;
  }

  async deleteMessage(messageId: string, tenantId: string, userId: string) {
    const message = await this.prisma.ticketMessage.findFirst({
      where: { id: messageId, ticket: { tenantId } },
      include: { ticket: { include: { contact: true } } },
    });

    if (!message) throw new NotFoundException('Mensagem nao encontrada');

    if (message.ticket.channel === 'WHATSAPP') {
      try {
        const messageMetadata = this.asMetadataObject(message.metadata);
        const connection = await this.resolveWhatsappConnection(tenantId, message.ticket, messageMetadata.connectionId);

        if (connection && message.externalId) {
          const phone = message.ticket.contact?.whatsapp || message.ticket.contact?.phone;
          await this.whatsappService.deleteMessage(connection.id, phone, message.externalId, true);
          this.logger.log(`Remote delete executed for message ${messageId}`);
        } else if (!message.externalId) {
          this.logger.warn(`Skipping remote delete for message ${messageId} as externalId is missing.`);
        }
      } catch (error) {
        this.logger.error(`Failed to delete WhatsApp message: ${error.message}`);
      }
    }

    await this.prisma.ticketMessage.delete({
      where: { id: messageId },
    });

    this.ticketsGateway.emitMessageDeleted(tenantId, message.ticketId, messageId);

    return { success: true };
  }

  async markAsRead(ticketId: string, tenantId: string) {
    const ticket = await this.findOne(ticketId, tenantId);

    const unreadMessages = await this.prisma.ticketMessage.findMany({
      where: { ticketId, status: { not: 'READ' }, senderType: 'CONTACT', externalId: { not: null } },
    });

    if (unreadMessages.length === 0) return;

    await this.prisma.ticketMessage.updateMany({
      where: { id: { in: unreadMessages.map((message) => message.id) } },
      data: { status: 'READ', readAt: new Date() },
    });

    try {
      const preferredConnectionId = unreadMessages
        .map((message) => this.asMetadataObject(message.metadata).connectionId)
        .find((value) => typeof value === 'string' && value.trim().length > 0);
      const connection = await this.resolveWhatsappConnection(tenantId, ticket, preferredConnectionId);

      if (connection) {
        const rawJid = ticket.contact?.whatsapp || ticket.contact?.phone;
        if (rawJid && this.whatsappService.markRead) {
          await this.whatsappService.markRead(connection.id, rawJid, unreadMessages.map((message) => message.externalId!));
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to sync read status with WhatsApp: ${error.message}`);
    }

    this.ticketsGateway.emitTicketUpdated(tenantId, { ...ticket, _count: { messages: 0 } });
  }

  private async sendToWhatsApp(
    tenantId: string,
    ticket: any,
    message: any,
    file?: Express.Multer.File,
    preferredConnectionId?: string | null,
  ) {
    const rawPhone = ticket.contact?.whatsappFullId || ticket.contact?.whatsapp || ticket.contact?.phone;
    if (!rawPhone) {
      this.ticketsGateway.emitTicketError(tenantId, {
        ticketId: ticket.id,
        message: 'Contato sem telefone/WhatsApp cadastrado.',
        code: 'NO_PHONE',
      });
      return;
    }

    let formattedPhone = rawPhone;
    if (!rawPhone.includes('@g.us') && !rawPhone.includes('@lid') && !rawPhone.includes('@s.whatsapp.net')) {
      const basePhone = rawPhone.split('@')[0].split(':')[0];
      formattedPhone = this.formatNumber(basePhone);
    }

    try {
      const connection = await this.resolveWhatsappConnection(tenantId, ticket, preferredConnectionId);

      if (!connection) {
        this.logger.warn(`No active connection for tenant ${tenantId}`);
        this.ticketsGateway.emitTicketError(tenantId, {
          ticketId: ticket.id,
          message: 'Nenhuma conexao WhatsApp ativa no momento.',
          code: 'NO_CONNECTION',
        });
        return;
      }

      let externalId: string | undefined;
      const currentMetadata = this.asMetadataObject(message.metadata);
      const nextMetadata = this.buildMessageMetadata(connection.id, file, currentMetadata);
      const mimeType = file?.mimetype || currentMetadata.mimeType;
      const fileName = file?.originalname || currentMetadata.fileName;

      this.logger.log(`Attempting to send to WhatsApp via connection ${connection.id} to phone ${formattedPhone}`);

      if (message.contentType === 'TEXT') {
        externalId = await this.whatsappService.sendText(
          connection.id,
          formattedPhone,
          message.textContent || message.content,
        );
      } else {
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (message.contentType === 'IMAGE') mediaType = 'image';
        else if (message.contentType === 'AUDIO') mediaType = 'audio';

        externalId = await this.whatsappService.sendMedia(
          connection.id,
          formattedPhone,
          mediaType,
          message.mediaUrl,
          message.textContent || message.content || '',
          mimeType,
          fileName,
        );
      }

      this.logger.log(`WhatsApp API responded with externalId: ${typeof externalId} - ${externalId}`);

      if (externalId && typeof externalId === 'string') {
        await this.prisma.ticketMessage.update({
          where: { id: message.id },
          data: {
            externalId,
            status: 'SENT',
            metadata: nextMetadata,
            connectionId: connection.id,
            channel: 'WHATSAPP',
            externalThreadId: formattedPhone,
            externalParticipantId: formattedPhone,
            sentAt: new Date(),
          },
        });
        this.ticketsGateway.emitMessageStatus(tenantId, ticket.id, message.id, 'SENT');
      } else {
        this.logger.warn('Message sent but no valid externalId returned. Setting status to SENT anyway.');
        await this.prisma.ticketMessage.update({
          where: { id: message.id },
          data: {
            status: 'SENT',
            metadata: nextMetadata,
            connectionId: connection.id,
            channel: 'WHATSAPP',
            externalThreadId: formattedPhone,
            externalParticipantId: formattedPhone,
            sentAt: new Date(),
          },
        });
        this.ticketsGateway.emitMessageStatus(tenantId, ticket.id, message.id, 'SENT');
      }

      this.logger.log(`WhatsApp message sent to ${formattedPhone}`);
    } catch (error) {
      this.logger.error(`WhatsApp Send Error: ${error.message}`);
      this.logger.error(`Full error details: ${JSON.stringify(error?.response?.data || error)}`);

      await this.prisma.ticketMessage
        .update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        })
        .catch((updateError) => this.logger.error(`Failed to mark message as FAILED: ${updateError.message}`));

      this.ticketsGateway.emitTicketError(tenantId, {
        ticketId: ticket.id,
        message: `Falha no envio: ${error.message}`,
        code: 'SEND_ERROR',
      });
    }
  }

  private async sendToTelegram(
    tenantId: string,
    ticket: any,
    message: any,
    file?: Express.Multer.File,
    preferredConnectionId?: string | null,
  ) {
    const currentMetadata = this.asMetadataObject(message.metadata);
    const chatId =
      currentMetadata.externalThreadId
      || currentMetadata.senderAddress
      || currentMetadata.telegramChatId
      || ticket.contact?.metadata?.telegramChatId
      || null;

    if (!chatId) {
      this.ticketsGateway.emitTicketError(tenantId, {
        ticketId: ticket.id,
        message: 'Contato sem chat do Telegram cadastrado.',
        code: 'NO_TELEGRAM_CHAT',
      });
      return;
    }

    try {
      const connection = await this.resolveTelegramConnection(tenantId, ticket, preferredConnectionId);

      if (!connection) {
        this.logger.warn(`No active Telegram connection for tenant ${tenantId}`);
        this.ticketsGateway.emitTicketError(tenantId, {
          ticketId: ticket.id,
          message: 'Nenhuma conexao Telegram ativa no momento.',
          code: 'NO_CONNECTION',
        });
        return;
      }

      const sent = await this.telegramService.sendOutboundMessage({
        connectionId: connection.id,
        chatId: String(chatId),
        text: message.textContent || message.content || '',
        contentType: message.contentType || 'TEXT',
        mediaPath: message.mediaUrl || undefined,
        mimeType: file?.mimetype || currentMetadata.mimeType || undefined,
        fileName: file?.originalname || currentMetadata.fileName || undefined,
      });

      const nextMetadata = this.buildMessageMetadata(connection.id, file, {
        ...currentMetadata,
        externalThreadId: String(chatId),
        senderAddress: String(chatId),
        telegramChatId: String(chatId),
        telegramMessageIds: sent.messageIds || [],
      });

      await this.prisma.ticketMessage.update({
        where: { id: message.id },
        data: {
          externalId: sent.externalMessageId || null,
          status: 'SENT',
          metadata: nextMetadata,
          connectionId: connection.id,
          channel: 'TELEGRAM',
          externalThreadId: String(chatId),
          externalParticipantId: String(chatId),
          sentAt: new Date(),
        },
      });
      this.ticketsGateway.emitMessageStatus(tenantId, ticket.id, message.id, 'SENT');
    } catch (error: any) {
      this.logger.error(`Telegram Send Error: ${error?.message || error}`);

      await this.prisma.ticketMessage
        .update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        })
        .catch((updateError) => this.logger.error(`Failed to mark Telegram message as FAILED: ${updateError.message}`));

      this.ticketsGateway.emitTicketError(tenantId, {
        ticketId: ticket.id,
        message: `Falha no envio Telegram: ${error?.message || 'erro desconhecido'}`,
        code: 'SEND_ERROR',
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledMessages() {
    const now = new Date();
    const scheduledMessages = await this.prisma.ticketMessage.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      } as any,
      include: {
        ticket: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (scheduledMessages.length > 0) {
      this.logger.log(`Processing ${scheduledMessages.length} scheduled messages...`);
      for (const scheduledMessage of scheduledMessages as any[]) {
        const preferredConnectionId = this.asMetadataObject(scheduledMessage.metadata).connectionId;
        if (scheduledMessage.ticket.channel === 'WHATSAPP') {
          await this.sendToWhatsApp(
            scheduledMessage.ticket.tenantId,
            scheduledMessage.ticket,
            scheduledMessage,
            undefined,
            preferredConnectionId,
          );
        }

        if (scheduledMessage.ticket.channel === 'TELEGRAM') {
          await this.sendToTelegram(
            scheduledMessage.ticket.tenantId,
            scheduledMessage.ticket,
            scheduledMessage,
            undefined,
            preferredConnectionId,
          );
        }
      }
    }
  }
}
