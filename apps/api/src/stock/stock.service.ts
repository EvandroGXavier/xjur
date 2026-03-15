import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovement, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type StockMovementType = 'IN' | 'OUT' | 'ADJUST';
type PrismaExecutor = PrismaService | Prisma.TransactionClient;

interface StockProductUpdates {
  costPrice?: number | null;
  sellPrice?: number | null;
}

export interface StockMovementInput {
  tenantId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  unitPrice?: number | null;
  totalPrice?: number | null;
  allowNegativeStock?: boolean;
  skipIfService?: boolean;
  productUpdates?: StockProductUpdates;
}

export interface StockMovementResult {
  product: Product;
  previousStock: number;
  currentStock: number;
  movement: InventoryMovement | null;
  changed: boolean;
}

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
      orderBy: { name: 'asc' },
    });
  }

  async getAlerts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        type: 'PRODUCT',
        isActive: true,
        minStock: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        unit: true,
      },
      orderBy: [{ currentStock: 'asc' }, { name: 'asc' }],
    });

    return products.filter((product) => product.currentStock <= product.minStock);
  }

  async adjustStock(
    tenantId: string,
    productId: string,
    data: { quantity: number; type: StockMovementType; reason?: string },
  ) {
    return this.prisma.$transaction((tx) =>
      this.applyMovement(tx, {
        tenantId,
        productId,
        quantity: data.quantity,
        type: data.type,
        reason: data.reason,
      }),
    );
  }

  async applyMovement(
    executor: PrismaExecutor,
    data: StockMovementInput,
  ): Promise<StockMovementResult> {
    const product = await this.getProductOrThrow(
      executor,
      data.tenantId,
      data.productId,
    );

    if (product.type !== 'PRODUCT') {
      if (data.skipIfService) {
        return {
          product,
          previousStock: product.currentStock,
          currentStock: product.currentStock,
          movement: null,
          changed: false,
        };
      }

      throw new BadRequestException(
        'Servicos nao possuem controle de estoque.',
      );
    }

    const quantity = this.normalizeQuantity(data.type, data.quantity);
    const previousStock = product.currentStock;
    const currentStock = this.calculateStock(product, quantity, data);
    const movementQuantity =
      data.type === 'ADJUST' ? Math.abs(currentStock - previousStock) : quantity;

    const productUpdateData: Prisma.ProductUpdateInput = {
      currentStock,
    };

    if (data.productUpdates?.costPrice !== undefined) {
      productUpdateData.costPrice = data.productUpdates.costPrice;
    }

    if (data.productUpdates?.sellPrice !== undefined) {
      productUpdateData.sellPrice = data.productUpdates.sellPrice;
    }

    const hasStockChange = currentStock !== previousStock;
    const hasProductUpdates =
      data.productUpdates?.costPrice !== undefined ||
      data.productUpdates?.sellPrice !== undefined;

    if (!hasStockChange && !hasProductUpdates) {
      return {
        product,
        previousStock,
        currentStock,
        movement: null,
        changed: false,
      };
    }

    const updatedProduct = await executor.product.update({
      where: { id: product.id },
      data: productUpdateData,
    });

    let movement: InventoryMovement | null = null;

    if (movementQuantity > 0) {
      const unitPrice = this.normalizePrice(data.unitPrice, 'unitPrice');
      const totalPrice =
        this.normalizePrice(data.totalPrice, 'totalPrice') ??
        (unitPrice !== undefined
          ? Number((unitPrice * movementQuantity).toFixed(2))
          : undefined);

      movement = await executor.inventoryMovement.create({
        data: {
          tenantId: data.tenantId,
          productId: data.productId,
          type: data.type,
          quantity: movementQuantity,
          unitPrice,
          totalPrice,
          reason:
            data.reason ??
            (data.type === 'ADJUST'
              ? `Ajuste de estoque (${previousStock} -> ${currentStock})`
              : 'Movimentacao de estoque'),
        },
      });
    }

    return {
      product: updatedProduct,
      previousStock,
      currentStock,
      movement,
      changed: true,
    };
  }

  async getConfig(tenantId: string) {
    let config = await this.prisma.inventoryConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      config = await this.prisma.inventoryConfig.create({
        data: { tenantId, profitMargin: 30 },
      });
    }

    return config;
  }

  async updateConfig(tenantId: string, data: { profitMargin: number }) {
    const profitMargin = Number(data.profitMargin);

    if (!Number.isFinite(profitMargin) || profitMargin < 0) {
      throw new BadRequestException(
        'A margem de lucro deve ser um numero maior ou igual a zero.',
      );
    }

    return this.prisma.inventoryConfig.upsert({
      where: { tenantId },
      update: { profitMargin },
      create: { tenantId, profitMargin },
    });
  }

  private async getProductOrThrow(
    executor: PrismaExecutor,
    tenantId: string,
    productId: string,
  ) {
    const product = await executor.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    return product;
  }

  private normalizeQuantity(type: StockMovementType, rawQuantity: number) {
    const quantity = Number(rawQuantity);

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
      throw new BadRequestException(
        'A quantidade precisa ser um numero inteiro valido.',
      );
    }

    if (type === 'ADJUST') {
      if (quantity < 0) {
        throw new BadRequestException(
          'O estoque ajustado nao pode ser negativo.',
        );
      }

      return quantity;
    }

    if (quantity <= 0) {
      throw new BadRequestException(
        'A quantidade precisa ser maior que zero.',
      );
    }

    return quantity;
  }

  private normalizePrice(rawValue: number | null | undefined, field: string) {
    if (rawValue === null || rawValue === undefined) {
      return undefined;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(
        `O campo ${field} precisa ser um numero maior ou igual a zero.`,
      );
    }

    return value;
  }

  private calculateStock(
    product: Product,
    quantity: number,
    data: StockMovementInput,
  ) {
    if (data.type === 'IN') {
      return product.currentStock + quantity;
    }

    if (data.type === 'OUT') {
      if (!data.allowNegativeStock && product.currentStock < quantity) {
        throw new BadRequestException(
          `Estoque insuficiente para ${product.name}. Disponivel: ${product.currentStock}.`,
        );
      }

      return product.currentStock - quantity;
    }

    return quantity;
  }
}
