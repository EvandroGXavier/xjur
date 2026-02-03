import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@dr-x/database';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

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
          bankName: dto.bankName,
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
  }
}
