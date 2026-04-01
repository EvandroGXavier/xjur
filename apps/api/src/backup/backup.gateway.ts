import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/backup',
})
export class BackupGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BackupGateway.name);

  afterInit() {
    this.logger.log('🔌 BackupGateway initialized (namespace: /backup)');
  }

  emitProgress(action: string, progress: number, message: string, details?: any) {
    this.server.emit('progress', { action, progress, message, ...details });
  }

  emitMessage(message: string, type: 'info' | 'success' | 'error' = 'info') {
    this.server.emit('message', { message, type });
  }
}
