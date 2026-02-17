import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Use jsonwebtoken directly (transitive dependency of @nestjs/jwt)
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/tickets',
})
export class TicketsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TicketsGateway.name);

  constructor(private readonly configService: ConfigService) {}

  afterInit() {
    this.logger.log('🔌 TicketsGateway initialized');
  }

  handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`❌ Client ${client.id} rejected: no token`);
        client.disconnect();
        return;
      }

      // Verify JWT — use the same secret as @nestjs/jwt
      const secret = this.configService.get<string>('JWT_SECRET') || 'drx-super-secret-key-change-in-production';
      let decoded: any;
      try {
        decoded = jwt.verify(token, secret);
      } catch {
        this.logger.warn(`❌ Client ${client.id} rejected: invalid JWT`);
        client.disconnect();
        return;
      }

      if (!decoded?.tenantId) {
        this.logger.warn(`❌ Client ${client.id} rejected: no tenantId in token`);
        client.disconnect();
        return;
      }

      // Store tenant info on socket and join tenant room
      (client as any).tenantId = decoded.tenantId;
      (client as any).userId = decoded.sub || decoded.userId;
      client.join(`tenant:${decoded.tenantId}`);

      this.logger.log(
        `✅ Client ${client.id} connected (tenant: ${decoded.tenantId})`,
      );
    } catch (error) {
      this.logger.warn(
        `❌ Client ${client.id} rejected: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client ${client.id} disconnected`);
  }

  // ============================================================
  // EMIT METHODS — Called by TicketsService / WhatsappService
  // ============================================================

  /**
   * Emits when a new ticket is created.
   * All connected clients of the same tenant receive it.
   */
  emitTicketCreated(tenantId: string, ticket: any) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('ticket:new', ticket);
    this.logger.debug(`📢 ticket:new emitted for tenant ${tenantId}`);
  }

  /**
   * Emits when a ticket is updated (status, assignment, etc).
   */
  emitTicketUpdated(tenantId: string, ticket: any) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('ticket:updated', ticket);
    this.logger.debug(`📢 ticket:updated emitted for tenant ${tenantId}`);
  }

  /**
   * Emits when an error occurs during ticket processing (e.g. WhatsApp send failure).
   */
  emitTicketError(tenantId: string, error: { ticketId: string; message: string; code?: string }) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('ticket:error', error);
    this.logger.warn(`📢 ticket:error emitted for tenant ${tenantId}: ${error.message}`);
  }

  /**
   * Emits when a new message is added to a ticket.
   * Carries both the ticket ID and the full message.
   */
  emitNewMessage(tenantId: string, ticketId: string, message: any) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('ticket:message', { ticketId, message });
    this.logger.debug(
      `📢 ticket:message emitted for ticket ${ticketId} (tenant ${tenantId})`,
    );
  }

  emitMessageDeleted(tenantId: string, ticketId: string, messageId: string) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('message:deleted', { ticketId, messageId });
  }

  emitMessageStatus(tenantId: string, ticketId: string, messageId: string, status: string) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('message:status', { ticketId, messageId, status });
  }
}
