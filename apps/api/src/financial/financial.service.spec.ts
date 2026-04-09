import { FinancialService } from './financial.service';

describe('FinancialService', () => {
  const createService = () => {
    const prisma = {
      financialRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      process: {
        findFirst: jest.fn(),
      },
    };

    return {
      prisma,
      service: new FinancialService(prisma as never),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inclui dados do contato nas parcelas filhas para liberar cobranca bancaria', async () => {
    const { prisma, service } = createService();

    await service.findAllFinancialRecords('tenant-1');

    expect(prisma.financialRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          children: expect.objectContaining({
            select: expect.objectContaining({
              parties: expect.objectContaining({
                select: expect.objectContaining({
                  contact: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      name: true,
                      document: true,
                      email: true,
                      phone: true,
                      whatsapp: true,
                      pfDetails: { select: { cpf: true } },
                      pjDetails: { select: { cnpj: true } },
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });
});
