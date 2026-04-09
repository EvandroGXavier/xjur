import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { SecurityService } from '../security/security.service';
import { CreateBankIntegrationDto } from './dto/create-bank-integration.dto';
import { UpdateBankIntegrationDto } from './dto/update-bank-integration.dto';
import { SyncBankIntegrationDto } from './dto/sync-bank-integration.dto';
import { ReconcileBankTransactionDto } from './dto/reconcile-bank-transaction.dto';
import { CreateBankChargeDto } from './dto/create-bank-charge.dto';
import { CreateBankPaymentRequestDto } from './dto/create-bank-payment-request.dto';
import { ReceiveBankWebhookDto } from './dto/receive-bank-webhook.dto';
import { InterBankingProvider } from './providers/inter/inter-banking.provider';
import { BankingProvider } from './providers/banking-provider.interface';

@Injectable()
export class BankingService {
  private readonly bankChargeInclude = {
    bankIntegration: {
      select: { id: true, displayName: true, provider: true },
    },
    financialRecord: {
      select: { id: true, description: true, amount: true, dueDate: true },
    },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly interProvider: InterBankingProvider,
  ) {}

  private getProvider(provider: string): BankingProvider {
    if (provider === 'INTER') return this.interProvider;
    throw new BadRequestException(`Provider bancário não suportado: ${provider}`);
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  private async assertBankAccount(
    tenantId: string,
    bankAccountId?: string | null,
  ) {
    if (!bankAccountId) return null;
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId },
      select: { id: true },
    });
    if (!bankAccount) {
      throw new BadRequestException(
        'Conta bancária interna não encontrada para este tenant.',
      );
    }
    return bankAccount;
  }

  private buildInterSecretDescription(
    displayName: string,
    section: 'CREDENCIAIS' | 'CERTIFICADO' | 'WEBHOOK',
  ) {
    return `Banco Inter | ${displayName} | ${section}`;
  }

  private async resolveSecretReference(tenantId: string, secretId?: string | null) {
    if (!secretId) return null;
    return this.securityService.getSecretById(secretId, tenantId);
  }

  private async storeSecrets(
    tenantId: string,
    integration: {
      id: string;
      displayName: string;
      credentialSecretId?: string | null;
      certificateSecretId?: string | null;
      webhookSecretId?: string | null;
    },
    credentials?: CreateBankIntegrationDto['credentials'],
  ) {
    if (!credentials) return {};

    const existing = await this.securityService.listSecrets(
      tenantId,
      'BANK_INTEGRATION',
      integration.id,
    );

    const upsertSecret = async (params: {
      currentId?: string | null;
      fallbackKeys: string[];
      description: string;
      data: any;
    }) => {
      const linked = await this.resolveSecretReference(tenantId, params.currentId);
      const found =
        linked ||
        existing.find((item) =>
          params.fallbackKeys.some((key) => item.description === key),
        ) ||
        null;

      const payload = {
        ...params.data,
        description: params.description,
      };

      if (found) {
        await this.securityService.updateSecret(found.id, tenantId, payload);
        return found.id;
      }

      const created = await this.securityService.createSecret(tenantId, {
        entityType: 'BANK_INTEGRATION',
        entityId: integration.id,
        ...payload,
      });
      return created.id;
    };

    const secretIds: {
      credentialSecretId?: string;
      certificateSecretId?: string;
      webhookSecretId?: string;
    } = {};

    if (credentials.clientId || credentials.clientSecret || credentials.tokenUrl) {
      secretIds.credentialSecretId = await upsertSecret({
        currentId: integration.credentialSecretId,
        fallbackKeys: ['INTER_CLIENT'],
        description: this.buildInterSecretDescription(
          integration.displayName,
          'CREDENCIAIS',
        ),
        data: {
          username: credentials.clientId,
          password: credentials.clientSecret,
          details: credentials.tokenUrl || null,
        },
      });
    }

    if (
      credentials.certificateBase64 ||
      credentials.certificatePem ||
      credentials.privateKeyPem ||
      credentials.certificatePassword
    ) {
      secretIds.certificateSecretId = await upsertSecret({
        currentId: integration.certificateSecretId,
        fallbackKeys: ['INTER_CERTIFICATE'],
        description: this.buildInterSecretDescription(
          integration.displayName,
          'CERTIFICADO',
        ),
        data: {
          publicKey: credentials.certificatePem || null,
          privateKey:
            credentials.privateKeyPem ||
            credentials.certificateBase64 ||
            null,
          password: credentials.certificatePassword || null,
        },
      });
    }

    if (credentials.webhookSecret) {
      secretIds.webhookSecretId = await upsertSecret({
        currentId: integration.webhookSecretId,
        fallbackKeys: ['INTER_WEBHOOK'],
        description: this.buildInterSecretDescription(
          integration.displayName,
          'WEBHOOK',
        ),
        data: {
          password: credentials.webhookSecret,
        },
      });
    }

    return secretIds;
  }

  private async loadCredentials(tenantId: string, integration: any) {
    const secrets = await this.securityService.listSecrets(
      tenantId,
      'BANK_INTEGRATION',
      integration.id,
    );
    const client =
      (await this.resolveSecretReference(tenantId, integration.credentialSecretId)) ||
      secrets.find((item) => item.description === 'INTER_CLIENT') ||
      null;
    const certificate =
      (await this.resolveSecretReference(
        tenantId,
        integration.certificateSecretId,
      )) ||
      secrets.find((item) => item.description === 'INTER_CERTIFICATE') ||
      null;
    const webhook =
      (await this.resolveSecretReference(tenantId, integration.webhookSecretId)) ||
      secrets.find((item) => item.description === 'INTER_WEBHOOK') ||
      null;

    return {
      credentialSecretId: integration.credentialSecretId || client?.id || null,
      certificateSecretId: integration.certificateSecretId || certificate?.id || null,
      webhookSecretId: integration.webhookSecretId || webhook?.id || null,
      clientId: client?.username || null,
      clientSecret: client?.password || null,
      tokenUrl: client?.details || null,
      certificateBase64: certificate?.publicKey ? null : certificate?.privateKey || null,
      certificatePem: certificate?.publicKey || null,
      privateKeyPem: certificate?.publicKey ? certificate?.privateKey || null : null,
      certificatePassword: certificate?.password || null,
      webhookSecret: webhook?.password || null,
    };
  }

  private normalizeDocument(value?: string | null) {
    const digits = String(value || '').replace(/\D/g, '').trim();
    return digits.length > 0 ? digits : null;
  }

  private normalizeText(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private calculateOutstandingAmount(record: {
    amount?: number | string | { toString(): string } | null;
    amountFinal?: number | string | { toString(): string } | null;
    amountPaid?: number | string | { toString(): string } | null;
  }) {
    const baseAmount = Number(record.amountFinal ?? record.amount ?? 0);
    const paidAmount = Number(record.amountPaid ?? 0);
    return Math.max(0, Math.round((baseAmount - paidAmount) * 100) / 100);
  }

  private normalizeDateOnly(value?: Date | string | null) {
    if (!value) return null;

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  private resolveChargePayer(financialRecord: any) {
    const debtorParty =
      financialRecord.parties?.find((party: any) => party.role === 'DEBTOR') ||
      null;

    if (!debtorParty?.contact) {
      throw new BadRequestException(
        'A cobrança exige um contato devedor vinculado ao lançamento.',
      );
    }

    const contact = debtorParty.contact;
    const address = Array.isArray(contact.addresses) ? contact.addresses[0] : null;
    const payerDocument = this.normalizeDocument(
      contact.document ||
        contact.pfDetails?.cpf ||
        contact.pjDetails?.cnpj ||
        null,
    );

    return {
      payerName: this.normalizeText(contact.name),
      payerDocument,
      payerEmail: this.normalizeText(contact.email),
      payerPhone: this.normalizeDocument(contact.whatsapp || contact.phone || null),
      payerAddress: address
        ? {
            zipCode: this.normalizeText(address.zipCode),
            street: this.normalizeText(address.street),
            number: this.normalizeText(address.number),
            complement: this.normalizeText(address.complement),
            district: this.normalizeText(address.district),
            city: this.normalizeText(address.city),
            state: this.normalizeText(address.state),
          }
        : null,
    };
  }

  async listIntegrations(tenantId: string) {
    return this.prisma.bankIntegration.findMany({
      where: { tenantId },
      include: {
        bankAccount: {
          select: {
            id: true,
            title: true,
            bankName: true,
            balance: true,
          },
        },
        syncJobs: {
          select: {
            id: true,
            jobType: true,
            status: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            bankTransactions: true,
            reconciliations: true,
            webhookEvents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIntegration(tenantId: string, dto: CreateBankIntegrationDto) {
    await this.assertBankAccount(tenantId, dto.bankAccountId);

    const integration = await this.prisma.bankIntegration.create({
      data: {
        tenantId,
        provider: dto.provider,
        displayName: dto.displayName,
        bankAccountId: dto.bankAccountId || null,
        environment: dto.environment || 'SANDBOX',
        isActive: dto.isActive ?? true,
        status: 'CONFIGURED',
        webhookEnabled: dto.webhookEnabled ?? false,
        webhookUrl: dto.webhookUrl || null,
        externalAccountId: dto.externalAccountId || null,
        accountHolderDocument: dto.accountHolderDocument || null,
        accountHolderName: dto.accountHolderName || null,
        branchCode: dto.branchCode || null,
        accountNumber: dto.accountNumber || null,
        metadata: dto.metadata || {},
      },
    });

    const storedSecretIds = await this.storeSecrets(
      tenantId,
      integration,
      dto.credentials,
    );
    const linkedSecretIds = {
      credentialSecretId: dto.credentials?.credentialSecretId || null,
      certificateSecretId: dto.credentials?.certificateSecretId || null,
      webhookSecretId: dto.credentials?.webhookSecretId || null,
    };
    const resolvedSecretIds = {
      credentialSecretId:
        linkedSecretIds.credentialSecretId ||
        storedSecretIds.credentialSecretId ||
        null,
      certificateSecretId:
        linkedSecretIds.certificateSecretId ||
        storedSecretIds.certificateSecretId ||
        null,
      webhookSecretId:
        linkedSecretIds.webhookSecretId ||
        storedSecretIds.webhookSecretId ||
        null,
    };

    if (
      resolvedSecretIds.credentialSecretId ||
      resolvedSecretIds.certificateSecretId ||
      resolvedSecretIds.webhookSecretId
    ) {
      await this.prisma.bankIntegration.update({
        where: { id: integration.id },
        data: resolvedSecretIds,
      });
    }

    return this.prisma.bankIntegration.findUnique({
      where: { id: integration.id },
      include: { bankAccount: true },
    });
  }

  async updateIntegration(
    id: string,
    tenantId: string,
    dto: UpdateBankIntegrationDto,
  ) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) {
      throw new NotFoundException('Integração bancária não encontrada.');
    }

    await this.assertBankAccount(tenantId, dto.bankAccountId);

    const updatedIntegration = await this.prisma.bankIntegration.update({
      where: { id },
      data: {
        displayName: dto.displayName ?? integration.displayName,
        bankAccountId:
          dto.bankAccountId !== undefined
            ? dto.bankAccountId || null
            : integration.bankAccountId,
        environment: dto.environment ?? integration.environment,
        isActive: dto.isActive ?? integration.isActive,
        webhookEnabled: dto.webhookEnabled ?? integration.webhookEnabled,
        webhookUrl:
          dto.webhookUrl !== undefined ? dto.webhookUrl || null : integration.webhookUrl,
        externalAccountId:
          dto.externalAccountId !== undefined
            ? dto.externalAccountId || null
            : integration.externalAccountId,
        accountHolderDocument:
          dto.accountHolderDocument !== undefined
            ? dto.accountHolderDocument || null
            : integration.accountHolderDocument,
        accountHolderName:
          dto.accountHolderName !== undefined
            ? dto.accountHolderName || null
            : integration.accountHolderName,
        branchCode:
          dto.branchCode !== undefined ? dto.branchCode || null : integration.branchCode,
        accountNumber:
          dto.accountNumber !== undefined
            ? dto.accountNumber || null
            : integration.accountNumber,
        metadata:
          dto.metadata !== undefined ? dto.metadata || {} : integration.metadata,
      },
    });

    const storedSecretIds = await this.storeSecrets(
      tenantId,
      updatedIntegration,
      dto.credentials,
    );
    const linkedSecretIds = {
      credentialSecretId:
        dto.credentials?.credentialSecretId || updatedIntegration.credentialSecretId,
      certificateSecretId:
        dto.credentials?.certificateSecretId ||
        updatedIntegration.certificateSecretId,
      webhookSecretId:
        dto.credentials?.webhookSecretId || updatedIntegration.webhookSecretId,
    };
    const resolvedSecretIds = {
      credentialSecretId:
        linkedSecretIds.credentialSecretId ||
        storedSecretIds.credentialSecretId ||
        null,
      certificateSecretId:
        linkedSecretIds.certificateSecretId ||
        storedSecretIds.certificateSecretId ||
        null,
      webhookSecretId:
        linkedSecretIds.webhookSecretId ||
        storedSecretIds.webhookSecretId ||
        null,
    };

    if (
      resolvedSecretIds.credentialSecretId !==
        updatedIntegration.credentialSecretId ||
      resolvedSecretIds.certificateSecretId !==
        updatedIntegration.certificateSecretId ||
      resolvedSecretIds.webhookSecretId !== updatedIntegration.webhookSecretId
    ) {
      await this.prisma.bankIntegration.update({
        where: { id },
        data: resolvedSecretIds,
      });
    }

    return this.prisma.bankIntegration.findUnique({
      where: { id },
      include: { bankAccount: true },
    });
  }

  async deleteIntegration(id: string, tenantId: string) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) {
      throw new NotFoundException('Integração bancária não encontrada.');
    }

    await this.prisma.bankIntegration.delete({ where: { id } });
    return { success: true };
  }

  async healthcheckIntegration(id: string, tenantId: string) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) {
      throw new NotFoundException('Integração bancária não encontrada.');
    }

    const provider = this.getProvider(integration.provider);
    const credentials = await this.loadCredentials(tenantId, integration);
    const result = await provider.healthcheck({
      integration,
      tenantId,
      credentials,
    });

    await this.prisma.bankIntegration.update({
      where: { id: integration.id },
      data: {
        lastHealthcheckAt: new Date(),
        lastHealthcheckStatus: result.success ? 'SUCCESS' : 'WARNING',
        lastHealthcheckError: result.success ? null : result.message,
      },
    });

    return result;
  }

  async syncIntegration(
    id: string,
    tenantId: string,
    dto: SyncBankIntegrationDto,
  ) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id, tenantId },
      include: { bankAccount: true },
    });
    if (!integration) {
      throw new NotFoundException('Integração bancária não encontrada.');
    }

    const provider = this.getProvider(integration.provider);
    const credentials = await this.loadCredentials(tenantId, integration);

    const syncJob = await this.prisma.bankSyncJob.create({
      data: {
        tenantId,
        bankIntegrationId: integration.id,
        jobType: 'SYNC_TRANSACTIONS',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const result = await provider.syncTransactions(
        { integration, tenantId, credentials },
        dto,
      );

      if (!result.success) {
        await this.prisma.bankSyncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            summary: result.message,
            rawResult: this.toJson(result),
          },
        });
        return result;
      }

      if (integration.bankAccountId && result.account?.currentBalance !== undefined) {
        await this.prisma.bankAccount.update({
          where: { id: integration.bankAccountId },
          data: { balance: result.account.currentBalance },
        });
      }

      for (const item of result.transactions) {
        await this.prisma.bankTransaction.upsert({
          where: {
            bankIntegrationId_externalTransactionId: {
              bankIntegrationId: integration.id,
              externalTransactionId: item.externalTransactionId,
            },
          },
          create: {
            tenantId,
            bankIntegrationId: integration.id,
            bankAccountId: integration.bankAccountId || null,
            externalTransactionId: item.externalTransactionId,
            direction: item.direction,
            entryType: item.entryType,
            status: item.status || 'CAPTURED',
            occurredAt: new Date(item.occurredAt),
            postedAt: item.postedAt ? new Date(item.postedAt) : null,
            amount: item.amount,
            feeAmount: item.feeAmount ?? null,
            description: item.description,
            counterpartyName: item.counterpartyName || null,
            counterpartyDocument: item.counterpartyDocument || null,
            txid: item.txid || null,
            endToEndId: item.endToEndId || null,
            rawPayload: item.rawPayload || {},
          },
          update: {
            direction: item.direction,
            entryType: item.entryType,
            status: item.status || 'CAPTURED',
            occurredAt: new Date(item.occurredAt),
            postedAt: item.postedAt ? new Date(item.postedAt) : null,
            amount: item.amount,
            feeAmount: item.feeAmount ?? null,
            description: item.description,
            counterpartyName: item.counterpartyName || null,
            counterpartyDocument: item.counterpartyDocument || null,
            txid: item.txid || null,
            endToEndId: item.endToEndId || null,
            rawPayload: item.rawPayload || {},
          },
        });
      }

      await this.prisma.bankIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          externalAccountId:
            result.account?.externalAccountId || integration.externalAccountId,
          status: result.mode === 'MOCK' ? 'SYNCED_MOCK' : 'SYNCED',
        },
      });

      await this.prisma.bankSyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          summary: result.message,
          rawResult: this.toJson(result),
        },
      });

      return result;
    } catch (error: any) {
      await this.prisma.bankSyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          summary: error.message || 'Erro ao sincronizar',
        },
      });
      throw error;
    }
  }

  async listTransactions(tenantId: string, integrationId?: string) {
    return this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        ...(integrationId ? { bankIntegrationId: integrationId } : {}),
      },
      include: {
        bankAccount: {
          select: { id: true, title: true, bankName: true },
        },
        reconciliations: {
          include: {
            financialRecord: {
              select: {
                id: true,
                description: true,
                amount: true,
                dueDate: true,
                status: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async listCharges(tenantId: string) {
    return this.prisma.bankCharge.findMany({
      where: { tenantId },
      include: this.bankChargeInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createCharge(tenantId: string, dto: CreateBankChargeDto) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id: dto.bankIntegrationId, tenantId },
    });
    if (!integration) {
      throw new BadRequestException('Integração bancária não encontrada.');
    }

    if (!integration.isActive) {
      throw new BadRequestException(
        'A integração bancária selecionada está inativa.',
      );
    }

    const financialRecord = await this.prisma.financialRecord.findFirst({
      where: { id: dto.financialRecordId, tenantId },
      include: {
        parties: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                personType: true,
                document: true,
                email: true,
                phone: true,
                whatsapp: true,
                pfDetails: {
                  select: { cpf: true },
                },
                pjDetails: {
                  select: { cnpj: true },
                },
                addresses: {
                  select: {
                    zipCode: true,
                    street: true,
                    number: true,
                    complement: true,
                    district: true,
                    city: true,
                    state: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!financialRecord) {
      throw new BadRequestException('Lançamento financeiro não encontrado.');
    }

    if (financialRecord.type !== 'INCOME') {
      throw new BadRequestException(
        'A cobrança bancária só pode ser gerada para transações a receber.',
      );
    }

    if (['PAID', 'CANCELLED'].includes(financialRecord.status)) {
      throw new BadRequestException(
        'Não é possível gerar cobrança para um lançamento já liquidado ou cancelado.',
      );
    }

    const outstandingAmount = this.calculateOutstandingAmount(financialRecord);
    if (outstandingAmount <= 0) {
      throw new BadRequestException(
        'O lançamento não possui saldo pendente para cobrança.',
      );
    }

    const payer = this.resolveChargePayer(financialRecord);
    if (!payer.payerName) {
      throw new BadRequestException(
        'O devedor vinculado precisa ter nome para gerar a cobrança.',
      );
    }

    if (!payer.payerDocument) {
      throw new BadRequestException(
        'O devedor vinculado precisa ter CPF ou CNPJ para gerar a cobrança.',
      );
    }

    const chargeType = String(dto.chargeType || 'BOLETO').toUpperCase();
    const chargeDueDate = dto.dueDate || financialRecord.dueDate?.toISOString() || null;
    const existingActiveCharge = await this.prisma.bankCharge.findFirst({
      where: {
        tenantId,
        bankIntegrationId: integration.id,
        financialRecordId: financialRecord.id,
        chargeType,
        paidAt: null,
        status: {
          notIn: [
            'PAID',
            'RECEIVED',
            'RECEBIDA',
            'SETTLED',
            'LIQUIDATED',
            'CANCELLED',
            'CANCELED',
            'CANCELADO',
            'CANCELADA',
            'EXPIRED',
            'EXPIRADO',
            'EXPIRADA',
            'FAILED',
            'ERROR',
            'REJECTED',
          ],
        },
      },
      include: this.bankChargeInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (existingActiveCharge) {
      const requestedDueDate = this.normalizeDateOnly(chargeDueDate);
      const existingDueDate = this.normalizeDateOnly(existingActiveCharge.dueDate);

      if (
        requestedDueDate &&
        existingDueDate &&
        requestedDueDate !== existingDueDate
      ) {
        throw new BadRequestException(
          'Já existe uma cobrança bancária em aberto para este lançamento. Quite ou cancele a cobrança anterior antes de emitir outra com novo vencimento.',
        );
      }

      return {
        ...existingActiveCharge,
        reusedExisting: true,
      };
    }

    const provider = this.getProvider(integration.provider);
    const credentials = await this.loadCredentials(tenantId, integration);
    const result = await provider.createCharge(
      { integration, tenantId, credentials },
      {
        chargeType,
        amount: outstandingAmount,
        dueDate: chargeDueDate,
        payerName: payer.payerName,
        payerDocument: payer.payerDocument,
        payerEmail: payer.payerEmail,
        payerPhone: payer.payerPhone,
        payerAddress: payer.payerAddress,
        description: financialRecord.description,
      },
    );

    if (!result.success) {
      throw new BadRequestException(
        result.message || 'Não foi possível gerar a cobrança bancária.',
      );
    }

    const createdCharge = await this.prisma.bankCharge.create({
      data: {
        tenantId,
        bankIntegrationId: integration.id,
        bankAccountId: dto.bankAccountId || integration.bankAccountId || null,
        financialRecordId: financialRecord.id,
        provider: integration.provider,
        chargeType,
        status: result.status,
        externalChargeId: result.externalChargeId || null,
        txid: result.txid || null,
        barcode: result.barcode || null,
        digitableLine: result.digitableLine || null,
        pixQrCode: result.pixQrCode || null,
        pixCopyPaste: result.pixCopyPaste || null,
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : financialRecord.dueDate || null,
        amount: outstandingAmount,
        rawRequest: this.toJson(result.rawRequest),
        rawResponse: this.toJson(result.rawResponse),
      },
      include: this.bankChargeInclude,
    });

    return {
      ...createdCharge,
      reusedExisting: false,
    };
  }

  async listPaymentRequests(tenantId: string) {
    return this.prisma.bankPaymentRequest.findMany({
      where: { tenantId },
      include: {
        bankIntegration: {
          select: { id: true, displayName: true, provider: true },
        },
        financialRecord: {
          select: { id: true, description: true, amount: true, dueDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createPaymentRequest(
    tenantId: string,
    dto: CreateBankPaymentRequestDto,
  ) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id: dto.bankIntegrationId, tenantId },
    });
    if (!integration) {
      throw new BadRequestException('Integração bancária não encontrada.');
    }

    const financialRecord = await this.prisma.financialRecord.findFirst({
      where: { id: dto.financialRecordId, tenantId },
    });
    if (!financialRecord) {
      throw new BadRequestException('Lançamento financeiro não encontrado.');
    }

    const provider = this.getProvider(integration.provider);
    const credentials = await this.loadCredentials(tenantId, integration);
    const result = await provider.createPayment(
      { integration, tenantId, credentials },
      {
        paymentType: dto.paymentType || 'PIX',
        amount: Number(financialRecord.amount),
        beneficiaryName: null,
        beneficiaryDocument: null,
        description: financialRecord.description,
      },
    );

    return this.prisma.bankPaymentRequest.create({
      data: {
        tenantId,
        bankIntegrationId: integration.id,
        bankAccountId: dto.bankAccountId || integration.bankAccountId || null,
        financialRecordId: financialRecord.id,
        provider: integration.provider,
        paymentType: dto.paymentType || 'PIX',
        status: result.status,
        externalPaymentId: result.externalPaymentId || null,
        beneficiaryName: result.beneficiaryName || null,
        beneficiaryDocument: result.beneficiaryDocument || null,
        amount: Number(financialRecord.amount),
        rawRequest: this.toJson(result.rawRequest),
        rawResponse: this.toJson(result.rawResponse),
      },
      include: {
        bankIntegration: {
          select: { id: true, displayName: true, provider: true },
        },
        financialRecord: {
          select: { id: true, description: true, amount: true, dueDate: true },
        },
      },
    });
  }

  async receiveWebhookEvent(
    integrationId: string,
    tenantId: string,
    dto: ReceiveBankWebhookDto,
  ) {
    const integration = await this.prisma.bankIntegration.findFirst({
      where: { id: integrationId, tenantId },
    });
    if (!integration) {
      throw new NotFoundException('Integração bancária não encontrada.');
    }

    return this.prisma.bankWebhookEvent.create({
      data: {
        tenantId,
        bankIntegrationId: integration.id,
        provider: integration.provider,
        eventType: dto.eventType || 'MANUAL_EVENT',
        externalEventId: dto.externalEventId || null,
        status: 'RECEIVED',
        rawPayload: this.toJson(dto.payload || {}),
      },
    });
  }

  async reconcileTransaction(
    transactionId: string,
    tenantId: string,
    dto: ReconcileBankTransactionDto,
    currentUserId: string,
  ) {
    const transaction = await this.prisma.bankTransaction.findFirst({
      where: { id: transactionId, tenantId },
    });
    if (!transaction) {
      throw new NotFoundException('Transação bancária não encontrada.');
    }

    const financialRecord = await this.prisma.financialRecord.findFirst({
      where: { id: dto.financialRecordId, tenantId },
    });
    if (!financialRecord) {
      throw new BadRequestException('Lançamento financeiro não encontrado.');
    }

    const reconciliation = await this.prisma.bankReconciliation.upsert({
      where: {
        bankTransactionId_financialRecordId: {
          bankTransactionId: transaction.id,
          financialRecordId: financialRecord.id,
        },
      },
      create: {
        tenantId,
        bankIntegrationId: transaction.bankIntegrationId,
        bankTransactionId: transaction.id,
        financialRecordId: financialRecord.id,
        matchType: dto.matchType || 'MANUAL',
        matchedBy: currentUserId,
        notes: dto.notes || null,
      },
      update: {
        matchType: dto.matchType || 'MANUAL',
        matchedBy: currentUserId,
        notes: dto.notes || null,
        matchedAt: new Date(),
      },
    });

    await this.prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: { reconciliationStatus: 'MATCHED' },
    });

    return reconciliation;
  }
}
