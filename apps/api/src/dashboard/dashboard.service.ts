import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(tenantId: string) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const [
      activeProcesses,
      todayAppointments,
      pendingFinancial,
      monthlyRevenue,
      monthlyExpenses,
      statusDistribution,
      lawyerDistribution
    ] = await Promise.all([
      // Processos Ativos
      this.prisma.process.count({
        where: { tenantId, status: 'ATIVO' }
      }),
      // Compromissos de Hoje
      this.prisma.appointment.count({
        where: { 
          tenantId,
          startAt: { gte: todayStart, lte: todayEnd }
        }
      }),
      // Financeiro Pendente
      this.prisma.financialRecord.count({
        where: { 
          tenantId,
          status: 'PENDING',
          dueDate: { lte: todayEnd }
        }
      }),
      // Faturamento Mensal
      this.prisma.financialRecord.aggregate({
        where: { 
          tenantId,
          type: 'INCOME',
          status: 'PAID',
          paymentDate: { gte: monthStart, lte: monthEnd }
        },
        _sum: { amount: true }
      }),
      // Despesas Mensais
      this.prisma.financialRecord.aggregate({
        where: { 
          tenantId,
          type: 'EXPENSE',
          status: 'PAID',
          paymentDate: { gte: monthStart, lte: monthEnd }
        },
        _sum: { amount: true }
      }),
      // Status
      this.prisma.process.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true }
      }),
      // Advogados
      this.prisma.process.groupBy({
        by: ['responsibleLawyer'],
        where: { tenantId },
        _count: { _all: true }
      })
    ]);

    return {
      counters: {
        activeProcesses,
        todayAppointments,
        pendingFinancial,
        monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
        monthlyExpenses: Number(monthlyExpenses._sum.amount || 0),
      },
      statusDistribution,
      lawyerDistribution
    };
  }
}
