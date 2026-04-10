import { InterBankingProvider } from './inter-banking.provider';

describe('InterBankingProvider mode resolution', () => {
  const originalMode = process.env.BANKING_INTER_MODE;

  const createContext = (environment: 'SANDBOX' | 'PRODUCTION') =>
    ({
      tenantId: 'tenant-1',
      integration: {
        id: 'integration-1',
        provider: 'INTER',
        environment,
        metadata: {},
      },
      credentials: {},
    }) as any;

  beforeEach(() => {
    delete process.env.BANKING_INTER_MODE;
  });

  afterAll(() => {
    if (originalMode === undefined) {
      delete process.env.BANKING_INTER_MODE;
      return;
    }

    process.env.BANKING_INTER_MODE = originalMode;
  });

  it('usa live por padrao quando a integracao estiver em producao', async () => {
    const provider = new InterBankingProvider();

    const result = await provider.createCharge(createContext('PRODUCTION'), {
      chargeType: 'BOLETO',
      amount: 150,
      dueDate: '2026-04-30',
      payerName: 'Cliente XPTO',
      payerDocument: '12345678901',
      description: 'Honorarios abril',
    });

    expect(result.mode).toBe('LIVE');
    expect(result.status).toBe('ERROR');
    expect(result.message).toContain('LIVE');
  });

  it('mantem mock por padrao quando a integracao estiver em sandbox', async () => {
    const provider = new InterBankingProvider();

    const result = await provider.createCharge(createContext('SANDBOX'), {
      chargeType: 'BOLETO',
      amount: 150,
      dueDate: '2026-04-30',
      payerName: 'Cliente XPTO',
      payerDocument: '12345678901',
      description: 'Honorarios abril',
    });

    expect(result.mode).toBe('MOCK');
    expect(result.status).toBe('CREATED_MOCK');
  });

  it('permite override explicito por variavel de ambiente', async () => {
    process.env.BANKING_INTER_MODE = 'MOCK';
    const provider = new InterBankingProvider();

    const result = await provider.createCharge(createContext('PRODUCTION'), {
      chargeType: 'BOLETO',
      amount: 150,
      dueDate: '2026-04-30',
      payerName: 'Cliente XPTO',
      payerDocument: '12345678901',
      description: 'Honorarios abril',
    });

    expect(result.mode).toBe('MOCK');
    expect(result.status).toBe('CREATED_MOCK');
  });
});
