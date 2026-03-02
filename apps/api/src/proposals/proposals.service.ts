import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: any) {
    const { contactId, totalAmount, notes, validUntil, items } = data;
    
    return this.prisma.proposal.create({
      data: {
        tenantId,
        contactId,
        status: 'DRAFT',
        totalAmount,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        items: {
          create: items.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
            total: i.total,
          }))
        }
      },
      include: { items: true }
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.proposal.findFirst({
        where: { id, tenantId },
        include: { items: { include: { product: true } }, contact: true, invoice: true }
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({
        where: { id, tenantId },
        include: { items: true, contact: true }
      });

      if (!proposal) throw new BadRequestException('Orçamento não encontrado');

      if (proposal.status === 'APPROVED' && status === 'APPROVED') {
        throw new BadRequestException('Este orçamento já foi aprovado e processado');
      }

      const updated = await tx.proposal.update({
        where: { id },
        data: { status }
      });

      if (status === 'APPROVED') {
        // 1. Generate Financial Record (Receita)
        const financialRecord = await tx.financialRecord.create({
          data: {
            tenantId,
            description: `Venda Ref. Orçamento #${proposal.code} - ${proposal.contact.name}`,
            amount: proposal.totalAmount,
            dueDate: new Date(),
            status: 'PENDING',
            type: 'INCOME',
            category: 'VENDAS',
          }
        });

        // 2. Setup Invoice
        await tx.invoice.create({
          data: {
            tenantId,
            proposalId: proposal.id,
            contactId: proposal.contactId,
            type: 'OUTPUT',
            status: 'PENDING',
            financialId: financialRecord.id,
          }
        });

        // 3. Inventory movements
        for (const item of proposal.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && product.type === 'PRODUCT') {
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: product.currentStock - item.quantity }
            });

            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                type: 'OUT',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.total,
                reason: `Venda - Automático via Orçamento #${proposal.code}`,
              }
            });
          }
        }
      }

      return updated;
    });
  }
}
