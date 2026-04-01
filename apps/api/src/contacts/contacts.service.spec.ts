import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  const createService = () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      relationType: {
        findFirst: jest.fn(),
      },
      contactRelation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      processParty: {
        findMany: jest.fn(),
      },
      process: {
        findMany: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
      },
      agentConversation: {
        findMany: jest.fn(),
      },
      ticket: {
        findMany: jest.fn(),
      },
      address: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      additionalContact: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      assetType: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      contactAsset: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      financialRecord: {
        findMany: jest.fn(),
      },
    };
    const enrichmentService = {
      consultCNPJ: jest.fn(),
      consultCEP: jest.fn(),
    };

    return {
      prisma,
      enrichmentService,
      service: new ContactsService(prisma as never, enrichmentService as never),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloqueia criacao sem meios centrais de contato quando a configuracao exige', async () => {
    const { prisma, service } = createService();
    prisma.tenant.findUnique.mockResolvedValue({ contactRequireOneInfo: true });

    await expect(
      service.create({ name: 'Contato sem dados' } as never, 'tenant-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  it('localiza contato sempre pelo tenant', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue(null);

    await expect(service.findOne('contact-1', 'tenant-1')).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-1', tenantId: 'tenant-1' },
      }),
    );
  });

  it('remove dados do tipo anterior ao converter contato para PF', async () => {
    const { prisma, service } = createService();
    prisma.tenant.findUnique.mockResolvedValue({ contactRequireOneInfo: true });
    prisma.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      tenantId: 'tenant-1',
      personType: 'PJ',
      name: 'Empresa XPTO',
      email: 'contato@xpto.com',
      whatsapp: null,
      phone: null,
      document: '11222333000181',
      pfDetails: null,
      pjDetails: { id: 'pj-1', cnpj: '11222333000181' },
    });
    prisma.contact.findMany.mockResolvedValue([]);
    prisma.contact.update.mockResolvedValue({
      id: 'contact-1',
      tenantId: 'tenant-1',
      name: 'Fulano da Silva',
      personType: 'PF',
      email: 'fulano@xpto.com',
      pfDetails: { id: 'pf-1', cpf: '11144477735' },
      pjDetails: null,
      addresses: [],
      additionalContacts: [],
    });

    await service.update(
      'contact-1',
      {
        personType: 'PF',
        name: 'Fulano da Silva',
        email: 'fulano@xpto.com',
        cpf: '11144477735',
      } as never,
      'tenant-1',
    );

    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personType: 'PF',
          pjDetails: { delete: true },
        }),
      }),
    );
  });

  it('detecta duplicidade por telefone com formatos diferentes usando os ultimos 8 digitos', async () => {
    const { prisma, service } = createService();
    prisma.contact.findMany.mockResolvedValue([
      {
        id: 'contact-duplicado',
        name: 'Contato Existente',
        whatsapp: '(31) 98877-6655',
        phone: null,
        email: null,
        document: null,
        pfDetails: null,
        pjDetails: null,
      },
    ]);

    const duplicate = await service.findDuplicateContact(
      'tenant-1',
      { name: 'Novo Contato', phone: '988776655' },
      'contact-atual',
    );

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          id: { not: 'contact-atual' },
          OR: expect.arrayContaining([
            { phone: { endsWith: '88776655' } },
            { whatsapp: { endsWith: '88776655' } },
          ]),
        }),
      }),
    );
    expect(duplicate).toEqual({ id: 'contact-duplicado', matchedField: 'telefone' });
  });

  it('impede duplicidade exata de vinculo entre contatos', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' });
    prisma.relationType.findFirst.mockResolvedValue({ id: 'type-1' });
    prisma.contactRelation.findFirst.mockResolvedValue({ id: 'relation-1' });

    await expect(
      service.createContactRelation('tenant-1', 'contact-1', {
        toContactId: 'contact-2',
        relationTypeId: 'type-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('impede auto-vinculo no backend mesmo se a requisicao chegar pela API', async () => {
    const { prisma, service } = createService();

    await expect(
      service.createContactRelation('tenant-1', 'contact-1', {
        toContactId: 'contact-1',
        relationTypeId: 'type-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.contactRelation.findFirst).not.toHaveBeenCalled();
  });

  it('impede duplicidade invertida de vinculo entre contatos', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' });
    prisma.relationType.findFirst.mockResolvedValue({ id: 'type-1' });
    prisma.contactRelation.findFirst.mockResolvedValue({ id: 'relation-1' });

    await expect(
      service.createContactRelation('tenant-1', 'contact-1', {
        toContactId: 'contact-2',
        relationTypeId: 'type-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.contactRelation.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        relationTypeId: 'type-1',
        OR: [
          {
            fromContactId: 'contact-1',
            toContactId: 'contact-2',
          },
          {
            fromContactId: 'contact-2',
            toContactId: 'contact-1',
          },
        ],
      },
      select: { id: true },
    });
  });

  it('protege a aba de enderecos contra edicao cruzada entre contatos', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' });
    prisma.address.findFirst.mockResolvedValue(null);

    await expect(
      service.updateAddress(
        'contact-1',
        'address-1',
        { city: 'Belo Horizonte' } as never,
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.address.update).not.toHaveBeenCalled();
  });

  it('protege a aba de contatos adicionais contra exclusao cruzada', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' });
    prisma.additionalContact.findFirst.mockResolvedValue(null);

    await expect(
      service.removeAdditionalContact('contact-1', 'additional-1', 'tenant-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.additionalContact.delete).not.toHaveBeenCalled();
  });

  it('permite editar patrimonio parcialmente sem exigir reenvio do tipo', async () => {
    const { prisma, service } = createService();
    prisma.contactAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      tenantId: 'tenant-1',
      assetTypeId: 'type-1',
      description: 'Imovel antigo',
    });
    prisma.contactAsset.update.mockResolvedValue({
      id: 'asset-1',
      description: 'Imovel atualizado',
    });

    const result = await service.updateContactAsset('tenant-1', 'asset-1', {
      description: 'Imovel atualizado',
    });

    expect(prisma.assetType.findFirst).not.toHaveBeenCalled();
    expect(prisma.contactAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { description: 'Imovel atualizado' },
    });
    expect(result.description).toBe('Imovel atualizado');
  });

  it('mantem dados do contrato ao editar parcialmente e permite excluir no final da sequencia', async () => {
    const { prisma, service } = createService();
    prisma.contact.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'contact-1', metadata: data.metadata }),
    );

    prisma.contact.findFirst.mockResolvedValueOnce({
      id: 'contact-1',
      metadata: {},
    });

    const createdContracts = await service.createContactContract('tenant-1', 'contact-1', {
      type: 'HONORARIOS',
      description: 'Mensalidade consultiva',
      dueDay: 10,
      firstDueDate: '2026-04-10',
      billingFrequency: 'MONTHLY',
      transactionKind: 'INCOME',
      counterpartyRole: 'CONTRACTOR',
      counterpartyName: 'Maria Cliente',
      notes: 'Contrato principal',
      status: 'ACTIVE',
    });

    const createdContract = createdContracts[0];

    prisma.contact.findFirst.mockResolvedValueOnce({
      id: 'contact-1',
      metadata: { contracts: createdContracts },
    });

    const updatedContracts = await service.updateContactContract(
      'tenant-1',
      'contact-1',
      createdContract.id,
      {
        status: 'PAUSED',
        notes: 'Pausado por renegociacao',
      },
    );

    expect(updatedContracts[0]).toEqual(
      expect.objectContaining({
        id: createdContract.id,
        description: 'Mensalidade consultiva',
        dueDay: 10,
        counterpartyName: 'Maria Cliente',
        status: 'PAUSED',
        notes: 'Pausado por renegociacao',
      }),
    );

    prisma.contact.findFirst.mockResolvedValueOnce({
      id: 'contact-1',
      metadata: { contracts: updatedContracts },
    });

    const remainingContracts = await service.removeContactContract(
      'tenant-1',
      'contact-1',
      createdContract.id,
    );

    expect(remainingContracts).toEqual([]);
    expect(prisma.contact.update).toHaveBeenCalledTimes(3);
  });

  it('inativa o contato quando a exclusao falha por vinculos obrigatorios', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' });
    prisma.contact.delete.mockRejectedValue({ code: 'P2003' });
    prisma.contact.update.mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1', active: false });

    const result = await service.remove('contact-1', 'tenant-1');

    expect(prisma.contact.delete).toHaveBeenCalledWith({ where: { id: 'contact-1' } });
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { active: false },
    });
    expect(result.active).toBe(false);
  });

  it('consolida insights de processos, agenda e whatsapp', async () => {
    const { prisma, service } = createService();
    prisma.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      tenantId: 'tenant-1',
      name: 'Maria Cliente',
      whatsapp: '31999999999',
      phone: '3133334444',
      email: 'maria@email.com',
    });
    prisma.processParty.findMany.mockResolvedValue([
      {
        process: {
          id: 'process-2',
          code: 'PROC-2',
          title: 'Acao de Cobranca',
          cnj: '0000000-00.2026.8.13.0001',
          status: 'ATIVO',
          area: 'Civel',
          class: 'Procedimento Comum',
          court: 'TJMG',
          district: 'Belo Horizonte',
          updatedAt: new Date('2026-03-10T10:00:00Z'),
        },
        role: { id: 'role-1', name: 'AUTOR', category: 'POLO_ATIVO' },
        isClient: true,
        isOpposing: false,
      },
    ]);
    prisma.process.findMany.mockResolvedValue([
      {
        id: 'process-1',
        code: 'PROC-1',
        title: 'Consultivo Tributario',
        cnj: null,
        status: 'ATIVO',
        area: 'Tributario',
        class: null,
        court: null,
        district: null,
        updatedAt: new Date('2026-03-11T10:00:00Z'),
      },
    ]);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        title: 'Reuniao com cliente',
        type: 'REUNIAO',
        status: 'CONFIRMED',
        startAt: new Date('2026-03-20T14:00:00Z'),
        endAt: new Date('2026-03-20T15:00:00Z'),
        location: 'Sala 1',
        process: { id: 'process-1', title: 'Consultivo Tributario', code: 'PROC-1' },
        participants: [{ role: 'CLIENT', confirmed: true }],
      },
    ]);
    prisma.agentConversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Atendimento Maria',
        status: 'OPEN',
        priority: 'MEDIUM',
        queue: 'JURIDICO',
        waitingReply: true,
        unreadCount: 2,
        lastMessagePreview: 'Preciso de retorno.',
        lastMessageAt: new Date('2026-03-14T12:00:00Z'),
        connection: { id: 'conn-1', name: 'WhatsApp Principal', status: 'CONNECTED' },
        ticket: { id: 'ticket-1', code: 101, status: 'OPEN', priority: 'MEDIUM', queue: 'JURIDICO' },
        messages: [
          {
            id: 'msg-1',
            direction: 'INBOUND',
            role: 'CONTACT',
            content: 'Preciso de retorno.',
            contentType: 'TEXT',
            status: 'RECEIVED',
            senderName: 'Maria',
            createdAt: new Date('2026-03-14T11:59:00Z'),
          },
        ],
      },
    ]);
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-1',
        code: 101,
        title: 'Duvida sobre contrato',
        status: 'OPEN',
        priority: 'MEDIUM',
        queue: 'JURIDICO',
        waitingReply: true,
        lastMessageAt: new Date('2026-03-14T12:00:00Z'),
        updatedAt: new Date('2026-03-14T12:00:00Z'),
      },
    ]);

    const insights = await service.getContactInsights('contact-1', 'tenant-1');

    expect(insights.processes).toHaveLength(2);
    expect(insights.appointments[0].title).toBe('Reuniao com cliente');
    expect(insights.whatsapp.conversations[0].id).toBe('conv-1');
    expect(insights.whatsapp.tickets[0].code).toBe(101);
  });
});
