import { PrismaService } from '@dr-x/database';
export declare class FinancialService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createFee(processId: string, description: string, amount: number, dueDate: Date): Promise<any>;
    getProcessBalance(processId: string): Promise<{
        totalFees: any;
        paid: any;
        outstanding: number;
    }>;
    calculateEngagementScore(contactId: string): Promise<number>;
}
