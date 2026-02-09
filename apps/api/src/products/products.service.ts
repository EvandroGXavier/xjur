
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, tenantId: string) {
    return this.prisma.product.create({
      data: {
        ...createProductDto,
        tenantId,
        currentStock: createProductDto.currentStock || 0, // Default to 0 if not provided
        minStock: createProductDto.minStock || 0,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      include: {
        supplier: {
          select: { name: true }
        }
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
           take: 10 // Last 10 movements
        }
      }
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, updateProductDto: Partial<CreateProductDto>, tenantId: string) {
    await this.findOne(id, tenantId); // Validate existence
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId); // Validate existence
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async addMovement(productId: string, createMovementDto: CreateMovementDto, tenantId: string) {
    const product = await this.findOne(productId, tenantId);

    // Calculate new stock
    let newStock = product.currentStock;
    if (createMovementDto.type === 'IN') newStock += createMovementDto.quantity;
    if (createMovementDto.type === 'OUT') newStock -= createMovementDto.quantity;
    if (createMovementDto.type === 'ADJUST') newStock = createMovementDto.quantity; // Adjust sets the exact value

    // Transaction to ensure consistency
    const [movement, updatedProduct] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          type: createMovementDto.type,
          quantity: createMovementDto.quantity,
          reason: createMovementDto.reason,
          unitPrice: createMovementDto.unitPrice,
          totalPrice: createMovementDto.unitPrice ? createMovementDto.unitPrice * createMovementDto.quantity : 0 // Rough calculation
        }
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock }
      })
    ]);

    return { movement, currentStock: updatedProduct.currentStock };
  }
}
