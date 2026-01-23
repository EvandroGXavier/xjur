import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dr-x/database';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 2.2 Módulos Jurídicos e Financeiros - Financeiro
   * Gestão de honorários, parcelamentos de contratos e fluxo de caixa por processo.
   */
  async createFee(processId: string, description: string, amount: number, dueDate: Date) {
    return this.prisma.financialRecord.create({
      data: {
        processId,
        description,
        amount,
        dueDate,
        status: 'PENDING',
        type: 'FEE'
      }
    });
  }

  async getProcessBalance(processId: string) {
    const records = await this.prisma.financialRecord.findMany({
        where: { processId }
    });

    const totalFees = records
        .filter(r => r.type === 'FEE')
        .reduce((sum, r) => sum + Number(r.amount), 0);
    
    const paid = records
        .filter(r => r.status === 'PAID')
        .reduce((sum, r) => sum + Number(r.amount), 0);

    return {
        totalFees,
        paid,
        outstanding: totalFees - paid
    };
  }

  /**
   * 3.2 Score de Engajamento
   * Painel que sinaliza leads frios e sugere reativações automáticas.
   */
  async calculateEngagementScore(contactId: string): Promise<number> {
      const logs = await this.prisma.communicationLog.findMany({
          where: { contactId },
          orderBy: { createdAt: 'desc' },
          take: 10
      });

      if (logs.length === 0) return 0;

      const lastInteraction = logs[0].createdAt;
      const daysSinceLastContact = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);

      // Score starts at 100 and decays by 5 per day of silence
      let score = 100 - (daysSinceLastContact * 5);
      
      // Bonus for recent inbound messages
      if (logs[0].direction === 'INBOUND') {
          score += 20;
      }

      return Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
  }
}
