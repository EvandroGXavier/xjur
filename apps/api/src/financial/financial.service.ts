<<<<<<< HEAD
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';
=======
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

<<<<<<< HEAD
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
=======
  // ==================== FINANCIAL RECORDS ====================

  async createFinancialRecord(dto: CreateFinancialRecordDto) {
    return this.prisma.financialRecord.create({
      data: {
        tenantId: dto.tenantId,
        processId: dto.processId,
        bankAccountId: dto.bankAccountId,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        status: dto.status || 'PENDING',
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
      },
      include: {
        process: true,
        bankAccount: true,
      },
    });
  }

  async findAllFinancialRecords(tenantId: string, filters?: {
    type?: string;
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { tenantId };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    
    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.dueDate.lte = new Date(filters.endDate);
    }

    return this.prisma.financialRecord.findMany({
      where,
      include: {
        process: true,
        bankAccount: true,
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findOneFinancialRecord(id: string, tenantId: string) {
    const record = await this.prisma.financialRecord.findFirst({
      where: { id, tenantId },
      include: {
        process: true,
        bankAccount: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro financeiro não encontrado');
    }

    return record;
  }

  async updateFinancialRecord(id: string, tenantId: string, dto: UpdateFinancialRecordDto) {
    await this.findOneFinancialRecord(id, tenantId);

    const data: any = {};
    if (dto.processId !== undefined) data.processId = dto.processId;
    if (dto.bankAccountId !== undefined) data.bankAccountId = dto.bankAccountId;
    if (dto.description) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.paymentDate) data.paymentDate = new Date(dto.paymentDate);
    if (dto.status) data.status = dto.status;
    if (dto.type) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.financialRecord.update({
      where: { id },
      data,
      include: {
        process: true,
        bankAccount: true,
      },
    });
  }

  async deleteFinancialRecord(id: string, tenantId: string) {
    await this.findOneFinancialRecord(id, tenantId);
    return this.prisma.financialRecord.delete({
      where: { id },
    });
  }

  // ==================== BANK ACCOUNTS ====================

  async createBankAccount(dto: CreateBankAccountDto) {
    try {
      // Validação adicional do balance
      const balance = dto.balance !== undefined ? dto.balance : 0;
      
      if (balance < 0) {
        throw new BadRequestException('Saldo não pode ser negativo');
      }

      // Validar contactId se fornecido
      if (dto.contactId) {
        const contact = await this.prisma.contact.findFirst({
          where: { id: dto.contactId, tenantId: dto.tenantId },
        });
        
        if (!contact) {
          throw new BadRequestException('Titular não encontrado');
        }
      }

      return await this.prisma.bankAccount.create({
        data: {
          tenantId: dto.tenantId,
          title: dto.title,
          bankName: dto.bankName || null,
          accountType: dto.accountType,
          accountNumber: dto.accountNumber || null,
          agency: dto.agency || null,
          balance,
          contactId: dto.contactId || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          notes: dto.notes || null,
        },
        include: {
          contact: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Erro ao criar conta bancária:', error);
      throw new InternalServerErrorException('Erro ao criar conta bancária');
    }
  }

  async findAllBankAccounts(tenantId: string) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId },
      include: {
        contact: true,
        _count: {
          select: { financialRecords: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneBankAccount(id: string, tenantId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        financialRecords: {
          take: 10,
          orderBy: { dueDate: 'desc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    return account;
  }

  async updateBankAccount(id: string, tenantId: string, dto: UpdateBankAccountDto) {
    await this.findOneBankAccount(id, tenantId);

    return this.prisma.bankAccount.update({
      where: { id },
      data: dto,
    });
  }

  async deleteBankAccount(id: string, tenantId: string) {
    await this.findOneBankAccount(id, tenantId);
    return this.prisma.bankAccount.delete({
      where: { id },
    });
  }

  async getContacts(tenantId: string, search?: string) {
    const where: any = { tenantId };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { cnpj: { contains: search } },
      ];
    }

    return this.prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        personType: true,
        cpf: true,
        cnpj: true,
        category: true,
      },
      take: 50,
      orderBy: { name: 'asc' },
    });
  }

  // ==================== DASHBOARD & REPORTS ====================

  async getDashboard(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId };
    
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    const records = await this.prisma.financialRecord.findMany({
      where,
    });

    const totalIncome = records
      .filter(r => r.type === 'INCOME' && r.status === 'PAID')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalExpense = records
      .filter(r => r.type === 'EXPENSE' && r.status === 'PAID')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const pendingIncome = records
      .filter(r => r.type === 'INCOME' && r.status === 'PENDING')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const pendingExpense = records
      .filter(r => r.type === 'EXPENSE' && r.status === 'PENDING')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const overdueRecords = records.filter(r => 
      r.status === 'PENDING' && new Date(r.dueDate) < new Date()
    );

    // Group by category
    const byCategory = records.reduce((acc, record) => {
      const cat = record.category || 'Sem categoria';
      if (!acc[cat]) {
        acc[cat] = { income: 0, expense: 0 };
      }
      if (record.status === 'PAID') {
        if (record.type === 'INCOME') {
          acc[cat].income += Number(record.amount);
        } else {
          acc[cat].expense += Number(record.amount);
        }
      }
      return acc;
    }, {} as Record<string, { income: number; expense: number }>);

    // Group by month
    const byMonth = records.reduce((acc, record) => {
      const month = new Date(record.dueDate).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { income: 0, expense: 0 };
      }
      if (record.status === 'PAID') {
        if (record.type === 'INCOME') {
          acc[month].income += Number(record.amount);
        } else {
          acc[month].expense += Number(record.amount);
        }
      }
      return acc;
    }, {} as Record<string, { income: number; expense: number }>);

    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { tenantId, isActive: true },
    });

    const totalBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    return {
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        pendingIncome,
        pendingExpense,
        overdueCount: overdueRecords.length,
        totalBalance,
      },
      byCategory,
      byMonth,
      recentRecords: records.slice(0, 10),
      overdueRecords: overdueRecords.slice(0, 10),
    };
  }

  async getProcessBalance(processId: string, tenantId: string) {
    const records = await this.prisma.financialRecord.findMany({
      where: { processId, tenantId },
    });

    const totalIncome = records
      .filter(r => r.type === 'INCOME')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalExpense = records
      .filter(r => r.type === 'EXPENSE')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const paid = records
      .filter(r => r.status === 'PAID')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const pending = records
      .filter(r => r.status === 'PENDING')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      paid,
      pending,
      records,
    };
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
  }
}
