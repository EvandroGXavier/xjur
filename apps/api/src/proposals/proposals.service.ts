import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

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
            items?.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount || 0,
              total: i.total,
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

    // Verify ownership
    const existing = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new BadRequestException("Orçamento não encontrado");

    return this.prisma.$transaction(async (tx) => {
      // Clear previous items to replace with new ones
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
              items?.map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                discount: i.discount || 0,
                total: i.total,
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
      if (!existing) throw new BadRequestException("Orçamento não encontrado");

      // Reverter estoque caso já tivesse sido faturado (aprovado)
      if (existing.status === "APPROVED") {
        for (const item of existing.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (product && product.type === "PRODUCT") {
            // Estorno: Devolver ao estoque
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: product.currentStock + item.quantity },
            });

            // Registro de estorno
            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                type: "IN",
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.total,
                reason: `Estorno - Orçamento Cancelado #${existing.code}`,
              },
            });
          }
        }
      }

      // Remover Invoice (NF) atrelada
      await tx.invoice.deleteMany({
        where: { proposalId: id },
      });

      // Remover Títulos a Receber (Financeiro) atrelados
      await tx.financialRecord.deleteMany({
        where: { proposalId: id },
      });

      // Finalmente, deletar os itens e a proposta
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

      if (!proposal) throw new BadRequestException("Orçamento não encontrado");

      if (proposal.status === "APPROVED" && status === "APPROVED") {
        throw new BadRequestException(
          "Este orçamento já foi aprovado e processado",
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
          } catch (e) {}
        }

        let mainFinancialId = null;

        if (
          customInstallments &&
          Array.isArray(customInstallments) &&
          customInstallments.length > 0
        ) {
          for (let i = 0; i < customInstallments.length; i++) {
            const inst = customInstallments[i];
            const fin = await tx.financialRecord.create({
              data: {
                tenantId,
                description: `Venda Ref. Orçamento #${proposal.code} - Parcela ${inst.installment || i + 1}/${customInstallments.length} - ${proposal.contact.name}`,
                amount: parseFloat(inst.amount),
                dueDate: new Date(inst.dueDate),
                status: "PENDING",
                type: "INCOME",
                category: "VENDAS",
                installmentNumber: inst.installment || i + 1,
                totalInstallments: customInstallments.length,
                paymentConditionId: proposal.paymentConditionId || null,
                proposalId: proposal.id,
              },
            });
            if (i === 0) mainFinancialId = fin.id;
          }
        } else {
          // 1. Generate Financial Record (Receita)
          const financialRecord = await tx.financialRecord.create({
            data: {
              tenantId,
              description: `Venda Ref. Orçamento #${proposal.code} - ${proposal.contact.name}`,
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

        // 2. Setup Invoice
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

        // 3. Inventory movements
        for (const item of proposal.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (product && product.type === "PRODUCT") {
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: product.currentStock - item.quantity },
            });

            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                type: "OUT",
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.total,
                reason: `Venda - Automático via Orçamento #${proposal.code}`,
              },
            });
          }
        }
      }

      return updated;
    });
  }
}
