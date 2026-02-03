import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WhatsappGateway {
  @WebSocketServer()
  server: Server;

  emitQrCode(qr: string) {
    this.server.emit('qr_code', { qr });
  }

  emitStatus(status: string) {
    this.server.emit('whatsapp_status', { status });
  }

  emitNewMessage(message: any) {
    this.server.emit('new_message', message);
  }
}
