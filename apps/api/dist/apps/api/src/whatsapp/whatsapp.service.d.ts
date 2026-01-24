import { OnModuleInit } from '@nestjs/common';
import { WhatsappGateway } from './whatsapp.gateway';
export declare class WhatsappService implements OnModuleInit {
    private readonly gateway;
    private socket;
    private readonly logger;
    private authState;
    private saveCreds;
    constructor(gateway: WhatsappGateway);
    onModuleInit(): Promise<void>;
    connectToWhatsapp(): Promise<void>;
    private handleIncomingMessage;
    sendText(to: string, text: string): Promise<void>;
}
