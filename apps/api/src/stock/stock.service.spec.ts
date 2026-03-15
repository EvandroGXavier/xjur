import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

describe('StockService', () => {
  const createService = () => {
    const prisma = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      inventoryConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };

    return {
      prisma,
      service: new StockService(prisma as never),
    };
  };

  it('retorna apenas alertas com estoque abaixo do minimo', async () => {
    const { prisma, service } = createService();
    prisma.product.findMany.mockResolvedValue([
      { id: '1', name: 'A', sku: 'A', currentStock: 1, minStock: 2, unit: 'UN' },
      { id: '2', name: 'B', sku: 'B', currentStock: 3, minStock: 2, unit: 'UN' },
    ]);

    const alerts = await service.getAlerts('tenant-1');

    expect(alerts).toEqual([
      { id: '1', name: 'A', sku: 'A', currentStock: 1, minStock: 2, unit: 'UN' },
    ]);
  });

  it('aplica saida de estoque sem permitir saldo negativo', async () => {
    const { prisma, service } = createService();
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Produto A',
      type: 'PRODUCT',
      currentStock: 5,
    });
    prisma.product.update.mockResolvedValue({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Produto A',
      type: 'PRODUCT',
      currentStock: 2,
    });
    prisma.inventoryMovement.create.mockResolvedValue({
      id: 'mov-1',
      productId: 'prod-1',
      tenantId: 'tenant-1',
      type: 'OUT',
      quantity: 3,
    });

    const result = await service.applyMovement(prisma as never, {
      tenantId: 'tenant-1',
      productId: 'prod-1',
      type: 'OUT',
      quantity: 3,
      reason: 'Venda',
    });

    expect(result.currentStock).toBe(2);
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { currentStock: 2 },
    });
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUT',
          quantity: 3,
        }),
      }),
    );
  });

  it('bloqueia saida quando o estoque e insuficiente', async () => {
    const { prisma, service } = createService();
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Produto A',
      type: 'PRODUCT',
      currentStock: 1,
    });

    await expect(
      service.applyMovement(prisma as never, {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        type: 'OUT',
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('ignora movimentacao para servico quando solicitado', async () => {
    const { prisma, service } = createService();
    prisma.product.findFirst.mockResolvedValue({
      id: 'serv-1',
      tenantId: 'tenant-1',
      name: 'Servico A',
      type: 'SERVICE',
      currentStock: 0,
    });

    const result = await service.applyMovement(prisma as never, {
      tenantId: 'tenant-1',
      productId: 'serv-1',
      type: 'OUT',
      quantity: 1,
      skipIfService: true,
    });

    expect(result.changed).toBe(false);
    expect(result.movement).toBeNull();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('retorna erro quando o produto nao existe', async () => {
    const { prisma, service } = createService();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.applyMovement(prisma as never, {
        tenantId: 'tenant-1',
        productId: 'missing',
        type: 'IN',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('nao cria movimentacao em ajuste sem alteracao', async () => {
    const { prisma, service } = createService();
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Produto A',
      type: 'PRODUCT',
      currentStock: 4,
    });

    const result = await service.adjustStock('tenant-1', 'prod-1', {
      quantity: 4,
      type: 'ADJUST',
    });

    expect(result.changed).toBe(false);
    expect(result.movement).toBeNull();
  });

  it('valida margem de lucro antes de salvar configuracao', async () => {
    const { service } = createService();

    await expect(
      service.updateConfig('tenant-1', { profitMargin: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
