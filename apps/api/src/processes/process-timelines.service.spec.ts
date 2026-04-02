import { ProcessTimelinesService } from './process-timelines.service';

describe('ProcessTimelinesService', () => {
  const createService = () => {
    const prisma = {
      process: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      processTimeline: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      appointment: {
        create: jest.fn(),
      },
      workflowStep: {
        findUnique: jest.fn(),
      },
    };

    return {
      prisma,
      service: new ProcessTimelinesService(prisma as never),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserva internalDate e fatalDate ao editar parcialmente um andamento', async () => {
    const { prisma, service } = createService();
    prisma.processTimeline.findFirst.mockResolvedValue({
      id: 'timeline-1',
      processId: 'process-1',
      status: 'PENDENTE',
      category: 'ACAO',
      metadata: {},
      responsibleHistory: [],
      workflowStepId: null,
      completedAt: null,
      completedBy: null,
    });
    prisma.processTimeline.update.mockResolvedValue({ id: 'timeline-1' });

    await service.update('timeline-1', { title: 'Prazo revisado' }, [], 'tenant-1');

    expect(prisma.processTimeline.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'timeline-1' },
        data: expect.objectContaining({
          title: 'Prazo revisado',
          internalDate: undefined,
          fatalDate: undefined,
        }),
      }),
    );
  });

  it('valida o tenant antes de atualizar um andamento', async () => {
    const { prisma, service } = createService();
    prisma.processTimeline.findFirst.mockResolvedValue({
      id: 'timeline-1',
      processId: 'process-1',
      status: 'PENDENTE',
      category: 'REGISTRO',
      metadata: {},
      responsibleHistory: [],
      workflowStepId: null,
      completedAt: null,
      completedBy: null,
    });
    prisma.processTimeline.update.mockResolvedValue({ id: 'timeline-1' });

    await service.update('timeline-1', { status: 'CONCLUIDO' }, [], 'tenant-1');

    expect(prisma.processTimeline.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'timeline-1',
        process: { is: { tenantId: 'tenant-1' } },
      },
    });
  });

  it('valida o tenant antes de remover um andamento', async () => {
    const { prisma, service } = createService();
    prisma.processTimeline.findFirst.mockResolvedValue({
      id: 'timeline-1',
      processId: 'process-1',
    });
    prisma.processTimeline.delete.mockResolvedValue({ id: 'timeline-1' });

    await service.remove('timeline-1', 'tenant-1');

    expect(prisma.processTimeline.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'timeline-1',
        process: { is: { tenantId: 'tenant-1' } },
      },
    });
    expect(prisma.processTimeline.delete).toHaveBeenCalledWith({
      where: { id: 'timeline-1' },
    });
  });
});
