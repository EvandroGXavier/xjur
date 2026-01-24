import { Server } from 'socket.io';
export declare class WhatsappGateway {
    server: Server;
    emitQrCode(qr: string): void;
    emitStatus(status: string): void;
    emitNewMessage(message: any): void;
}
