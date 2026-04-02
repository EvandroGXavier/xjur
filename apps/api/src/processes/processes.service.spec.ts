import { ProcessesService } from './processes.service';

describe('ProcessesService', () => {
  const createService = () => {
    const prisma = {
      process: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      processTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const microsoftGraphService = {
      setupFolderStructure: jest.fn(),
    };
    const integrationsService = {
      importByCnj: jest.fn(),
      getIntegrationConfig: jest.fn(),
      saveIntegrationConfig: jest.fn(),
      testIntegration: jest.fn(),
    };
    const pdfService = {
      analyzeFullProcessPdf: jest.fn(),
      extractDataFromPdf: jest.fn(),
    };
    const drxClawService = {
      ask: jest.fn(),
    };
    const timelineService = {
      createSystemTimeline: jest.fn(),
      triggerNextWorkflowSteps: jest.fn(),
    };

    return {
      prisma,
      microsoftGraphService,
      integrationsService,
      pdfService,
      drxClawService,
      timelineService,
      service: new ProcessesService(
        prisma as never,
        microsoftGraphService as never,
        integrationsService as never,
        pdfService as never,
        drxClawService as never,
        timelineService as never,
      ),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa o nome das partes no bulk search em vez de um campo client inexistente', async () => {
    const { prisma, service } = createService();
    prisma.process.findMany.mockResolvedValue([]);

    await service.bulkAction('tenant-1', {
      action: 'ADD_TAG',
      tagId: 'tag-1',
      search: 'Maria',
    });

    expect(prisma.process.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        OR: expect.arrayContaining([
          {
            processParties: {
              some: {
                contact: {
                  name: { contains: 'Maria', mode: 'insensitive' },
                },
              },
            },
          },
        ]),
      }),
      select: { id: true },
    });
  });

  it('normaliza o status antes de aplicar update em lote', async () => {
    const { prisma, service } = createService();
    prisma.process.findMany.mockResolvedValue([{ id: 'process-1' }]);
    prisma.process.updateMany.mockResolvedValue({ count: 1 });

    await service.bulkAction('tenant-1', {
      action: 'UPDATE_STATUS',
      status: 'Encerrada',
      processIds: ['process-1'],
    });

    expect(prisma.process.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['process-1'] } },
      data: { status: 'ENCERRADO' },
    });
  });
});
