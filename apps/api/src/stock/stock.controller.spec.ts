import { StockController } from './stock.controller';

describe('StockController', () => {
  const createController = () => {
    const stockService = {
      getBalances: jest.fn(),
      getAlerts: jest.fn(),
      adjustStock: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    };

    return {
      stockService,
      controller: new StockController(stockService as never),
    };
  };

  it('encaminha o tenant para consultar saldos', () => {
    const { controller, stockService } = createController();
    stockService.getBalances.mockReturnValue([]);

    controller.getBalances({ tenantId: 'tenant-1' } as never);

    expect(stockService.getBalances).toHaveBeenCalledWith('tenant-1');
  });

  it('encaminha o ajuste com tenant e produto corretos', () => {
    const { controller, stockService } = createController();
    const body = { quantity: 2, type: 'IN' as const, reason: 'Compra' };

    controller.adjustStock('prod-1', body, { tenantId: 'tenant-1' } as never);

    expect(stockService.adjustStock).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      body,
    );
  });
});
