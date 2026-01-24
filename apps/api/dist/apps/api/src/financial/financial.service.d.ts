import { PrismaService } from '@dr-x/database';
export declare class FinancialService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createFee(processId: string, description: string, amount: number, dueDate: Date): Promise<{
        id: string;
        status: string;
        description: string;
        type: string;
        processId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        dueDate: Date;
    }>;
    getProcessBalance(processId: string): Promise<{
        totalFees: number;
        paid: number;
        outstanding: number;
    }>;
    calculateEngagementScore(contactId: string): Promise<number>;
}
