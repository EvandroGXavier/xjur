import { PrismaService } from '@dr-x/database';
export declare class TriagemService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    handleIncomingMessage(phone: string, content: string, mediaUrl?: string): Promise<{
        action: string;
        context: string;
        reply: string;
        logId?: undefined;
        contact?: undefined;
        suggestion?: undefined;
    } | {
        action: string;
        logId: any;
        contact: any;
        suggestion: string;
        context?: undefined;
        reply?: undefined;
    }>;
    linkToProcess(messageId: string, processId: string): Promise<any>;
}
