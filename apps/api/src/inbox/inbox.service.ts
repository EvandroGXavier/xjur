import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InboxGateway } from './inbox.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CreateInboxMessageDto } from './dto/create-inbox-message.dto';
import { LinkMessageProcessDto } from './dto/link-message-process.dto';
import { TelegramService } from '../telegram/telegram.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

type CaptureExternalMessageInput = {
  tenantId: string;
  channel: string;
  contactId?: string | null;
  connectionId?: string | null;
  processId?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  externalParticipantId?: string | null;
  direction?: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  role?: string;
  content?: string;
  contentType?: string | null;
  mediaUrl?: string | null;
  status?: string | null;
  title?: string | null;
  senderName?: string | null;
  senderAddress?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
};

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inboxGateway: InboxGateway,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  private summaryInclude() {
    return {
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          whatsapp: true,
          email: true,
          profilePicUrl: true,
          category: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
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
      process: {
        select: {
          id: true,
          title: true,
          code: true,
          cnj: true,
          status: true,
        },
      },
      messages: {
        take: 1,
        orderBy: {
          createdAt: 'desc' as const,
        },
        include: {
          participant: {
            select: {
              id: true,
              role: true,
              label: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              contact: {
                select: {
                  id: true,
                  name: true,
                  profilePicUrl: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private detailsInclude() {
    return {
      ...this.summaryInclude(),
      participants: {
        orderBy: {
          joinedAt: 'asc' as const,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              whatsapp: true,
              email: true,
              profilePicUrl: true,
              category: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: 'asc' as const,
        },
        include: {
          participant: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              contact: {
                select: {
                  id: true,
                  name: true,
                  profilePicUrl: true,
                },
              },
            },
          },
          links: {
            include: {
              process: {
                select: {
                  id: true,
                  title: true,
                  code: true,
                  cnj: true,
                },
              },
              timeline: {
                select: {
                  id: true,
                  title: true,
                  date: true,
                  type: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private asObject(metadata: Record<string, any> | null | undefined) {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  }

  private normalizeChannel(channel: string) {
    return (channel || 'WEBCHAT').trim().toUpperCase();
  }

  private normalizeDirection(direction?: string) {
    if (direction === 'OUTBOUND' || direction === 'INTERNAL') return direction;
    return 'INBOUND';
  }

  private normalizeStatus(status?: string | null, direction?: string) {
    if (status?.trim()) return status.trim().toUpperCase();
    return this.normalizeDirection(direction) === 'INBOUND' ? 'DELIVERED' : 'SENT';
  }

  private buildPreview(content?: string | null, contentType?: string | null) {
    const trimmed = (content || '').trim();
    if (trimmed.length > 0) {
      return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
    }

    const fallbackType = (contentType || 'TEXT').toUpperCase();
    return fallbackType === 'TEXT' ? 'Mensagem sem texto' : `[${fallbackType}]`;
  }

  private detectContentType(file?: Express.Multer.File, requestedType?: string | null) {
    if (requestedType?.trim()) return requestedType.trim().toUpperCase();
    if (!file) return 'TEXT';
    if (file.mimetype.startsWith('image/')) return 'IMAGE';
    if (file.mimetype.startsWith('audio/')) return 'AUDIO';
    if (file.mimetype.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }

  private buildMediaPath(file?: Express.Multer.File) {
    return file?.path ? file.path.replace(/\\/g, '/') : null;
  }

  private extractResolvedWhatsappPhone(conversation?: any) {
    const metadata = this.asObject(conversation?.metadata as Record<string, any>);
    const resolvedPhone = typeof metadata.resolvedPhone === 'string' ? metadata.resolvedPhone.replace(/\D/g, '') : '';
    return /^\d{10,15}$/.test(resolvedPhone) ? resolvedPhone : null;
  }

  private async loadConversationSummary(id: string) {
    return this.prisma.agentConversation.findUnique({
      where: { id },
      include: this.summaryInclude(),
    });
  }

  private async loadConversationDetails(id: string) {
    return this.prisma.agentConversation.findUnique({
      where: { id },
      include: this.detailsInclude(),
    });
  }

  private async getConversationOrThrow(id: string, tenantId: string) {
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id, tenantId },
      include: this.detailsInclude(),
    });

    if (!conversation) {
      throw new NotFoundException('Conversa nao encontrada');
    }

    return conversation;
  }

  private async ensureConversationParticipant(params: {
    tenantId: string;
    conversationId: string;
    userId?: string | null;
    contactId?: string | null;
    role: string;
    label?: string | null;
    externalAddress?: string | null;
    isPrimary?: boolean;
  }) {
    const where: any = {
      conversationId: params.conversationId,
    };

    if (params.userId) {
      where.userId = params.userId;
    } else if (params.contactId) {
      where.contactId = params.contactId;
    } else if (params.externalAddress) {
      where.externalAddress = params.externalAddress;
    } else {
      return null;
    }

    const existing = await this.prisma.agentParticipant.findFirst({ where });
    if (existing) return existing;

    return this.prisma.agentParticipant.create({
      data: {
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        userId: params.userId || null,
        contactId: params.contactId || null,
        role: params.role,
        label: params.label || null,
        externalAddress: params.externalAddress || null,
        isPrimary: params.isPrimary ?? false,
      },
    });
  }

  private async resolveConnectedWhatsappConnection(
    tenantId: string,
    conversation: { connectionId?: string | null },
    preferredConnectionId?: string | null,
  ) {
    const connectionId = preferredConnectionId?.trim() || conversation.connectionId?.trim();
    if (connectionId) {
      const selected = await this.prisma.connection.findFirst({
        where: {
          id: connectionId,
          tenantId,
          type: 'WHATSAPP',
          status: 'CONNECTED',
        },
      });

      if (!selected) {
        throw new BadRequestException('A conexao WhatsApp selecionada nao esta conectada.');
      }

      return selected;
    }

    const connections = await this.prisma.connection.findMany({
      where: {
        tenantId,
        type: 'WHATSAPP',
        status: 'CONNECTED',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (connections.length === 0) {
      throw new BadRequestException('Nenhuma conexao WhatsApp ativa no momento.');
    }

    if (connections.length > 1) {
      throw new BadRequestException(
        'Ha mais de uma conexao WhatsApp ativa. Escolha qual instancia deve enviar.',
      );
    }

    return connections[0];
  }

  private async resolveConnectedTelegramConnection(
    tenantId: string,
    conversation: { connectionId?: string | null },
    preferredConnectionId?: string | null,
  ) {
    const connectionId = preferredConnectionId?.trim() || conversation.connectionId?.trim();
    if (connectionId) {
      const selected = await this.prisma.connection.findFirst({
        where: {
          id: connectionId,
          tenantId,
          type: 'TELEGRAM',
          status: 'CONNECTED',
        },
      });

      if (!selected) {
        throw new BadRequestException('A conexao Telegram selecionada nao esta conectada.');
      }

      return selected;
    }

    const connections = await this.prisma.connection.findMany({
      where: {
        tenantId,
        type: 'TELEGRAM',
        status: 'CONNECTED',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (connections.length === 0) {
      throw new BadRequestException('Nenhuma conexao Telegram ativa no momento.');
    }

    if (connections.length > 1) {
      throw new BadRequestException(
        'Ha mais de uma conexao Telegram ativa. Escolha qual bot deve enviar.',
      );
    }

    return connections[0];
  }

  private resolveExternalAddress(channel: string, contact?: any, conversation?: any) {
    const normalizedChannel = this.normalizeChannel(channel);

    if (normalizedChannel === 'WHATSAPP') {
      const resolvedPhone = this.extractResolvedWhatsappPhone(conversation);
      const candidates = [
        resolvedPhone,
        contact?.whatsapp,
        contact?.phone,
        conversation?.externalParticipantId,
        conversation?.externalThreadId,
      ].filter(Boolean);

      const preferred = candidates.find(
        (candidate) => typeof candidate === 'string' && !candidate.includes('@lid'),
      );

      return preferred || candidates[0] || null;
    }

    if (conversation?.externalThreadId) return conversation.externalThreadId;
    if (conversation?.externalParticipantId) return conversation.externalParticipantId;

    if (normalizedChannel === 'EMAIL') {
      return contact?.email || null;
    }

    return contact?.phone || contact?.email || null;
  }

  private mapConversationStatusToTicketStatus(status: string, waitingReply: boolean) {
    const normalized = (status || 'OPEN').toUpperCase();
    if (normalized === 'CLOSED') return 'CLOSED';
    if (normalized === 'RESOLVED') return 'RESOLVED';
    if (waitingReply) return 'WAITING';
    return normalized === 'WAITING' ? 'WAITING' : 'IN_PROGRESS';
  }

  private mapDirectionToSenderType(direction: string, role: string) {
    if (direction === 'INBOUND') return 'CONTACT';
    if (role === 'assistant' || role === 'system') return 'SYSTEM';
    return 'USER';
  }

  private normalizeTicketContentType(contentType: string) {
    const normalized = (contentType || 'TEXT').toUpperCase();
    if (normalized === 'VIDEO' || normalized === 'DOCUMENT') return 'FILE';
    return normalized;
  }

  private async syncLegacyTicketProjection(conversation: any) {
    if (conversation.isInternal) return null;

    const ticketData: any = {
      tenantId: conversation.tenantId,
      title: conversation.title || `Atendimento ${conversation.channel}`,
      status: this.mapConversationStatusToTicketStatus(conversation.status, conversation.waitingReply),
      priority: conversation.priority || 'MEDIUM',
      channel: conversation.channel,
      contactId: conversation.contactId || null,
      assigneeId: conversation.assignedUserId || null,
      queue: conversation.queue || null,
      waitingReply: conversation.waitingReply,
      lastMessageAt: conversation.lastMessageAt || new Date(),
    };

    let ticketId = conversation.ticketId;
    if (!ticketId) {
      const created = await this.prisma.ticket.create({ data: ticketData });
      ticketId = created.id;
      await this.prisma.agentConversation.update({
        where: { id: conversation.id },
        data: { ticketId },
      });
    } else {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: ticketData,
      });
    }

    return this.prisma.ticket.findUnique({ where: { id: ticketId } });
  }

  private async mirrorMessageToLegacyTicket(conversationId: string, messageId: string) {
    const message = await this.prisma.agentMessage.findUnique({
      where: { id: messageId },
      include: {
        participant: true,
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!message || message.conversation.isInternal) return null;

    if (message.ticketMessageId) {
      return this.prisma.ticketMessage.findUnique({
        where: { id: message.ticketMessageId },
      });
    }

    const ticket = await this.syncLegacyTicketProjection(message.conversation);
    if (!ticket) return null;

    const existingByExternalId = message.externalMessageId
      ? await this.prisma.ticketMessage.findFirst({
          where: {
            ticketId: ticket.id,
            externalId: message.externalMessageId,
          },
        })
      : null;

    if (existingByExternalId) {
      await this.prisma.agentMessage.update({
        where: { id: message.id },
        data: { ticketMessageId: existingByExternalId.id },
      });
      return existingByExternalId;
    }

    const legacyMessage = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        externalId: message.externalMessageId || null,
        status: message.status || this.normalizeStatus(message.status, message.direction),
        senderType: this.mapDirectionToSenderType(message.direction, message.role),
        senderId: message.participant?.userId || message.participant?.contactId || null,
        content: message.content || '',
        contentType: this.normalizeTicketContentType(message.contentType),
        mediaUrl: message.mediaUrl || null,
        metadata: this.asObject(message.metadata as Record<string, any>),
      },
    });

    await this.prisma.agentMessage.update({
      where: { id: message.id },
      data: { ticketMessageId: legacyMessage.id },
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: message.createdAt,
        waitingReply: message.direction === 'INBOUND',
      } as any,
    });

    return legacyMessage;
  }

  private async appendMessageEvent(
    tenantId: string,
    messageId: string,
    type: string,
    payload?: Record<string, any> | null,
  ) {
    return this.prisma.agentMessageEvent.create({
      data: {
        tenantId,
        messageId,
        type,
        payload: this.asObject(payload),
      },
    });
  }

  private async findExistingConversation(input: CaptureExternalMessageInput) {
    const channel = this.normalizeChannel(input.channel);
    const connectionFilter = input.connectionId?.trim()
      ? { connectionId: input.connectionId.trim() }
      : {};

    if (input.externalThreadId?.trim()) {
      const byThread = await this.prisma.agentConversation.findFirst({
        where: {
          tenantId: input.tenantId,
          channel,
          externalThreadId: input.externalThreadId.trim(),
          ...connectionFilter,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (byThread) return byThread;
    }

    if (input.contactId) {
      const byContact = await this.prisma.agentConversation.findFirst({
        where: {
          tenantId: input.tenantId,
          channel,
          contactId: input.contactId,
          ...connectionFilter,
          status: {
            notIn: ['CLOSED', 'ARCHIVED'],
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (byContact) return byContact;
    }

    return null;
  }

  private async ensureConversationForCapture(input: CaptureExternalMessageInput) {
    const channel = this.normalizeChannel(input.channel);
    const existing = await this.findExistingConversation(input);
    const preview = this.buildPreview(input.content, input.contentType);

    if (existing) {
      return this.prisma.agentConversation.update({
        where: { id: existing.id },
        data: {
          title: input.title ?? existing.title,
          contactId: input.contactId ?? existing.contactId,
          connectionId: input.connectionId ?? existing.connectionId,
          processId: input.processId ?? existing.processId,
          externalThreadId: input.externalThreadId ?? existing.externalThreadId,
          externalParticipantId: input.externalParticipantId ?? existing.externalParticipantId,
          status:
            this.normalizeDirection(input.direction) === 'INBOUND' && existing.status === 'CLOSED'
              ? 'OPEN'
              : existing.status,
          waitingReply: this.normalizeDirection(input.direction) === 'INBOUND',
          unreadCount:
            this.normalizeDirection(input.direction) === 'INBOUND'
              ? (existing.unreadCount || 0) + 1
              : existing.unreadCount || 0,
          lastMessagePreview: preview,
          lastMessageAt: input.createdAt || new Date(),
          metadata: {
            ...this.asObject(existing.metadata as Record<string, any>),
            ...this.asObject(input.metadata),
          },
        },
      });
    }

    return this.prisma.agentConversation.create({
      data: {
        tenantId: input.tenantId,
        channel,
        contactId: input.contactId || null,
        connectionId: input.connectionId || null,
        processId: input.processId || null,
        kind: 'DIRECT',
        status: 'OPEN',
        priority: 'MEDIUM',
        source: 'CHANNEL',
        isInternal: this.normalizeDirection(input.direction) === 'INTERNAL',
        title: input.title || null,
        externalThreadId: input.externalThreadId || null,
        externalParticipantId: input.externalParticipantId || null,
        waitingReply: this.normalizeDirection(input.direction) === 'INBOUND',
        unreadCount: this.normalizeDirection(input.direction) === 'INBOUND' ? 1 : 0,
        lastMessagePreview: preview,
        lastMessageAt: input.createdAt || new Date(),
        metadata: this.asObject(input.metadata),
      },
    });
  }

  async findAllConversations(
    tenantId: string,
    filters?: { status?: string; channel?: string; search?: string },
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.status) {
      where.status = filters.status;
    } else {
      where.status = {
        not: 'ARCHIVED',
      };
    }

    if (filters?.channel) {
      where.channel = this.normalizeChannel(filters.channel);
    }

    if (filters?.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { externalParticipantId: { contains: search, mode: 'insensitive' } },
        { contact: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { contact: { is: { whatsapp: { contains: search } } } },
        { contact: { is: { phone: { contains: search } } } },
        { process: { is: { cnj: { contains: search } } } },
        { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    return this.prisma.agentConversation.findMany({
      where,
      include: this.summaryInclude(),
      orderBy: [{ waitingReply: 'desc' }, { lastMessageAt: 'desc' }],
      take: 200,
    });
  }

  async findConversation(id: string, tenantId: string) {
    return this.getConversationOrThrow(id, tenantId);
  }

  async createConversation(tenantId: string, userId: string, dto: CreateConversationDto) {
    const channel = this.normalizeChannel(dto.channel);
    const contact = dto.contactId
      ? await this.prisma.contact.findFirst({
          where: {
            id: dto.contactId,
            tenantId,
          },
        })
      : null;

    if (dto.contactId && !contact) {
      throw new BadRequestException('Contato nao encontrado para iniciar o atendimento.');
    }

    const externalThreadId =
      dto.externalThreadId ||
      this.resolveExternalAddress(channel, contact, {
        externalThreadId: dto.externalThreadId,
        externalParticipantId: dto.externalParticipantId,
      });

    const conversation = await this.prisma.agentConversation.create({
      data: {
        tenantId,
        channel,
        contactId: dto.contactId || null,
        connectionId: dto.connectionId || null,
        processId: dto.processId || null,
        assignedUserId: dto.assignedUserId || userId,
        kind: dto.isInternal ? 'INTERNAL' : 'DIRECT',
        status: 'OPEN',
        priority: (dto.priority || 'MEDIUM').toUpperCase(),
        queue: dto.queue || null,
        source: 'MANUAL',
        isInternal: !!dto.isInternal,
        title: dto.title || contact?.name || `Atendimento ${channel}`,
        externalThreadId: externalThreadId || null,
        externalParticipantId: dto.externalParticipantId || externalThreadId || null,
        waitingReply: false,
        unreadCount: 0,
        lastMessagePreview: null,
      },
    });

    if (contact) {
      await this.ensureConversationParticipant({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        role: 'CONTACT',
        label: contact.name,
        externalAddress: externalThreadId || null,
        isPrimary: true,
      });
    }

    await this.ensureConversationParticipant({
      tenantId,
      conversationId: conversation.id,
      userId: dto.assignedUserId || userId,
      role: conversation.isInternal ? 'MEMBER' : 'OPERATOR',
      isPrimary: !contact,
    });

    const syncedTicket = await this.syncLegacyTicketProjection(conversation);
    const hydratedConversation = await this.prisma.agentConversation.update({
      where: { id: conversation.id },
      data: syncedTicket ? { ticketId: syncedTicket.id } : {},
    });

    if (dto.initialMessage?.trim()) {
      await this.sendMessage(
        hydratedConversation.id,
        tenantId,
        userId,
        {
          content: dto.initialMessage.trim(),
          connectionId: dto.connectionId || undefined,
        },
      );
    }

    const payload = await this.loadConversationDetails(hydratedConversation.id);
    this.inboxGateway.emitConversationCreated(tenantId, payload);
    return payload;
  }

  async updateConversation(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdateConversationDto,
  ) {
    await this.getConversationOrThrow(id, tenantId);

    const normalizedStatus = dto.status?.trim().toUpperCase();
    const updated = await this.prisma.agentConversation.update({
      where: { id },
      data: {
        status: normalizedStatus || undefined,
        priority: dto.priority?.trim().toUpperCase() || undefined,
        queue: dto.queue !== undefined ? dto.queue : undefined,
        title: dto.title !== undefined ? dto.title : undefined,
        assignedUserId: dto.assignedUserId !== undefined ? dto.assignedUserId : undefined,
        processId: dto.processId !== undefined ? dto.processId : undefined,
        waitingReply: dto.waitingReply !== undefined ? dto.waitingReply : undefined,
        unreadCount: typeof dto.unreadCount === 'number' ? dto.unreadCount : undefined,
        closedAt:
          normalizedStatus === 'CLOSED'
            ? new Date()
            : normalizedStatus && normalizedStatus !== 'CLOSED'
              ? null
              : undefined,
      },
    });

    if (dto.assignedUserId) {
      await this.ensureConversationParticipant({
        tenantId,
        conversationId: id,
        userId: dto.assignedUserId,
        role: updated.isInternal ? 'MEMBER' : 'OPERATOR',
      });
    }

    await this.syncLegacyTicketProjection(updated);
    const payload = await this.loadConversationDetails(id);
    this.inboxGateway.emitConversationUpdated(tenantId, payload);
    return payload;
  }

  async deleteConversation(id: string, tenantId: string) {
    const conversation = await this.getConversationOrThrow(id, tenantId);

    if (conversation.ticketId) {
      const linkedConversations = await this.prisma.agentConversation.count({
        where: {
          ticketId: conversation.ticketId,
          id: {
            not: id,
          },
        },
      });

      if (linkedConversations === 0) {
        await this.prisma.ticket.delete({
          where: {
            id: conversation.ticketId,
          },
        });
      }
    }

    await this.prisma.agentConversation.delete({
      where: { id },
    });

    return {
      id,
      deleted: true,
    };
  }

  async sendMessage(
    conversationId: string,
    tenantId: string,
    userId: string,
    dto: CreateInboxMessageDto,
    file?: Express.Multer.File,
  ) {
    const conversation = await this.getConversationOrThrow(conversationId, tenantId);
    const content = (dto.content || '').trim();
    const mediaUrl = dto.mediaUrl || this.buildMediaPath(file);
    const contentType = this.detectContentType(file, dto.contentType);

    if (!content && !mediaUrl) {
      this.logger.warn(
        `Rejecting empty inbox message conversation=${conversationId} tenant=${tenantId} user=${userId} dtoKeys=${
          Object.keys(dto || {}).join(',') || 'none'
        } contentLength=${(dto?.content || '').length} mediaUrl=${mediaUrl ? 'yes' : 'no'} file=${
          file?.originalname || 'none'
        } requestedContentType=${dto.contentType || 'none'} channel=${conversation.channel}`,
      );
      throw new BadRequestException('Mensagem vazia.');
    }

    const participant = await this.ensureConversationParticipant({
      tenantId,
      conversationId,
      userId,
      role: conversation.isInternal ? 'MEMBER' : 'OPERATOR',
    });

    const message = await this.prisma.agentMessage.create({
      data: {
        conversationId,
        tenantId,
        participantId: participant?.id || null,
        direction: conversation.isInternal ? 'INTERNAL' : 'OUTBOUND',
        role: conversation.isInternal ? 'member' : 'operator',
        content,
        contentType,
        status: conversation.isInternal ? 'SENT' : 'PENDING',
        senderAddress: conversation.externalThreadId || conversation.externalParticipantId || null,
        mediaUrl: mediaUrl || null,
        metadata: {
          quotedId: dto.quotedId || null,
          connectionId: dto.connectionId || conversation.connectionId || null,
          fileName: file?.originalname || null,
          mimeType: file?.mimetype || null,
          fileSize: file?.size || null,
        },
      },
    });

    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        waitingReply: false,
        unreadCount: 0,
        lastMessagePreview: this.buildPreview(content, contentType),
        lastMessageAt: new Date(),
        status: conversation.status === 'CLOSED' ? 'OPEN' : conversation.status,
      },
    });

    await this.appendMessageEvent(tenantId, message.id, 'OUTBOX_QUEUED', {
      connectionId: dto.connectionId || conversation.connectionId || null,
      quotedId: dto.quotedId || null,
    });

    let finalMessage = message;
    let updatedConversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation.isInternal && conversation.channel === 'WHATSAPP') {
      const resolvedPhone = this.extractResolvedWhatsappPhone(conversation);
      if (
        resolvedPhone &&
        conversation.contact?.id &&
        (!conversation.contact.whatsapp || String(conversation.contact.whatsapp).includes('@lid'))
      ) {
        await this.prisma.contact.update({
          where: { id: conversation.contact.id },
          data: {
            whatsapp: resolvedPhone,
          },
        });
        conversation.contact = {
          ...conversation.contact,
          whatsapp: resolvedPhone,
        };
      }

      const connection = await this.resolveConnectedWhatsappConnection(
        tenantId,
        conversation,
        dto.connectionId || null,
      );

      const destination = this.resolveExternalAddress(conversation.channel, conversation.contact, conversation);
      if (!destination || String(destination).includes('@lid')) {
        throw new BadRequestException('O contato nao possui endereco valido para envio no WhatsApp.');
      }

      try {
        this.logger.log(
          `Sending WhatsApp message conversation=${conversationId} connection=${connection.id} destination=${destination} contentType=${contentType} contentLength=${content.length} hasMedia=${Boolean(
            mediaUrl,
          )}`,
        );
        const externalMessageId =
          contentType === 'TEXT'
            ? await this.whatsappService.sendText(connection.id, destination, content)
            : await this.whatsappService.sendMedia(
                connection.id,
                destination,
                contentType === 'IMAGE'
                  ? 'image'
                  : contentType === 'AUDIO'
                    ? 'audio'
                    : contentType === 'VIDEO'
                      ? 'video'
                      : 'document',
                mediaUrl!,
                content || '',
                file?.mimetype || undefined,
                file?.originalname || undefined,
              );

        finalMessage = await this.prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            externalMessageId: externalMessageId || null,
            senderAddress: destination,
            status: 'SENT',
            metadata: {
              ...this.asObject(message.metadata as Record<string, any>),
              connectionId: connection.id,
              destination,
            },
          },
        });

        updatedConversation = await this.prisma.agentConversation.update({
          where: { id: conversationId },
          data: {
            connectionId: connection.id,
            externalThreadId: conversation.externalThreadId || destination,
            externalParticipantId: conversation.externalParticipantId || destination,
          },
        });

        await this.appendMessageEvent(tenantId, message.id, 'PROVIDER_ACK', {
          channel: 'WHATSAPP',
          connectionId: connection.id,
          externalMessageId,
          destination,
        });
      } catch (error) {
        finalMessage = await this.prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...this.asObject(message.metadata as Record<string, any>),
              errorMessage: error.message,
            },
          },
        });

        await this.appendMessageEvent(tenantId, message.id, 'PROVIDER_ERROR', {
          channel: 'WHATSAPP',
          message: error.message,
        });

        this.inboxGateway.emitConversationError(tenantId, {
          conversationId,
          message: error.message,
          code: 'WHATSAPP_SEND_ERROR',
        });
      }
    } else if (!conversation.isInternal && conversation.channel === 'TELEGRAM') {
      const connection = await this.resolveConnectedTelegramConnection(
        tenantId,
        conversation,
        dto.connectionId || null,
      );
      const destination = this.resolveExternalAddress(conversation.channel, conversation.contact, conversation);

      if (!destination) {
        throw new BadRequestException('A conversa Telegram nao possui chat valido para envio.');
      }

      try {
        this.logger.log(
          `Sending Telegram message conversation=${conversationId} connection=${connection.id} destination=${destination} contentType=${contentType} contentLength=${content.length} hasMedia=${Boolean(
            mediaUrl,
          )}`,
        );
        const sent = await this.telegramService.sendOutboundMessage({
          connectionId: connection.id,
          chatId: String(destination),
          text: content,
          contentType,
          mediaPath: mediaUrl || undefined,
          mimeType: file?.mimetype || undefined,
          fileName: file?.originalname || undefined,
        });

        finalMessage = await this.prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            externalMessageId: sent.externalMessageId || null,
            senderAddress: String(destination),
            status: 'SENT',
            metadata: {
              ...this.asObject(message.metadata as Record<string, any>),
              connectionId: connection.id,
              destination: String(destination),
              telegramMessageIds: sent.messageIds || [],
            },
          },
        });

        updatedConversation = await this.prisma.agentConversation.update({
          where: { id: conversationId },
          data: {
            connectionId: connection.id,
            externalThreadId: conversation.externalThreadId || String(destination),
            externalParticipantId: conversation.externalParticipantId || String(destination),
          },
        });

        await this.appendMessageEvent(tenantId, message.id, 'PROVIDER_ACK', {
          channel: 'TELEGRAM',
          connectionId: connection.id,
          externalMessageId: sent.externalMessageId || null,
          destination: String(destination),
          messageIds: sent.messageIds || [],
        });
      } catch (error: any) {
        finalMessage = await this.prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...this.asObject(message.metadata as Record<string, any>),
              errorMessage: error?.message || 'Falha ao enviar mensagem Telegram.',
            },
          },
        });

        await this.appendMessageEvent(tenantId, message.id, 'PROVIDER_ERROR', {
          channel: 'TELEGRAM',
          message: error?.message || 'Falha ao enviar mensagem Telegram.',
        });

        this.inboxGateway.emitConversationError(tenantId, {
          conversationId,
          message: error?.message || 'Falha ao enviar mensagem Telegram.',
          code: 'TELEGRAM_SEND_ERROR',
        });
      }
    } else {
      finalMessage = await this.prisma.agentMessage.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
        },
      });
    }

    if (updatedConversation) {
      await this.syncLegacyTicketProjection(updatedConversation);
    }
    await this.mirrorMessageToLegacyTicket(conversationId, finalMessage.id);

    const payload = await this.loadConversationSummary(conversationId);
    this.inboxGateway.emitConversationUpdated(tenantId, payload);
    this.inboxGateway.emitMessageCreated(tenantId, conversationId, finalMessage);
    return finalMessage;
  }

  async captureExternalMessage(input: CaptureExternalMessageInput) {
    const direction = this.normalizeDirection(input.direction);
    const status = this.normalizeStatus(input.status, direction);
    const conversation = await this.ensureConversationForCapture({
      ...input,
      direction,
    });

    if (input.contactId || input.externalParticipantId || input.senderAddress) {
      await this.ensureConversationParticipant({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactId: input.contactId || null,
        role: direction === 'OUTBOUND' ? 'OPERATOR' : 'CONTACT',
        label: input.senderName || undefined,
        externalAddress: input.senderAddress || input.externalParticipantId || input.externalThreadId || null,
        isPrimary: direction === 'INBOUND',
      });
    }

    const existingMessage = input.externalMessageId
      ? await this.prisma.agentMessage.findFirst({
          where: {
            tenantId: input.tenantId,
            conversationId: conversation.id,
            externalMessageId: input.externalMessageId,
          },
        })
      : null;

    if (existingMessage) {
      return {
        conversation,
        message: existingMessage,
        created: false,
      };
    }

    const participantFilters = [];
    if (input.contactId) participantFilters.push({ contactId: input.contactId });
    if (input.senderAddress) participantFilters.push({ externalAddress: input.senderAddress });
    if (input.externalParticipantId) participantFilters.push({ externalAddress: input.externalParticipantId });

    const participant =
      participantFilters.length > 0
        ? await this.prisma.agentParticipant.findFirst({
            where: {
              conversationId: conversation.id,
              OR: participantFilters,
            },
          })
        : null;

    const message = await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        tenantId: input.tenantId,
        participantId: participant?.id || null,
        direction,
        role:
          input.role ||
          (direction === 'INBOUND' ? 'contact' : direction === 'INTERNAL' ? 'member' : 'operator'),
        content: input.content || '',
        contentType: (input.contentType || 'TEXT').toUpperCase(),
        status,
        externalMessageId: input.externalMessageId || null,
        senderName: input.senderName || null,
        senderAddress: input.senderAddress || input.externalParticipantId || null,
        mediaUrl: input.mediaUrl || null,
        metadata: this.asObject(input.metadata),
        createdAt: input.createdAt || new Date(),
      },
    });

    await this.appendMessageEvent(input.tenantId, message.id, 'CAPTURED', {
      channel: this.normalizeChannel(input.channel),
      status,
      direction,
      externalThreadId: input.externalThreadId || null,
    });

    const ticket = await this.syncLegacyTicketProjection(conversation);
    await this.mirrorMessageToLegacyTicket(conversation.id, message.id);

    const payload = await this.loadConversationSummary(conversation.id);
    this.inboxGateway.emitConversationUpdated(input.tenantId, payload);
    this.inboxGateway.emitMessageCreated(input.tenantId, conversation.id, message);

    return {
      conversation,
      message,
      ticket,
      created: true,
    };
  }

  async markConversationRead(conversationId: string, tenantId: string) {
    await this.getConversationOrThrow(conversationId, tenantId);

    const unreadMessages = await this.prisma.agentMessage.findMany({
      where: {
        conversationId,
        direction: 'INBOUND',
        status: {
          not: 'READ',
        },
      },
      select: {
        id: true,
      },
    });

    if (unreadMessages.length === 0) {
      return this.loadConversationDetails(conversationId);
    }

    await this.prisma.agentMessage.updateMany({
      where: {
        id: {
          in: unreadMessages.map((message) => message.id),
        },
      },
      data: {
        status: 'READ',
      },
    });

    for (const message of unreadMessages) {
      await this.appendMessageEvent(tenantId, message.id, 'READ_LOCAL', {});
    }

    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
      },
    });

    const payload = await this.loadConversationDetails(conversationId);
    this.inboxGateway.emitConversationUpdated(tenantId, payload);
    return payload;
  }

  async linkMessageToProcess(
    messageId: string,
    tenantId: string,
    userId: string,
    dto: LinkMessageProcessDto,
  ) {
    const message = await this.prisma.agentMessage.findFirst({
      where: {
        id: messageId,
        tenantId,
      },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem nao encontrada.');
    }

    const process = await this.prisma.process.findFirst({
      where: {
        id: dto.processId,
        tenantId,
      },
    });

    if (!process) {
      throw new NotFoundException('Processo nao encontrado.');
    }

    const timeline = await this.prisma.processTimeline.create({
      data: {
        processId: process.id,
        title:
          dto.title ||
          (message.mediaUrl ? 'Midia vinculada do atendimento' : 'Mensagem vinculada do atendimento'),
        description: dto.description || message.content || null,
        date: message.createdAt,
        type: message.mediaUrl ? 'FILE' : 'MESSAGE',
        source: 'INBOX_V3',
        metadata: {
          agentMessageId: message.id,
          conversationId: message.conversationId,
          externalMessageId: message.externalMessageId,
          mediaUrl: message.mediaUrl,
        },
      },
    });

    const link = await this.prisma.agentMessageLink.create({
      data: {
        tenantId,
        messageId: message.id,
        processId: process.id,
        timelineId: timeline.id,
        linkedByUserId: userId,
        metadata: {
          source: 'inbox-link',
        },
      },
    });

    if (!message.conversation.processId) {
      await this.prisma.agentConversation.update({
        where: { id: message.conversationId },
        data: {
          processId: process.id,
        },
      });
    }

    await this.appendMessageEvent(tenantId, message.id, 'LINKED_TO_PROCESS', {
      processId: process.id,
      timelineId: timeline.id,
    });

    const payload = await this.loadConversationDetails(message.conversationId);
    this.inboxGateway.emitConversationUpdated(tenantId, payload);

    return {
      link,
      timeline,
    };
  }

  async simulateIncomingMessage(conversationId: string, tenantId: string, content: string) {
    const conversation = await this.getConversationOrThrow(conversationId, tenantId);
    return this.captureExternalMessage({
      tenantId,
      channel: conversation.channel,
      contactId: conversation.contactId,
      connectionId: conversation.connectionId,
      processId: conversation.processId,
      externalThreadId: conversation.externalThreadId,
      externalParticipantId: conversation.externalParticipantId,
      direction: conversation.isInternal ? 'INTERNAL' : 'INBOUND',
      role: conversation.isInternal ? 'member' : 'contact',
      content,
      contentType: 'TEXT',
      title: conversation.title,
      senderName: conversation.contact?.name || 'Contato',
      senderAddress: conversation.externalParticipantId || conversation.externalThreadId || null,
      metadata: {
        simulated: true,
      },
    });
  }

  async handleExternalMessageStatus(
    externalMessageId: string,
    status: string,
    payload: Record<string, any>,
  ) {
    const normalizedStatus = (status || 'SENT').toUpperCase();
    const message = await this.prisma.agentMessage.findFirst({
      where: {
        externalMessageId,
      },
      include: {
        conversation: true,
      },
    });

    if (!message) return null;

    await this.prisma.agentMessage.update({
      where: { id: message.id },
      data: {
        status: normalizedStatus,
      },
    });

    if (message.ticketMessageId) {
      await this.prisma.ticketMessage.update({
        where: { id: message.ticketMessageId },
        data: {
          status: normalizedStatus,
          readAt: normalizedStatus === 'READ' ? new Date() : undefined,
        },
      });
    }

    await this.appendMessageEvent(message.tenantId, message.id, 'PROVIDER_STATUS', {
      status: normalizedStatus,
      ...this.asObject(payload),
    });

    this.inboxGateway.emitMessageStatus(
      message.tenantId,
      message.conversationId,
      message.id,
      normalizedStatus,
    );

    return message;
  }
}
