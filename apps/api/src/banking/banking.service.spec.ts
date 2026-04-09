import { BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService', () => {
  const integration = {
    id: 'integration-1',
    tenantId: 'tenant-1',
    provider: 'INTER',
    isActive: true,
    bankAccountId: 'bank-account-1',
  };

  const financialRecord = {
    id: 'record-1',
    tenantId: 'tenant-1',
    description: 'Honorarios abril',
    type: 'INCOME',
    status: 'PENDING',
    amount: 150,
    amountFinal: 150,
    amountPaid: 0,
    dueDate: new Date('2026-04-30T00:00:00.000Z'),
    parties: [
      {
        role: 'DEBTOR',
        contact: {
          id: 'contact-1',
          name: 'Cliente XPTO',
          personType: 'PF',
          document: '12345678901',
          email: 'cliente@example.com',
          phone: '31999999999',
          whatsapp: null,
          pfDetails: null,
          pjDetails: null,
          addresses: [],
        },
      },
    ],
  };

  const createService = () => {
    const prisma = {
      bankAccount: {
        findFirst: jest.fn(),
      },
      bankIntegration: {
        findFirst: jest.fn(),
      },
      financialRecord: {
        findFirst: jest.fn(),
      },
      bankCharge: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      bankPaymentRequest: {
        findMany: jest.fn(),
      },
    };

    const securityService = {
      listSecrets: jest.fn().mockResolvedValue([]),
      getSecretById: jest.fn().mockResolvedValue(null),
    };

    const interProvider = {
      provider: 'INTER',
      healthcheck: jest.fn(),
      syncTransactions: jest.fn(),
      createCharge: jest.fn(),
      createPayment: jest.fn(),
    };

    return {
      prisma,
      securityService,
      interProvider,
      service: new BankingService(
        prisma as never,
        securityService as never,
        interProvider as never,
      ),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reutiliza a cobranca em aberto quando o mesmo boleto ja existe', async () => {
    const { prisma, interProvider, service } = createService();
    prisma.bankIntegration.findFirst.mockResolvedValue(integration);
    prisma.financialRecord.findFirst.mockResolvedValue(financialRecord);
    prisma.bankCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      chargeType: 'BOLETO',
      status: 'CREATED',
      dueDate: new Date('2026-04-30T00:00:00.000Z'),
      amount: 150,
      bankIntegration: {
        id: integration.id,
        displayName: 'Banco Inter',
        provider: 'INTER',
      },
      financialRecord: {
        id: financialRecord.id,
        description: financialRecord.description,
        amount: financialRecord.amount,
        dueDate: financialRecord.dueDate,
      },
    });

    const result = await service.createCharge('tenant-1', {
      bankIntegrationId: integration.id,
      financialRecordId: financialRecord.id,
      dueDate: '2026-04-30',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'charge-1',
        reusedExisting: true,
      }),
    );
    expect(interProvider.createCharge).not.toHaveBeenCalled();
    expect(prisma.bankCharge.create).not.toHaveBeenCalled();
  });

  it('bloqueia segunda cobranca em aberto com vencimento diferente', async () => {
    const { prisma, interProvider, service } = createService();
    prisma.bankIntegration.findFirst.mockResolvedValue(integration);
    prisma.financialRecord.findFirst.mockResolvedValue(financialRecord);
    prisma.bankCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      chargeType: 'BOLETO',
      status: 'CREATED',
      dueDate: new Date('2026-04-30T00:00:00.000Z'),
      amount: 150,
      bankIntegration: {
        id: integration.id,
        displayName: 'Banco Inter',
        provider: 'INTER',
      },
      financialRecord: {
        id: financialRecord.id,
        description: financialRecord.description,
        amount: financialRecord.amount,
        dueDate: financialRecord.dueDate,
      },
    });

    await expect(
      service.createCharge('tenant-1', {
        bankIntegrationId: integration.id,
        financialRecordId: financialRecord.id,
        dueDate: '2026-05-05',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(interProvider.createCharge).not.toHaveBeenCalled();
    expect(prisma.bankCharge.create).not.toHaveBeenCalled();
  });

  it('usa boleto como padrao ao criar cobranca pela API', async () => {
    const { prisma, interProvider, service } = createService();
    prisma.bankIntegration.findFirst.mockResolvedValue(integration);
    prisma.financialRecord.findFirst.mockResolvedValue(financialRecord);
    prisma.bankCharge.findFirst.mockResolvedValue(null);
    interProvider.createCharge.mockResolvedValue({
      success: true,
      mode: 'LIVE',
      chargeType: 'BOLETO',
      status: 'CREATED',
      externalChargeId: 'inter-charge-1',
      barcode: '34191790010104351004791020150008291070026000',
      digitableLine: '34191.79001 01043.510047 91020.150008 2 91070026000',
      message: 'ok',
    });
    prisma.bankCharge.create.mockResolvedValue({
      id: 'charge-new',
      chargeType: 'BOLETO',
      status: 'CREATED',
      amount: 150,
      bankIntegration: {
        id: integration.id,
        displayName: 'Banco Inter',
        provider: 'INTER',
      },
      financialRecord: {
        id: financialRecord.id,
        description: financialRecord.description,
        amount: financialRecord.amount,
        dueDate: financialRecord.dueDate,
      },
    });

    const result = await service.createCharge('tenant-1', {
      bankIntegrationId: integration.id,
      financialRecordId: financialRecord.id,
      dueDate: '2026-04-30',
    });

    expect(interProvider.createCharge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        chargeType: 'BOLETO',
        dueDate: '2026-04-30',
      }),
    );
    expect(prisma.bankCharge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargeType: 'BOLETO',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'charge-new',
        reusedExisting: false,
      }),
    );
  });
});
