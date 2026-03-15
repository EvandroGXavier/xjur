import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StockService } from "../stock/stock.service";

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async create(tenantId: string, data: any) {
    const {
      contactId,
      totalAmount,
      notes,
      validUntil,
      deliveryDate,
      salesperson,
      special,
      paymentCondition,
      paymentConditionId,
      items,
    } = data;

    return this.prisma.proposal.create({
      data: {
        tenantId,
        contactId,
        status: "DRAFT",
        totalAmount,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        salesperson,
        special: special || false,
        paymentCondition,
        paymentConditionId,
        items: {
          create:
            items?.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
            })) || [],
        },
      },
      include: { items: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.proposal.findFirst({
      where: { id, tenantId },
      include: {
        items: { include: { product: true } },
        contact: true,
        invoice: true,
        financialRecords: true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const {
      contactId,
      totalAmount,
      notes,
      validUntil,
      deliveryDate,
      salesperson,
      special,
      paymentCondition,
      paymentConditionId,
      items,
    } = data;

    const existing = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new BadRequestException("Orcamento nao encontrado");
    }

    if (existing.status === "APPROVED") {
      throw new BadRequestException(
        "Orcamentos aprovados nao podem ser editados. Exclua ou cancele o registro para estornar.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.proposalItem.deleteMany({ where: { proposalId: id } });

      return tx.proposal.update({
        where: { id },
        data: {
          contactId,
          totalAmount,
          notes,
          validUntil: validUntil ? new Date(validUntil) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          salesperson,
          special: special || false,
          paymentCondition,
          paymentConditionId,
          items: {
            create:
              items?.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total: item.total,
              })) || [],
          },
        },
        include: { items: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.proposal.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });

      if (!existing) {
        throw new BadRequestException("Orcamento nao encontrado");
      }

      if (existing.status === "APPROVED") {
        for (const item of existing.items) {
          await this.stockService.applyMovement(tx, {
            tenantId,
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.total),
            reason: `Estorno - Orcamento Cancelado #${existing.code}`,
            skipIfService: true,
          });
        }
      }

      await tx.invoice.deleteMany({
        where: { proposalId: id },
      });

      await tx.financialRecord.deleteMany({
        where: { proposalId: id },
      });

      await tx.proposalItem.deleteMany({ where: { proposalId: id } });
      return tx.proposal.delete({ where: { id } });
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({
        where: { id, tenantId },
        include: { items: true, contact: true },
      });

      if (!proposal) {
        throw new BadRequestException("Orcamento nao encontrado");
      }

      if (proposal.status === "APPROVED") {
        throw new BadRequestException(
          status === "APPROVED"
            ? "Este orcamento ja foi aprovado e processado"
            : "Orcamentos aprovados nao podem mudar de status.",
        );
      }

      const updated = await tx.proposal.update({
        where: { id },
        data: { status },
      });

      if (status === "APPROVED") {
        let customInstallments = null;
        if (
          proposal.paymentCondition &&
          proposal.paymentCondition.startsWith("[")
        ) {
          try {
            customInstallments = JSON.parse(proposal.paymentCondition);
          } catch {
            customInstallments = null;
          }
        }

        let mainFinancialId = null;

        if (
          customInstallments &&
          Array.isArray(customInstallments) &&
          customInstallments.length > 0
        ) {
          for (let i = 0; i < customInstallments.length; i++) {
            const installment = customInstallments[i];
            const financialRecord = await tx.financialRecord.create({
              data: {
                tenantId,
                description: `Venda Ref. Orcamento #${proposal.code} - Parcela ${installment.installment || i + 1}/${customInstallments.length} - ${proposal.contact.name}`,
                amount: parseFloat(installment.amount),
                dueDate: new Date(installment.dueDate),
                status: "PENDING",
                type: "INCOME",
                category: "VENDAS",
                installmentNumber: installment.installment || i + 1,
                totalInstallments: customInstallments.length,
                paymentConditionId: proposal.paymentConditionId || null,
                proposalId: proposal.id,
              },
            });
            if (i === 0) {
              mainFinancialId = financialRecord.id;
            }
          }
        } else {
          const financialRecord = await tx.financialRecord.create({
            data: {
              tenantId,
              description: `Venda Ref. Orcamento #${proposal.code} - ${proposal.contact.name}`,
              amount: proposal.totalAmount,
              dueDate: new Date(),
              status: "PENDING",
              type: "INCOME",
              category: "VENDAS",
              proposalId: proposal.id,
            },
          });
          mainFinancialId = financialRecord.id;
        }

        await tx.invoice.create({
          data: {
            tenantId,
            proposalId: proposal.id,
            contactId: proposal.contactId,
            type: "OUTPUT",
            status: "PENDING",
            financialId: mainFinancialId,
          },
        });

        for (const item of proposal.items) {
          await this.stockService.applyMovement(tx, {
            tenantId,
            productId: item.productId,
            type: "OUT",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.total),
            reason: `Venda - Automatico via Orcamento #${proposal.code}`,
            skipIfService: true,
          });
        }
      }

      return updated;
    });
  }
}
