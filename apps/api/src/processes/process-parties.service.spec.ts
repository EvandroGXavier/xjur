import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProcessPartiesService } from './process-parties.service';

describe('ProcessPartiesService', () => {
  const createService = () => {
    const prisma = {
      tenant: {
        findMany: jest.fn(),
      },
      process: {
        findFirst: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      partyRole: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      partyQualification: {
        findFirst: jest.fn(),
      },
      processParty: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      processPartyRepresentation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    return {
      prisma,
      service: new ProcessPartiesService(prisma as never),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filtra as partes pelo tenant do processo', async () => {
    const { prisma, service } = createService();
    prisma.process.findFirst.mockResolvedValue({ id: 'process-1', tenantId: 'tenant-1' });
    prisma.processParty.findMany.mockResolvedValue([]);

    await service.findByProcess('process-1', 'tenant-1');

    expect(prisma.process.findFirst).toHaveBeenCalledWith({
      where: { id: 'process-1', tenantId: 'tenant-1' },
      select: { id: true, tenantId: true },
    });
    expect(prisma.processParty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          processId: 'process-1',
          tenantId: 'tenant-1',
        },
      }),
    );
  });

  it('impede remover a ultima parte marcada como cliente principal', async () => {
    const { prisma, service } = createService();
    prisma.processParty.findFirst.mockResolvedValue({
      id: 'party-1',
      tenantId: 'tenant-1',
      processId: 'process-1',
      isClient: true,
      contact: { name: 'Cliente XPTO' },
      role: { name: 'AUTOR' },
      representativeLinks: [],
    });
    prisma.processParty.count.mockResolvedValue(0);

    await expect(service.removeParty('party-1', 'tenant-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.processParty.delete).not.toHaveBeenCalled();
  });

  it('impede desmarcar o ultimo cliente principal na aba de partes', async () => {
    const { prisma, service } = createService();
    prisma.processParty.findFirst.mockResolvedValue({
      id: 'party-1',
      tenantId: 'tenant-1',
      processId: 'process-1',
      isClient: true,
      isOpposing: false,
      role: { name: 'AUTOR', category: 'POLO_ATIVO' },
    });
    prisma.processParty.count.mockResolvedValue(0);

    await expect(
      service.updateParty('party-1', {
        tenantId: 'tenant-1',
        isClient: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.processParty.update).not.toHaveBeenCalled();
  });

  it('bloqueia inclusao de contato de outro tenant nas partes do processo', async () => {
    const { prisma, service } = createService();
    prisma.process.findFirst.mockResolvedValue({ id: 'process-1', tenantId: 'tenant-1' });
    prisma.contact.findFirst.mockResolvedValue(null);

    await expect(
      service.addParty({
        tenantId: 'tenant-1',
        processId: 'process-1',
        contactId: 'contact-other-tenant',
        roleId: 'role-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
