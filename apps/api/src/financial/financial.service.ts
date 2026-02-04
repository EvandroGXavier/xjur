import { Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    if (!tenantId) return { accounts: [], totalBalance: 0, recentTransactions: [] };

    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId },
      include: { 
         transactions: true 
      }
    });

    const accountsWithBalance = accounts.map(account => {
        const income = account.transactions
            .filter(t => t.type === 'INCOME' && t.status !== 'CANCELLED')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const expense = account.transactions
            .filter(t => t.type === 'EXPENSE' && t.status !== 'CANCELLED')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const currentBalance = Number(account.initialBalance) + income - expense;

        return {
            ...account,
            balance: currentBalance,
            income,
            expense
        };
    });

    const totalBalance = accountsWithBalance.reduce((sum, acc) => sum + acc.balance, 0);

    const recentTransactions = await this.prisma.transaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            category: true,
            creditor: true,
            debtor: true,
            bankAccount: true
        }
    });

    return {
        totalBalance,
        accounts: accountsWithBalance,
        recentTransactions
    };
  }

  async createAccount(data: any) {
      return this.prisma.bankAccount.create({ 
          data: {
              tenantId: data.tenantId,
              name: data.name,
              initialBalance: data.initialBalance || 0
          }
      });
  }

  async getTransactions(tenantId: string) {
      return this.prisma.transaction.findMany({
          where: { tenantId },
          orderBy: { dueDate: 'asc' },
          include: {
              creditor: true,
              debtor: true,
              category: true,
              bankAccount: true,
              process: true
          }
      });
  }

  async createTransaction(data: any) {
      const { 
          totalInstallments = 1, 
          isRecurring = false, 
          frequency, 
          dayOfMonth,
          originalAmount,
          interest,
          fine,
          discount,
          ...baseData 
      } = data;

      // 1. Handle Recurring Template Creation
      let recurringId = null;
      if (isRecurring && frequency && dayOfMonth) {
           const recurring = await this.prisma.recurringExpense.create({
               data: {
                   tenantId: data.tenantId,
                   description: data.description,
                   amount: data.amount,
                   frequency: frequency,
                   dayOfMonth: Number(dayOfMonth),
                   categoryId: data.categoryId,
                   creditorId: data.creditorId,
                   debtorId: data.debtorId,
                   isActive: true,
                   nextProcessDate: new Date(new Date().setMonth(new Date().getMonth() + 1)) // Next month
               }
           });
           recurringId = recurring.id;
      }

      // 2. Handle Installments
      if (totalInstallments > 1) {
          const installmentId = crypto.randomUUID();
          const transactions = [];
          const baseDate = new Date(data.dueDate);
          const baseValue = Number(data.amount) / totalInstallments; // Simple division

          for (let i = 0; i < totalInstallments; i++) {
              const dueDate = new Date(baseDate);
              dueDate.setMonth(dueDate.getMonth() + i);

              transactions.push(this.prisma.transaction.create({
                  data: {
                      ...baseData,
                      description: `${baseData.description} (${i+1}/${totalInstallments})`,
                      amount: baseValue,
                      dueDate: dueDate,
                      status: 'PENDING',
                      installmentId,
                      installmentNumber: i + 1,
                      totalInstallments: totalInstallments,
                      recurringExpenseId: recurringId
                  }
              }));
          }
          return this.prisma.$transaction(transactions);
      }

      // 3. Single Transaction (Regular or First of Recurring)
      return this.prisma.transaction.create({
          data: {
            ...baseData,
            amount: data.amount,
            originalAmount: originalAmount || data.amount,
            interest: interest || 0,
            fine: fine || 0,
            discount: discount || 0,
            status: data.status || 'PENDING',
            dueDate: new Date(data.dueDate),
            recurringExpenseId: recurringId
          }
      });
  }

  async getAccounts(tenantId: string) {
      return this.prisma.bankAccount.findMany({ where: { tenantId } });
  }

  async getCategories(tenantId: string) {
      return this.prisma.transactionCategory.findMany({ where: { tenantId } });
  }

  async createCategory(data: any) {
      return this.prisma.transactionCategory.create({
          data: {
              tenantId: data.tenantId,
              name: data.name,
              type: data.type
          }
      });
  }

  async payTransaction(id: string, data: { amount?: number, interest?: number, fine?: number, discount?: number, paymentDate: Date, bankAccountId: string }) {
      const transaction = await this.prisma.transaction.findUnique({ where: { id } });
      if (!transaction) throw new Error("Transaction not found");

      // Calculate final amount
      // Logic: If user passes explicit amount, use it. 
      // Or: Original + Interest + Fine - Discount.
      let finalAmount = Number(data.amount || transaction.amount);
      
      return this.prisma.transaction.update({
          where: { id },
          data: {
              status: 'PAID',
              paymentDate: new Date(data.paymentDate),
              bankAccountId: data.bankAccountId,
              amount: finalAmount,
              interest: data.interest || transaction.interest,
              fine: data.fine || transaction.fine,
              discount: data.discount || transaction.discount
          }
      });
  }
  async getSettings(tenantId: string) {
      let settings = await this.prisma.financialSettings.findUnique({
          where: { tenantId }
      });

      if (!settings) {
          settings = await this.prisma.financialSettings.create({
              data: { tenantId }
          });
      }
      return settings;
  }

  async updateSettings(tenantId: string, data: any) {
      return this.prisma.financialSettings.upsert({
          where: { tenantId },
          create: {
              tenantId,
              defaultOfficeContactId: data.defaultOfficeContactId
          },
          update: {
              defaultOfficeContactId: data.defaultOfficeContactId
          }
      });
  }

  // --- Legacy / Engagement ---
  async calculateEngagementScore(contactId: string): Promise<number> {
      const logs = await this.prisma.communicationLog.findMany({
          where: { contactId },
          orderBy: { createdAt: 'desc' },
          take: 10
      });

      if (logs.length === 0) return 0;

      const lastInteraction = logs[0].createdAt;
      const daysSinceLastContact = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);

      let score = 100 - (daysSinceLastContact * 5);
      
      if (logs[0].direction === 'INBOUND') {
          score += 20;
      }

      return Math.max(0, Math.min(100, score));
  }
}
