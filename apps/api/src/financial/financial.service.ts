import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "@drx/database";
import { Decimal } from "@prisma/client/runtime/library";
import {
  CreateFinancialRecordDto,
  CreateInstallmentsDto,
  PartialPaymentDto,
  SettleRecordDto,
  CreateTransactionSplitDto,
} from "./dto/create-financial-record.dto";
import { UpdateFinancialRecordDto } from "./dto/update-financial-record.dto";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== INCLUDES PADRÃO ====================

  private readonly defaultRecordInclude = {
    process: true,
    bankAccount: true,
    financialCategory: true,
    parties: {
      include: { contact: true },
    },
    splits: true,
    tags: {
      include: { tag: true },
    },
    parent: {
      select: {
        id: true,
        description: true,
        amount: true,
        installmentNumber: true,
      },
    },
    children: {
      select: {
        id: true,
        description: true,
        amount: true,
        installmentNumber: true,
        status: true,
        dueDate: true,
        isResidual: true,
        amountFinal: true,
        amountPaid: true,
        paymentDate: true,
      },
      orderBy: { installmentNumber: "asc" as const },
    },
  };

  private buildRootRecordWhere(tenantId: string) {
    return {
      tenantId,
      parentId: null,
    };
  }

  private buildEffectiveRecordWhere(tenantId: string) {
    return {
      tenantId,
      NOT: {
        children: { some: {} },
      },
    };
  }

  private normalizeRecordTotals<
    T extends {
      amount?: any;
      amountFinal?: any;
      children?: Array<{ amount?: any; amountFinal?: any }>;
    },
  >(record: T): T {
    if (!Array.isArray(record.children) || record.children.length === 0) {
      return record;
    }

    const childrenAmount =
      Math.round(
        record.children.reduce(
          (sum, child) => sum + Number(child.amount ?? 0),
          0,
        ) * 100,
      ) / 100;
    const childrenAmountFinal =
      Math.round(
        record.children.reduce(
          (sum, child) => sum + Number(child.amountFinal ?? child.amount ?? 0),
          0,
        ) * 100,
      ) / 100;

    return {
      ...record,
      amount: Number(record.amount ?? 0) > 0 ? record.amount : childrenAmount,
      amountFinal:
        Number(record.amountFinal ?? 0) > 0
          ? record.amountFinal
          : childrenAmountFinal,
    };
  }

  private sanitizeAttachmentName(fileName: string) {
    const path = require("path");
    return path.basename(fileName).replace(/[^\w.\-() ]+/g, "_");
  }

  // ==================== UTILITÁRIOS DE CÁLCULO ====================

  /**
   * Calcula o valor final considerando encargos e descontos
   */
  calculateFinalAmount(
    amount: number,
    fine?: number,
    interest?: number,
    monetaryCorrection?: number,
    discount?: number,
    discountType?: string,
  ): number {
    let total = amount;

    // Somar encargos
    if (fine) total += fine;
    if (interest) total += interest;
    if (monetaryCorrection) total += monetaryCorrection;

    // Aplicar desconto
    if (discount && discount > 0) {
      if (discountType === "PERCENTAGE") {
        total -= total * (discount / 100);
      } else {
        // VALUE (padrão)
        total -= discount;
      }
    }

    return Math.max(0, Math.round(total * 100) / 100); // Nunca negativo, 2 casas decimais
  }

  getAttachmentPath(fileName: string) {
    const path = require("path");
    return path.join(
      process.cwd(),
      "uploads",
      "financial",
      this.sanitizeAttachmentName(fileName),
    );
  }

  async getAttachmentForRecord(
    recordId: string,
    tenantId: string,
    fileName: string,
  ) {
    const safeFileName = this.sanitizeAttachmentName(fileName);
    const record = await this.prisma.financialRecord.findFirst({
      where: { id: recordId, tenantId },
      select: { metadata: true },
    });

    if (!record) {
      throw new NotFoundException("Registro financeiro nao encontrado");
    }

    const metadata = record.metadata as any;
    const attachments = Array.isArray(metadata?.attachments)
      ? metadata.attachments
      : [];
    const attachment = attachments.find(
      (item: any) => item?.fileName === safeFileName,
    );

    if (!attachment) {
      throw new NotFoundException("Anexo financeiro nao encontrado");
    }

    return {
      ...attachment,
      fileName: safeFileName,
      filePath: this.getAttachmentPath(safeFileName),
    };
  }

  private async processAttachments(
    files?: any[],
    existingMetadata?: any,
  ): Promise<any> {
    let metadata = existingMetadata
      ? { ...(typeof existingMetadata === "object" ? existingMetadata : {}) }
      : {};
    const newAttachments = [];

    if (files && files.length > 0) {
      const fs = require("fs");
      const path = require("path");
      const uploadDir = path.join(process.cwd(), "uploads", "financial");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const originalName = this.sanitizeAttachmentName(
          file.originalname || "anexo",
        );
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);

        newAttachments.push({
          originalName: file.originalname || originalName,
          fileName: fileName,
          path: `/uploads/financial/${fileName}`,
          mimeType: file.mimetype,
          size: file.size,
        });
      }

      const existingAttachments = Array.isArray(metadata.attachments)
        ? metadata.attachments
        : [];
      metadata.attachments = [...existingAttachments, ...newAttachments];
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  // ==================== FINANCIAL RECORDS ====================

  async createFinancialRecord(dto: CreateFinancialRecordDto, files?: any[]) {
    // Calcular valor final se houver encargos/descontos
    const amountFinal = this.calculateFinalAmount(
      dto.amount,
      dto.fine,
      dto.interest,
      dto.monetaryCorrection,
      dto.discount,
      dto.discountType,
    );

    // Se houver parcelas pré-calculadas enviadas pelo frontend
    if (!dto.parentId && dto.installments && dto.installments.length > 0) {
      // Validar a soma das parcelas
      const installmentsSum = dto.installments.reduce(
        (acc, inst) => acc + (Number(inst.amount) || 0),
        0,
      );
      const roundedSum = Math.round(installmentsSum * 100) / 100;
      const roundedAmount = Math.round(dto.amount * 100) / 100;

      if (Math.abs(roundedSum - roundedAmount) > 0.01) {
        throw new BadRequestException(
          `A soma das parcelas (${roundedSum}) não confere com o valor total (${roundedAmount}). Diferença: ${Math.round((roundedAmount - roundedSum) * 100) / 100}`,
        );
      }

      const totalInst = dto.installments.length;

      // Criar registro mãe (geralmente a primeira parcela ou um resumo)
      const parent = await this.prisma.financialRecord.create({
        data: {
          tenantId: dto.tenantId,
          processId: dto.processId,
          bankAccountId: dto.bankAccountId,
          categoryId: dto.categoryId,
          paymentConditionId: dto.paymentConditionId,
          description: dto.description,
          amount: dto.amount,
          amountFinal,
          dueDate: new Date(dto.installments[0].dueDate),
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
          status: dto.status || "PENDING",
          type: dto.type,
          category: dto.category,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes
            ? `${dto.notes} | Parcelado em ${totalInst}x`
            : `Parcelado em ${totalInst}x`,
          fine: dto.fine,
          interest: dto.interest,
          monetaryCorrection: dto.monetaryCorrection,
          discount: dto.discount,
          discountType: dto.discountType,
          totalInstallments: totalInst,
          periodicity: dto.periodicity,
          origin: dto.origin || "MANUAL",
          parties: dto.parties
            ? {
                create: dto.parties.map((p) => ({
                  tenantId: dto.tenantId,
                  contactId: p.contactId,
                  role: p.role,
                  amount: p.amount,
                })),
              }
            : undefined,
          splits: dto.splits
            ? {
                create: dto.splits.map((s) => ({
                  tenantId: dto.tenantId,
                  contactId: s.contactId,
                  role: s.role,
                  amount: s.amount,
                  percentage: s.percentage,
                  description: s.description,
                  notes: s.notes,
                })),
              }
            : undefined,
          metadata: await this.processAttachments(files),
        },
      });

      const installments = dto.installments.map((inst, i) => ({
        tenantId: dto.tenantId,
        processId: dto.processId,
        bankAccountId: dto.bankAccountId,
        categoryId: dto.categoryId,
        description: `${dto.description} - Parcela ${inst.installmentNumber}/${totalInst}`,
        amount: inst.amount,
        amountFinal: inst.amount,
        dueDate: new Date(inst.dueDate),
        status: i === 0 && dto.status === "PAID" ? "PAID" : "PENDING",
        paymentDate:
          i === 0 && dto.status === "PAID" ? parent.paymentDate : null,
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        parentId: parent.id,
        installmentNumber: inst.installmentNumber,
        totalInstallments: totalInst,
        periodicity: dto.periodicity,
        paymentConditionId: dto.paymentConditionId,
        isResidual: dto.isResidual,
        origin: dto.origin || "MANUAL",
      }));

      await this.prisma.financialRecord.createMany({
        data: installments,
      });

      return this.findOneFinancialRecord(parent.id, dto.tenantId);
    }

    // Lógica legada de parcelamento simples (se totalInstallments > 1 mas sem installments array)
    if (!dto.parentId && dto.totalInstallments && dto.totalInstallments > 1) {
      const parent = await this.prisma.financialRecord.create({
        data: {
          tenantId: dto.tenantId,
          processId: dto.processId,
          bankAccountId: dto.bankAccountId,
          categoryId: dto.categoryId,
          paymentConditionId: dto.paymentConditionId,
          description: dto.description,
          amount: dto.amount,
          amountFinal: amountFinal,
          dueDate: new Date(dto.dueDate),
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
          status: dto.status || "PENDING",
          type: dto.type,
          category: dto.category,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes
            ? `${dto.notes} | Parcelado em ${dto.totalInstallments}x`
            : `Parcelado em ${dto.totalInstallments}x`,
          fine: dto.fine,
          interest: dto.interest,
          monetaryCorrection: dto.monetaryCorrection,
          discount: dto.discount,
          discountType: dto.discountType,
          totalInstallments: dto.totalInstallments,
          periodicity: dto.periodicity,
          parties: dto.parties
            ? {
                create: dto.parties.map((p) => ({
                  tenantId: dto.tenantId,
                  contactId: p.contactId,
                  role: p.role,
                  amount: p.amount,
                })),
              }
            : undefined,
          splits: dto.splits
            ? {
                create: dto.splits.map((s) => ({
                  tenantId: dto.tenantId,
                  contactId: s.contactId,
                  role: s.role,
                  amount: s.amount,
                  percentage: s.percentage,
                  description: s.description,
                  notes: s.notes,
                })),
              }
            : undefined,
          metadata: await this.processAttachments(files),
        },
      });

      const installments = [];
      const parentAmountFinal = Number(amountFinal);
      const installmentAmount =
        Math.floor((parentAmountFinal / dto.totalInstallments) * 100) / 100;
      const remainder =
        Math.round(
          (parentAmountFinal - installmentAmount * dto.totalInstallments) * 100,
        ) / 100;

      for (let i = 0; i < dto.totalInstallments; i++) {
        const d = this.calculateNextDueDate(dto.dueDate, dto.periodicity, i);

        const amount =
          i === dto.totalInstallments - 1
            ? installmentAmount + remainder
            : installmentAmount;

        installments.push({
          tenantId: dto.tenantId,
          processId: dto.processId,
          bankAccountId: dto.bankAccountId,
          categoryId: dto.categoryId,
          description: `${dto.description} - Parcela ${i + 1}/${dto.totalInstallments}`,
          amount: amount,
          amountFinal: amount,
          dueDate: d,
          status: i === 0 && dto.status === "PAID" ? "PAID" : "PENDING",
          paymentDate:
            i === 0 && dto.status === "PAID" ? parent.paymentDate : null,
          type: dto.type,
          category: dto.category,
          paymentMethod: dto.paymentMethod,
          parentId: parent.id,
          installmentNumber: i + 1,
          totalInstallments: dto.totalInstallments,
          periodicity: dto.periodicity,
          paymentConditionId: dto.paymentConditionId,
        });
      }

      await this.prisma.financialRecord.createMany({
        data: installments,
      });

      return this.findOneFinancialRecord(parent.id, dto.tenantId);
    }

    return this.prisma.financialRecord.create({
      data: {
        tenantId: dto.tenantId,
        processId: dto.processId,
        bankAccountId: dto.bankAccountId,
        categoryId: dto.categoryId,
        paymentConditionId: dto.paymentConditionId,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        status: dto.status || "PENDING",
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        fine: dto.fine,
        interest: dto.interest,
        monetaryCorrection: dto.monetaryCorrection,
        discount: dto.discount,
        discountType: dto.discountType,
        amountFinal,
        parentId: dto.parentId,
        installmentNumber: dto.installmentNumber,
        totalInstallments: dto.totalInstallments,
        periodicity: dto.periodicity,
        isResidual: dto.isResidual || false,
        origin: dto.origin || "MANUAL",

        parties: dto.parties
          ? {
              create: dto.parties.map((p) => ({
                tenantId: dto.tenantId,
                contactId: p.contactId,
                role: p.role,
                amount: p.amount,
              })),
            }
          : undefined,

        splits: dto.splits
          ? {
              create: dto.splits.map((s) => ({
                tenantId: dto.tenantId,
                contactId: s.contactId,
                role: s.role,
                amount: s.amount,
                percentage: s.percentage,
                description: s.description,
                notes: s.notes,
              })),
            }
          : undefined,
        metadata: await this.processAttachments(files),
      },
      include: this.defaultRecordInclude,
    });
  }

  async findAllFinancialRecords(
    tenantId: string,
    filters?: {
      type?: string;
      status?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      parentId?: string;
      showInstallments?: boolean;
    },
  ) {
    const where: any =
      filters?.showInstallments || filters?.parentId
        ? { tenantId }
        : this.buildRootRecordWhere(tenantId);

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.category) {
      where.OR = [
        { categoryId: filters.category },
        { category: filters.category },
      ];
    }
    if (filters?.parentId) where.parentId = filters.parentId;

    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.dueDate.lte = new Date(filters.endDate);
    }

    const records = await this.prisma.financialRecord.findMany({
      where,
      include: this.defaultRecordInclude,
      orderBy: { dueDate: "desc" },
    });

    return records.map((record) => this.normalizeRecordTotals(record));
  }

  async findOneFinancialRecord(id: string, tenantId: string) {
    const record = await this.prisma.financialRecord.findFirst({
      where: { id, tenantId },
      include: this.defaultRecordInclude,
    });

    if (!record) {
      throw new NotFoundException("Registro financeiro não encontrado");
    }

    return this.normalizeRecordTotals(record);
  }

  async updateFinancialRecord(
    id: string,
    tenantId: string,
    dto: UpdateFinancialRecordDto,
    files?: any[],
  ) {
    const existing = await this.prisma.financialRecord.findUnique({
      where: { id, tenantId },
      include: { parties: true, splits: true },
    });

    if (!existing) {
      throw new NotFoundException("Registro financeiro não encontrado");
    }

    const data: any = {};
    if (dto.processId !== undefined) data.processId = dto.processId;
    if (dto.bankAccountId !== undefined) data.bankAccountId = dto.bankAccountId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.description) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.paymentDate) data.paymentDate = new Date(dto.paymentDate);
    if (dto.status) data.status = dto.status;
    if (dto.type) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.notes !== undefined) data.notes = dto.notes;

    // Encargos & Descontos
    if (dto.fine !== undefined) data.fine = dto.fine;
    if (dto.interest !== undefined) data.interest = dto.interest;
    if (dto.monetaryCorrection !== undefined)
      data.monetaryCorrection = dto.monetaryCorrection;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;

    // Recalcular valor final se houve mudança em encargos
    const amount =
      dto.amount !== undefined ? dto.amount : Number(existing.amount);
    const fine =
      dto.fine !== undefined
        ? dto.fine
        : existing.fine
          ? Number(existing.fine)
          : undefined;
    const interest =
      dto.interest !== undefined
        ? dto.interest
        : existing.interest
          ? Number(existing.interest)
          : undefined;
    const monetaryCorrection =
      dto.monetaryCorrection !== undefined
        ? dto.monetaryCorrection
        : existing.monetaryCorrection
          ? Number(existing.monetaryCorrection)
          : undefined;
    const discount =
      dto.discount !== undefined
        ? dto.discount
        : existing.discount
          ? Number(existing.discount)
          : undefined;
    const discountType =
      dto.discountType !== undefined ? dto.discountType : existing.discountType;

    data.amountFinal = this.calculateFinalAmount(
      amount,
      fine,
      interest,
      monetaryCorrection,
      discount,
      discountType,
    );

    // Parcelamento
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.installmentNumber !== undefined)
      data.installmentNumber = dto.installmentNumber;
    if (dto.totalInstallments !== undefined)
      data.totalInstallments = dto.totalInstallments;
    if (dto.periodicity !== undefined) data.periodicity = dto.periodicity;
    if (dto.isResidual !== undefined) data.isResidual = dto.isResidual;
    if (dto.origin !== undefined) data.origin = dto.origin;

    // Atualizar partes (parties)
    if (dto.parties) {
      await this.prisma.financialParty.deleteMany({
        where: { financialRecordId: id },
      });

      if (dto.parties.length > 0) {
        await this.prisma.financialParty.createMany({
          data: dto.parties.map((p) => ({
            tenantId,
            financialRecordId: id,
            contactId: p.contactId,
            role: p.role,
            amount: p.amount,
          })),
        });
      }
    }

    // Atualizar splits (rateio)
    if (dto.splits) {
      await this.prisma.transactionSplit.deleteMany({
        where: { financialRecordId: id },
      });

      if (dto.splits.length > 0) {
        await this.prisma.transactionSplit.createMany({
          data: dto.splits.map((s) => ({
            tenantId,
            financialRecordId: id,
            contactId: s.contactId,
            role: s.role,
            amount: s.amount,
            percentage: s.percentage,
            description: s.description,
            notes: s.notes,
          })),
        });
      }
    }

    // Atualizar parcelas (installments) se fornecidas
    if (dto.installments && dto.installments.length > 0) {
      // Validar soma
      const installmentsSum = dto.installments.reduce(
        (acc, inst) => acc + (Number(inst.amount) || 0),
        0,
      );
      const roundedSum = Math.round(installmentsSum * 100) / 100;
      const roundedAmount = Math.round(amount * 100) / 100;

      if (Math.abs(roundedSum - roundedAmount) > 0.01) {
        throw new BadRequestException(
          `A soma das parcelas (${roundedSum}) não confere com o valor total (${roundedAmount}).`,
        );
      }

      // Remover parcelas antigas
      await this.prisma.financialRecord.deleteMany({
        where: { parentId: id },
      });

      // Criar novas parcelas
      const totalInst = dto.installments.length;
      await this.prisma.financialRecord.createMany({
        data: dto.installments.map((inst, i) => ({
          tenantId,
          processId: data.processId || existing.processId,
          bankAccountId: data.bankAccountId || existing.bankAccountId,
          categoryId: data.categoryId || existing.categoryId,
          description: `${data.description || existing.description} - Parcela ${inst.installmentNumber}/${totalInst}`,
          amount: inst.amount,
          amountFinal: inst.amount,
          dueDate: new Date(inst.dueDate),
          status:
            i === 0 && (data.status || existing.status) === "PAID"
              ? "PAID"
              : "PENDING",
          paymentDate:
            i === 0 && (data.status || existing.status) === "PAID"
              ? data.paymentDate || existing.paymentDate
              : null,
          type: data.type || existing.type,
          category:
            data.category !== undefined ? data.category : existing.category,
          paymentMethod:
            data.paymentMethod !== undefined
              ? data.paymentMethod
              : existing.paymentMethod,
          parentId: id,
          installmentNumber: inst.installmentNumber,
          totalInstallments: totalInst,
          periodicity: data.periodicity || existing.periodicity,
          paymentConditionId: dto.paymentConditionId,
        })),
      });

      // O registro-mãe mantém o valor total; relatórios ignoram containers para não duplicar.
      data.amount = roundedAmount;
      data.amountFinal = this.calculateFinalAmount(
        roundedAmount,
        fine,
        interest,
        monetaryCorrection,
        discount,
        discountType,
      );
      data.totalInstallments = totalInst;
    }

    return this.prisma.financialRecord.update({
      where: { id },
      data,
      include: this.defaultRecordInclude,
    });
  }

  async uploadAttachments(id: string, tenantId: string, files: Array<any>) {
    const existing = await this.prisma.financialRecord.findUnique({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException("Registro financeiro não encontrado");
    }

    const newMetadata = await this.processAttachments(files, existing.metadata);

    return this.prisma.financialRecord.update({
      where: { id },
      data: {
        metadata: newMetadata,
      },
    });
  }

  async deleteFinancialRecord(id: string, tenantId: string) {
    await this.findOneFinancialRecord(id, tenantId);

    // Deletar filhos (parcelas) também
    await this.prisma.financialRecord.deleteMany({
      where: { parentId: id, tenantId },
    });

    return this.prisma.financialRecord.delete({
      where: { id },
    });
  }

  // ==================== PARCELAMENTO ====================

  /**
   * Gera N parcelas a partir de um valor total.
   * Cria um registro "mãe" e N registros filhos vinculados pelo parentId.
   */
  async createInstallments(dto: CreateInstallmentsDto) {
    const installmentAmount =
      Math.floor((dto.totalAmount / dto.numInstallments) * 100) / 100;
    const remainder =
      Math.round(
        (dto.totalAmount - installmentAmount * dto.numInstallments) * 100,
      ) / 100;

    // 1) Criar registro mãe
    const parent = await this.prisma.financialRecord.create({
      data: {
        tenantId: dto.tenantId,
        processId: dto.processId,
        bankAccountId: dto.bankAccountId,
        categoryId: dto.categoryId,
        description: dto.description,
        amount: dto.totalAmount,
        dueDate: new Date(dto.firstDueDate),
        status: "PENDING",
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes
          ? `${dto.notes} | Parcelado em ${dto.numInstallments}x`
          : `Parcelado em ${dto.numInstallments}x`,
        totalInstallments: dto.numInstallments,
        periodicity: dto.periodicity,
        amountFinal: dto.totalAmount,
        parties: dto.parties
          ? {
              create: dto.parties.map((p) => ({
                tenantId: dto.tenantId,
                contactId: p.contactId,
                role: p.role,
                amount: p.amount,
              })),
            }
          : undefined,
      },
    });

    // 2) Gerar as parcelas filhas
    const installments = [];
    for (let i = 0; i < dto.numInstallments; i++) {
      const dueDate = this.calculateNextDueDate(
        dto.firstDueDate,
        dto.periodicity,
        i,
      );

      // Última parcela absorve o resto (centavos de arredondamento)
      const amount =
        i === dto.numInstallments - 1
          ? installmentAmount + remainder
          : installmentAmount;

      installments.push({
        tenantId: dto.tenantId,
        processId: dto.processId,
        bankAccountId: dto.bankAccountId,
        categoryId: dto.categoryId,
        description: `${dto.description} - Parcela ${i + 1}/${dto.numInstallments}`,
        amount,
        amountFinal: amount,
        dueDate,
        status: "PENDING",
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        parentId: parent.id,
        installmentNumber: i + 1,
        totalInstallments: dto.numInstallments,
        periodicity: dto.periodicity,
      });
    }

    await this.prisma.financialRecord.createMany({
      data: installments,
    });

    // 3) Retornar o registro mãe com todas as parcelas
    return this.findOneFinancialRecord(parent.id, dto.tenantId);
  }

  private calculateNextDueDate(
    firstDueDate: string,
    periodicity: string,
    index: number,
  ): Date {
    const date = new Date(firstDueDate);

    switch (periodicity?.toUpperCase() || "MENSAL") {
      case "WEEKLY":
      case "SEMANAL":
        date.setDate(date.getDate() + 7 * index);
        break;
      case "BIWEEKLY":
      case "QUINZENAL":
        date.setDate(date.getDate() + 14 * index);
        break;
      case "YEARLY":
      case "ANUAL":
        date.setFullYear(date.getFullYear() + index);
        break;
      case "MONTHLY":
      case "MENSAL":
      default:
        date.setMonth(date.getMonth() + index);
        break;
    }

    return date;
  }

  // ==================== PAGAMENTO PARCIAL ====================

  /**
   * Processa pagamento parcial:
   * - Se amountPaid < valor devido: marca como PARTIAL, cria registro residual
   * - Se amountPaid >= valor devido: marca como PAID
   */
  async processPartialPayment(recordId: string, dto: PartialPaymentDto) {
    const record = await this.findOneFinancialRecord(recordId, dto.tenantId);

    const totalDue = record.amountFinal
      ? Number(record.amountFinal)
      : Number(record.amount);

    if (dto.amountPaid <= 0) {
      throw new BadRequestException("Valor pago deve ser maior que zero");
    }

    if (dto.amountPaid >= totalDue) {
      // Pagamento total - marcar como PAID
      return this.prisma.financialRecord.update({
        where: { id: recordId },
        data: {
          status: "PAID",
          paymentDate: new Date(dto.paymentDate),
          amountPaid: dto.amountPaid,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId,
          notes: dto.notes
            ? `${record.notes || ""} | ${dto.notes}`
            : record.notes,
        },
        include: this.defaultRecordInclude,
      });
    }

    // Pagamento parcial
    const remainingAmount = Math.round((totalDue - dto.amountPaid) * 100) / 100;

    // 1) Marcar original como PARTIAL
    await this.prisma.financialRecord.update({
      where: { id: recordId },
      data: {
        status: "PARTIAL",
        paymentDate: new Date(dto.paymentDate),
        amountPaid: dto.amountPaid,
        paymentMethod: dto.paymentMethod,
        bankAccountId: dto.bankAccountId,
        notes: `${record.notes || ""} | Pagamento parcial: R$ ${dto.amountPaid.toFixed(2)} de R$ ${totalDue.toFixed(2)}`,
      },
    });

    // 2) Criar registro residual com o saldo devedor
    const residual = await this.prisma.financialRecord.create({
      data: {
        tenantId: dto.tenantId,
        processId: record.processId,
        bankAccountId: record.bankAccountId,
        categoryId: record.categoryId,
        description: `RESIDUAL: ${record.description} (Saldo de R$ ${remainingAmount.toFixed(2)})`,
        amount: remainingAmount,
        amountFinal: remainingAmount,
        dueDate: record.dueDate, // Mantém o vencimento original
        status: "PENDING",
        type: record.type,
        category: record.category,
        paymentMethod: record.paymentMethod,
        parentId: record.parentId || recordId, // Vincula ao pai ou ao próprio
        isResidual: true,
        notes: `Saldo residual do registro ${record.description}`,
      },
      include: this.defaultRecordInclude,
    });

    // 3) Retornar ambos (original atualizado + residual)
    const updatedOriginal = await this.findOneFinancialRecord(
      recordId,
      dto.tenantId,
    );

    return {
      original: updatedOriginal,
      residual,
      message: `Pagamento parcial processado. Saldo residual: R$ ${remainingAmount.toFixed(2)}`,
    };
  }

  // ==================== LIQUIDAÇÃO COM ENCARGOS ====================

  /**
   * Liquida um registro financeiro calculando o valor final
   * com multa, juros, correção e descontos.
   */
  async settleRecord(recordId: string, dto: SettleRecordDto, files?: any[]) {
    const record = await this.findOneFinancialRecord(recordId, dto.tenantId);

    if (record.status === "PAID") {
      throw new BadRequestException("Este registro já foi pago");
    }

    if (record.status === "CANCELLED") {
      throw new BadRequestException("Este registro está cancelado");
    }

    const amountFinal = this.calculateFinalAmount(
      Number(record.amount),
      dto.fine,
      dto.interest,
      dto.monetaryCorrection,
      dto.discount,
      dto.discountType,
    );
    const metadata = await this.processAttachments(
      files,
      (record as any).metadata,
    );

    // Utilize Prisma transaction para garantir que ambas operações ocorram
    const [updatedRecord] = await this.prisma.$transaction([
      this.prisma.financialRecord.update({
        where: { id: recordId },
        data: {
          status: "PAID",
          paymentDate: new Date(dto.paymentDate),
          fine: dto.fine,
          interest: dto.interest,
          monetaryCorrection: dto.monetaryCorrection,
          discount: dto.discount,
          discountType: dto.discountType,
          amountFinal,
          amountPaid: amountFinal,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId || record.bankAccountId,
          metadata,
          notes: dto.notes
            ? `${record.notes || ""} | Liquidado: ${dto.notes}`
            : `${record.notes || ""} | Liquidado em ${dto.paymentDate}`,
        },
      }),

      // Atualizar o saldo da conta associada
      ...(dto.bankAccountId || record.bankAccountId
        ? [
            this.prisma.bankAccount.update({
              where: { id: dto.bankAccountId || record.bankAccountId! },
              data: {
                balance: {
                  [record.type === "INCOME" ? "increment" : "decrement"]:
                    amountFinal,
                },
              },
            }),
          ]
        : []),
    ]);

    return this.findOneFinancialRecord(recordId, dto.tenantId);
  }

  // ==================== RATEIO (TRANSACTION SPLITS) ====================

  async createSplits(
    recordId: string,
    tenantId: string,
    splits: CreateTransactionSplitDto[],
  ) {
    const record = await this.findOneFinancialRecord(recordId, tenantId);

    // Validar soma do rateio
    const totalSplit = splits.reduce((sum, s) => sum + Number(s.amount), 0);
    const recordAmount = Number(record.amountFinal || record.amount);

    if (Math.abs(totalSplit - recordAmount) > 0.01) {
      throw new BadRequestException(
        `Soma do rateio (R$ ${totalSplit.toFixed(2)}) difere do valor da transação (R$ ${recordAmount.toFixed(2)})`,
      );
    }

    // Limpar splits existentes
    await this.prisma.transactionSplit.deleteMany({
      where: { financialRecordId: recordId },
    });

    // Criar novos
    await this.prisma.transactionSplit.createMany({
      data: splits.map((s) => ({
        tenantId,
        financialRecordId: recordId,
        contactId: s.contactId,
        role: s.role,
        amount: s.amount,
        percentage: s.percentage,
        description: s.description,
        notes: s.notes,
      })),
    });

    return this.findOneFinancialRecord(recordId, tenantId);
  }

  async getSplits(recordId: string, tenantId: string) {
    return this.prisma.transactionSplit.findMany({
      where: { financialRecordId: recordId, tenantId },
    });
  }

  // ==================== PARTES DA TRANSAÇÃO (FINANCIAL PARTIES) ====================

  async findPartiesByRecord(recordId: string, tenantId: string) {
    return this.prisma.financialParty.findMany({
      where: { financialRecordId: recordId, tenantId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            document: true,
            personType: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async addPartyToRecord(
    recordId: string,
    tenantId: string,
    data: { contactId: string; role: string; amount?: number; notes?: string },
  ) {
    // Verificar se o registro existe
    const record = await this.prisma.financialRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record)
      throw new NotFoundException("Registro financeiro não encontrado");

    // Verificar duplicidade (mesma pessoa com mesmo role)
    const existing = await this.prisma.financialParty.findFirst({
      where: {
        financialRecordId: recordId,
        contactId: data.contactId,
        role: data.role,
      },
    });
    if (existing)
      throw new BadRequestException(
        "Este contato já está vinculado com este papel nesta transação",
      );

    return this.prisma.financialParty.create({
      data: {
        tenantId,
        financialRecordId: recordId,
        contactId: data.contactId,
        role: data.role,
        amount: data.amount,
        notes: data.notes,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            document: true,
            personType: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  async addPartyWithQuickContact(
    recordId: string,
    tenantId: string,
    data: {
      name: string;
      document?: string;
      phone?: string;
      email?: string;
      personType?: string;
      role: string;
      amount?: number;
    },
  ) {
    // Verificar se o registro existe
    const record = await this.prisma.financialRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record)
      throw new NotFoundException("Registro financeiro não encontrado");

    // Criar contato rápido
    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        name: data.name,
        document: data.document,
        phone: data.phone,
        email: data.email,
        personType: data.personType || "PF",
      },
    });

    // Vincular como parte
    return this.prisma.financialParty.create({
      data: {
        tenantId,
        financialRecordId: recordId,
        contactId: contact.id,
        role: data.role,
        amount: data.amount,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            document: true,
            personType: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  async removePartyFromRecord(partyId: string, tenantId: string) {
    const party = await this.prisma.financialParty.findFirst({
      where: { id: partyId, tenantId },
    });
    if (!party) throw new NotFoundException("Parte não encontrada");

    return this.prisma.financialParty.delete({
      where: { id: partyId },
    });
  }

  // ==================== CATEGORIAS FINANCEIRAS ====================

  async createCategory(
    tenantId: string,
    data: {
      name: string;
      type?: string;
      color?: string;
      icon?: string;
      parentId?: string;
    },
  ) {
    const existing = await this.prisma.financialCategory.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      return existing; // Retornar existente em vez de erro (combobox dinâmico)
    }

    return this.prisma.financialCategory.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type || "BOTH",
        color: data.color,
        icon: data.icon,
        parentId: data.parentId,
      },
    });
  }

  async findAllCategories(tenantId: string, type?: string) {
    const where: any = { tenantId, active: true };
    if (type) where.type = { in: [type, "BOTH"] };

    return this.prisma.financialCategory.findMany({
      where,
      include: {
        children: true,
        _count: { select: { records: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async deleteCategory(id: string, tenantId: string) {
    return this.prisma.financialCategory.update({
      where: { id },
      data: { active: false },
    });
  }

  // ==================== BANK ACCOUNTS ====================

  async createBankAccount(dto: CreateBankAccountDto) {
    try {
      const balance = dto.balance !== undefined ? dto.balance : 0;

      if (balance < 0) {
        throw new BadRequestException("Saldo não pode ser negativo");
      }

      if (dto.contactId) {
        const contact = await this.prisma.contact.findFirst({
          where: { id: dto.contactId, tenantId: dto.tenantId },
        });

        if (!contact) {
          throw new BadRequestException("Titular não encontrado");
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
      console.error("Erro ao criar conta bancária:", error);
      throw new InternalServerErrorException("Erro ao criar conta bancária");
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
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneBankAccount(id: string, tenantId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        financialRecords: {
          take: 10,
          orderBy: { dueDate: "desc" },
        },
      },
    });

    if (!account) {
      throw new NotFoundException("Conta bancária não encontrada");
    }

    return account;
  }

  async updateBankAccount(
    id: string,
    tenantId: string,
    dto: UpdateBankAccountDto,
  ) {
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
        { name: { contains: search, mode: "insensitive" } },
        { pfDetails: { cpf: { contains: search } } },
        { pjDetails: { cnpj: { contains: search } } },
      ];
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        personType: true,
        category: true,
        pfDetails: { select: { cpf: true } },
        pjDetails: { select: { cnpj: true } },
      },
      take: 50,
      orderBy: { name: "asc" },
    });

    return contacts.map((c) => ({
      id: c.id,
      name: c.name,
      personType: c.personType,
      category: c.category,
      cpf: c.pfDetails?.cpf,
      cnpj: c.pjDetails?.cnpj,
    }));
  }

  // ==================== DASHBOARD & REPORTS ====================

  async getDashboard(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = this.buildEffectiveRecordWhere(tenantId);

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    const records = await this.prisma.financialRecord.findMany({
      where,
      orderBy: { dueDate: "desc" },
    });

    const totalIncome = records
      .filter((r) => r.type === "INCOME" && r.status === "PAID")
      .reduce(
        (sum, r) => sum + Number(r.amountPaid || r.amountFinal || r.amount),
        0,
      );

    const totalExpense = records
      .filter((r) => r.type === "EXPENSE" && r.status === "PAID")
      .reduce(
        (sum, r) => sum + Number(r.amountPaid || r.amountFinal || r.amount),
        0,
      );

    const pendingIncome = records
      .filter(
        (r) =>
          r.type === "INCOME" &&
          (r.status === "PENDING" || r.status === "PARTIAL"),
      )
      .reduce((sum, r) => sum + Number(r.amountFinal || r.amount), 0);

    const pendingExpense = records
      .filter(
        (r) =>
          r.type === "EXPENSE" &&
          (r.status === "PENDING" || r.status === "PARTIAL"),
      )
      .reduce((sum, r) => sum + Number(r.amountFinal || r.amount), 0);

    const overdueRecords = records.filter(
      (r) =>
        (r.status === "PENDING" || r.status === "PARTIAL") &&
        new Date(r.dueDate) < new Date(),
    );

    const partialRecords = records.filter((r) => r.status === "PARTIAL");

    const byCategory = records.reduce(
      (acc, record) => {
        const cat = record.category || "Sem categoria";
        if (!acc[cat]) {
          acc[cat] = { income: 0, expense: 0 };
        }
        if (record.status === "PAID") {
          if (record.type === "INCOME") {
            acc[cat].income += Number(
              record.amountPaid || record.amountFinal || record.amount,
            );
          } else {
            acc[cat].expense += Number(
              record.amountPaid || record.amountFinal || record.amount,
            );
          }
        }
        return acc;
      },
      {} as Record<string, { income: number; expense: number }>,
    );

    const byMonth = records.reduce(
      (acc, record) => {
        const month = new Date(record.dueDate).toISOString().slice(0, 7);
        if (!acc[month]) {
          acc[month] = { income: 0, expense: 0 };
        }
        if (record.status === "PAID") {
          if (record.type === "INCOME") {
            acc[month].income += Number(
              record.amountPaid || record.amountFinal || record.amount,
            );
          } else {
            acc[month].expense += Number(
              record.amountPaid || record.amountFinal || record.amount,
            );
          }
        }
        return acc;
      },
      {} as Record<string, { income: number; expense: number }>,
    );

    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { tenantId, isActive: true },
    });

    const totalBalance = bankAccounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0,
    );

    return {
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        pendingIncome,
        pendingExpense,
        overdueCount: overdueRecords.length,
        partialCount: partialRecords.length,
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
      where: {
        ...this.buildEffectiveRecordWhere(tenantId),
        processId,
      },
      orderBy: { dueDate: "desc" },
    });

    const totalIncome = records
      .filter((r) => r.type === "INCOME")
      .reduce((sum, r) => sum + Number(r.amountFinal || r.amount), 0);

    const totalExpense = records
      .filter((r) => r.type === "EXPENSE")
      .reduce((sum, r) => sum + Number(r.amountFinal || r.amount), 0);

    const paid = records
      .filter((r) => r.status === "PAID")
      .reduce(
        (sum, r) => sum + Number(r.amountPaid || r.amountFinal || r.amount),
        0,
      );

    const pending = records
      .filter((r) => r.status === "PENDING" || r.status === "PARTIAL")
      .reduce((sum, r) => sum + Number(r.amountFinal || r.amount), 0);

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
