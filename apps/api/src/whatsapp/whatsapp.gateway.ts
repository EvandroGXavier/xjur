import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp',
})
export class WhatsappGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsappGateway.name);

  afterInit() {
    this.logger.log('🔌 WhatsappGateway initialized (namespace: /whatsapp)');
  }

  /**
   * Emits QR code raw string for a specific connection.
   * The frontend will render with QRCodeSVG for maximum clarity.
   */
  emitQrCode(connectionId: string, qrRaw: string) {
    this.server.emit('qr_code', { connectionId, qr: qrRaw });
    this.logger.log(`📸 QR Code emitted for connection ${connectionId}`);
  }

  /**
   * Emits connection status change.
   */
  emitConnectionStatus(connectionId: string, status: string, data?: any) {
    this.server.emit('connection:status', { connectionId, status, ...data });
    this.logger.log(`📶 Status ${status} emitted for connection ${connectionId}`);
  }

  /**
   * Emits connection error.
   */
  emitConnectionError(connectionId: string, error: string) {
    this.server.emit('connection:error', { connectionId, error });
    this.logger.warn(`❌ Error emitted for connection ${connectionId}: ${error}`);
  }
}
