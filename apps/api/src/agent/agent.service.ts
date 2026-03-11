import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CaptureChannelMessageInput } from './agent.types';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeChannel(channel: string) {
    return (channel || 'WEBCHAT').trim().toUpperCase();
  }

  private asObject(metadata: Record<string, any> | null | undefined) {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  }

  private resolveThreadId(input: CaptureChannelMessageInput) {
    if (input.externalThreadId?.trim()) return input.externalThreadId.trim();
    if (input.ticketId) return 'ticket:' + input.ticketId;
    if (input.contactId) return 'contact:' + input.contactId;
    if (input.senderAddress?.trim()) return input.senderAddress.trim();
    return null;
  }

  private async findConversation(input: CaptureChannelMessageInput, channel: string, externalThreadId: string | null) {
    if (input.ticketId) {
      const byTicket = await this.prisma.agentConversation.findFirst({
        where: {
          tenantId: input.tenantId,
          ticketId: input.ticketId,
          channel,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (byTicket) return byTicket;
    }

    if (input.connectionId && externalThreadId) {
      const byConnectionThread = await this.prisma.agentConversation.findFirst({
        where: {
          tenantId: input.tenantId,
          connectionId: input.connectionId,
          channel,
          externalThreadId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (byConnectionThread) return byConnectionThread;
    }

    if (externalThreadId) {
      const byThread = await this.prisma.agentConversation.findFirst({
        where: {
          tenantId: input.tenantId,
          channel,
          externalThreadId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (byThread) return byThread;
    }

    return null;
  }

  private async ensureConversation(input: CaptureChannelMessageInput) {
    const channel = this.normalizeChannel(input.channel);
    const externalThreadId = this.resolveThreadId(input);
    const metadata = this.asObject(input.metadata);

    const existing = await this.findConversation(input, channel, externalThreadId);
    if (existing) {
      return this.prisma.agentConversation.update({
        where: { id: existing.id },
        data: {
          ticketId: input.ticketId ?? existing.ticketId,
          contactId: input.contactId ?? existing.contactId,
          connectionId: input.connectionId ?? existing.connectionId,
          externalParticipantId: input.externalParticipantId ?? existing.externalParticipantId,
          title: input.title ?? existing.title,
          lastMessageAt: input.createdAt ?? new Date(),
          metadata: {
            ...(this.asObject(existing.metadata as Record<string, any>)),
            ...metadata,
          },
        },
      });
    }

    return this.prisma.agentConversation.create({
      data: {
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        contactId: input.contactId,
        connectionId: input.connectionId,
        channel,
        title: input.title || null,
        externalThreadId,
        externalParticipantId: input.externalParticipantId || null,
        lastMessageAt: input.createdAt ?? new Date(),
        metadata,
      },
    });
  }

  private async ensureRun(conversationId: string, input: CaptureChannelMessageInput, channel: string) {
    if ((input.direction || 'INBOUND') !== 'INBOUND') return;

    await this.prisma.agentRun.create({
      data: {
        conversationId,
        tenantId: input.tenantId,
        trigger: 'INBOUND_MESSAGE',
        channel,
        status: 'PENDING',
        metadata: this.asObject(input.metadata),
      },
    });
  }

  async captureMessage(input: CaptureChannelMessageInput) {
    const channel = this.normalizeChannel(input.channel);
    const conversation = await this.ensureConversation(input);
    const messageMetadata = this.asObject(input.metadata);

    if (input.ticketMessageId) {
      const existingByTicketMessage = await this.prisma.agentMessage.findFirst({
        where: {
          tenantId: input.tenantId,
          conversationId: conversation.id,
          ticketMessageId: input.ticketMessageId,
        },
      });

      if (existingByTicketMessage) {
        return { conversation, message: existingByTicketMessage, created: false };
      }
    }

    if (input.externalMessageId) {
      const existingByExternal = await this.prisma.agentMessage.findFirst({
        where: {
          tenantId: input.tenantId,
          conversationId: conversation.id,
          externalMessageId: input.externalMessageId,
        },
      });

      if (existingByExternal) {
        return { conversation, message: existingByExternal, created: false };
      }
    }

    const message = await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        tenantId: input.tenantId,
        ticketMessageId: input.ticketMessageId || null,
        direction: input.direction || 'INBOUND',
        role: input.role || ((input.direction || 'INBOUND') === 'INBOUND' ? 'contact' : 'operator'),
        content: input.content || '',
        contentType: input.contentType || 'TEXT',
        externalMessageId: input.externalMessageId || null,
        senderName: input.senderName || null,
        senderAddress: input.senderAddress || null,
        mediaUrl: input.mediaUrl || null,
        metadata: messageMetadata,
        createdAt: input.createdAt || new Date(),
      },
    });

    await this.prisma.agentConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: input.createdAt ?? new Date(),
      },
    });

    await this.ensureRun(conversation.id, input, channel);

    this.logger.debug(
      `Captured ${message.direction} ${channel} message for conversation ${conversation.id}`,
    );

    return { conversation, message, created: true };
  }
}
