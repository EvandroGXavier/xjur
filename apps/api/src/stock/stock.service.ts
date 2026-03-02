import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalances(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, type: 'PRODUCT', isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        unit: true,
        costPrice: true,
        sellPrice: true,
      },
      orderBy: { name: 'asc' }
    });
  }

  async getAlerts(tenantId: string) {
    // Find products where current stock is lower or equal to min stock
    const products = await this.prisma.product.findMany({
      where: { tenantId, type: 'PRODUCT', isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        unit: true,
      }
    });

    return products.filter(p => p.minStock > 0 && p.currentStock <= p.minStock);
  }

  async adjustStock(tenantId: string, productId: string, data: { quantity: number, type: 'IN' | 'OUT' | 'ADJUST', reason?: string }) {
    return this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
            where: { id: productId, tenantId }
        });
        if (!product) throw new Error('Produto não encontrado');

        let newStock = product.currentStock;
        if (data.type === 'IN') newStock += data.quantity;
        else if (data.type === 'OUT') newStock -= data.quantity;
        else if (data.type === 'ADJUST') newStock = data.quantity; // Adjustment assumes overriding

        await tx.product.update({
            where: { id: product.id },
            data: { currentStock: newStock }
        });

        const movementQty = data.type === 'ADJUST' ? Math.abs(newStock - product.currentStock) : data.quantity;
        const movementType = data.type === 'ADJUST' ? (newStock > product.currentStock ? 'IN' : 'OUT') : data.type;

        return tx.inventoryMovement.create({
            data: {
                tenantId,
                productId,
                type: movementType,
                quantity: movementQty,
                reason: data.reason || 'Ajuste manual de estoque',
            }
        });
    });
  }
}
