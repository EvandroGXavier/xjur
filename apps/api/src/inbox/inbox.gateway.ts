import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/inbox',
})
export class InboxGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InboxGateway.name);

  constructor(private readonly configService: ConfigService) {}

  afterInit() {
    this.logger.log('InboxGateway initialized');
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || (client.handshake.query?.token as string);
      if (!token) {
        client.disconnect();
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'drx-super-secret-key-change-in-production';
      const decoded: any = jwt.verify(token, secret);
      if (!decoded?.tenantId) {
        client.disconnect();
        return;
      }

      (client as any).tenantId = decoded.tenantId;
      (client as any).userId = decoded.sub || decoded.userId;
      client.join(`tenant:${decoded.tenantId}`);
      this.logger.debug(`Inbox client ${client.id} connected for tenant ${decoded.tenantId}`);
    } catch (error) {
      this.logger.warn(`Inbox socket rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Inbox client ${client.id} disconnected`);
  }

  emitConversationCreated(tenantId: string, conversation: any) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:new', conversation);
  }

  emitConversationUpdated(tenantId: string, conversation: any) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:updated', conversation);
  }

  emitMessageCreated(tenantId: string, conversationId: string, message: any) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:message', { conversationId, message });
  }

  emitMessageStatus(tenantId: string, conversationId: string, messageId: string, status: string) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:message-status', {
      conversationId,
      messageId,
      status,
    });
  }

  emitConversationError(tenantId: string, error: { conversationId?: string; message: string; code?: string }) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:error', error);
  }
}
