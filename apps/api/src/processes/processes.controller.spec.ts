import { ProcessesController } from './processes.controller';

describe('ProcessesController', () => {
  const createController = () => {
    const crawlerService = {
      crawlByCnj: jest.fn(),
      search: jest.fn(),
    };
    const processesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getFilterOptions: jest.fn(),
      getCnjTimelineImportStatus: jest.fn(),
      importCnjTimelines: jest.fn(),
      importProcessPdfAndUpsertProcess: jest.fn(),
      importProcessPdfDossier: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      syncMicrosoftFolderForProcess: jest.fn(),
      createLocalFolder: jest.fn(),
      openLocalFolder: jest.fn(),
      pickLocalFolder: jest.fn(),
      remove: jest.fn(),
      bulkAction: jest.fn(),
    };
    const pdfService = {
      extractDataFromPdf: jest.fn(),
      analyzeFullProcessPdf: jest.fn(),
    };
    const partiesService = {
      findAllRoles: jest.fn(),
      createRole: jest.fn(),
      deleteRole: jest.fn(),
      findByProcess: jest.fn(),
      addParty: jest.fn(),
      addPrincipalParty: jest.fn(),
      addRepresentative: jest.fn(),
      unlinkRepresentative: jest.fn(),
      updateParty: jest.fn(),
      removeParty: jest.fn(),
      quickContactAndParty: jest.fn(),
    };
    const timelinesService = {
      listTasksForTenant: jest.fn(),
      getAttachmentPath: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const qualificationsService = {
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    const integrationsService = {
      getIntegrationConfig: jest.fn(),
      saveIntegrationConfig: jest.fn(),
      testIntegration: jest.fn(),
      importByCnj: jest.fn(),
    };

    return {
      crawlerService,
      processesService,
      pdfService,
      partiesService,
      timelinesService,
      qualificationsService,
      integrationsService,
      controller: new ProcessesController(
        crawlerService as never,
        processesService as never,
        pdfService as never,
        partiesService as never,
        timelinesService as never,
        qualificationsService as never,
        integrationsService as never,
      ),
    };
  };

  it('encaminha tenant para a aba de partes', () => {
    const { controller, partiesService } = createController();

    controller.findParties('process-1', { tenantId: 'tenant-1' } as never);

    expect(partiesService.findByProcess).toHaveBeenCalledWith('process-1', 'tenant-1');
  });

  it('encaminha tenant para atualizacao de andamento', () => {
    const { controller, timelinesService } = createController();
    const body = { title: 'Novo prazo' };

    controller.updateTimeline({ tenantId: 'tenant-1' } as never, 'timeline-1', body as never, []);

    expect(timelinesService.update).toHaveBeenCalledWith('timeline-1', body, [], 'tenant-1');
  });

  it('encaminha tenant para exclusao de qualificacao processual', () => {
    const { controller, qualificationsService } = createController();

    controller.deleteQualification('qualification-1', { tenantId: 'tenant-1' } as never);

    expect(qualificationsService.delete).toHaveBeenCalledWith('qualification-1', 'tenant-1');
  });

  it('encaminha tenant e ator para criacao de andamento', () => {
    const { controller, timelinesService } = createController();

    controller.addTimeline(
      'process-1',
      { title: 'Peticao protocolada' } as never,
      [],
      { user: { name: 'Evandro' } } as never,
      { tenantId: 'tenant-1' } as never,
    );

    expect(timelinesService.create).toHaveBeenCalledWith(
      'process-1',
      { title: 'Peticao protocolada' },
      [],
      'Evandro',
      'tenant-1',
    );
  });
});
