import { WhatsappService } from './whatsapp.service';
export declare class WhatsappController {
    private readonly whatsappService;
    constructor(whatsappService: WhatsappService);
    sendMessage(body: {
        to: string;
        message: string;
    }): Promise<{
        success: boolean;
    }>;
    getStatus(): {
        status: string;
    };
}
