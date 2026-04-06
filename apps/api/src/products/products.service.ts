import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { StockService } from '../stock/stock.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async create(createProductDto: CreateProductDto, tenantId: string) {
    const { supplierId, ...rest } = this.normalizeProductPayload(createProductDto);
    await this.validateSupplier(tenantId, supplierId);
    const createData: Prisma.ProductUncheckedCreateInput = {
      ...rest,
      name: (rest.name || '').trim(),
      tenantId,
      supplierId: supplierId || null,
      currentStock: rest.currentStock ?? 0,
      minStock: rest.minStock ?? 0,
      images: rest.images || [],
      type: rest.type || 'PRODUCT',
      unit: rest.unit || 'UN',
    };

    return this.prisma.product.create({
      data: createData,
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      include: {
        supplier: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: Partial<CreateProductDto>,
    tenantId: string,
  ) {
    await this.findOne(id, tenantId);

    const { supplierId, ...rest } = this.normalizeProductPayload(updateProductDto);
    await this.validateSupplier(tenantId, supplierId);
    const updateData: Prisma.ProductUncheckedUpdateInput = {
      ...rest,
      ...(supplierId !== undefined ? { supplierId: supplierId || null } : {}),
    };

    return this.prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            movements: true,
            proposalItems: true,
            purchaseOrderItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (
      product._count.movements > 0 ||
      product._count.proposalItems > 0 ||
      product._count.purchaseOrderItems > 0
    ) {
      throw new BadRequestException(
        'Nao e possivel excluir um item com historico de estoque, compras ou orcamentos.',
      );
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }

  async addMovement(
    productId: string,
    createMovementDto: CreateMovementDto,
    tenantId: string,
  ) {
    const result = await this.prisma.$transaction((tx) =>
      this.stockService.applyMovement(tx, {
        tenantId,
        productId,
        type: createMovementDto.type,
        quantity: createMovementDto.quantity,
        reason: createMovementDto.reason,
        unitPrice: createMovementDto.unitPrice,
      }),
    );

    return { movement: result.movement, currentStock: result.currentStock };
  }

  private normalizeProductPayload(data: Partial<CreateProductDto>) {
    const type = data.type ?? 'PRODUCT';
    const minStock = this.normalizeIntegerField(data.minStock, 'minStock', 0);
    const currentStock = this.normalizeIntegerField(
      data.currentStock,
      'currentStock',
      0,
    );
    const costPrice = this.normalizePriceField(data.costPrice, 'costPrice');
    const sellPrice = this.normalizePriceField(data.sellPrice, 'sellPrice');

    return {
      ...data,
      type,
      minStock: type === 'SERVICE' ? 0 : minStock,
      currentStock: type === 'SERVICE' ? 0 : currentStock,
      costPrice,
      sellPrice,
      unit: data.unit?.trim() || 'UN',
      sku: data.sku?.trim() || undefined,
      barcode: data.barcode?.trim() || undefined,
      ncm: data.ncm?.trim() || undefined,
      cest: data.cest?.trim() || undefined,
      supplierId: data.supplierId?.trim() || undefined,
      category: data.category?.trim() || undefined,
      brand: data.brand?.trim() || undefined,
      images: (data.images || []).filter(Boolean),
    };
  }

  private async validateSupplier(tenantId: string, supplierId?: string) {
    if (!supplierId) return;

    const supplier = await this.prisma.contact.findFirst({
      where: { id: supplierId, tenantId },
      select: { id: true },
    });

    if (!supplier) {
      throw new BadRequestException('Fornecedor invalido para este tenant.');
    }
  }

  private normalizeIntegerField(
    rawValue: number | undefined,
    field: string,
    fallback: number,
  ) {
    if (rawValue === undefined || rawValue === null) {
      return fallback;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `O campo ${field} precisa ser um numero inteiro maior ou igual a zero.`,
      );
    }

    return value;
  }

  private normalizePriceField(rawValue: number | undefined, field: string) {
    if (rawValue === undefined || rawValue === null) {
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
}
