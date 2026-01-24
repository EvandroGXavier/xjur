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
        logId: string;
        contact: string;
        suggestion: string;
        context?: undefined;
        reply?: undefined;
    }>;
    linkToProcess(messageId: string, processId: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        description: string | null;
        type: string;
        date: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        processId: string;
    }>;
}
