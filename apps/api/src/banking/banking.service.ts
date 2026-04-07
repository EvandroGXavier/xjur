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

  private async storeSecrets(
    tenantId: string,
    integrationId: string,
    credentials?: CreateBankIntegrationDto['credentials'],
  ) {
    if (!credentials) return;

    const existing = await this.securityService.listSecrets(
      tenantId,
      'BANK_INTEGRATION',
      integrationId,
    );

    const upsertSecret = async (description: string, data: any) => {
      const found = existing.find((item) => item.description === description);
      if (found) {
        await this.securityService.updateSecret(found.id, tenantId, data);
        return found.id;
      }

      const created = await this.securityService.createSecret(tenantId, {
        entityType: 'BANK_INTEGRATION',
        entityId: integrationId,
        description,
        ...data,
      });
      return created.id;
    };

    if (credentials.clientId || credentials.clientSecret || credentials.tokenUrl) {
      await upsertSecret('INTER_CLIENT', {
        username: credentials.clientId,
        password: credentials.clientSecret,
        details: credentials.tokenUrl || null,
      });
    }

    if (credentials.certificateBase64 || credentials.certificatePassword) {
      await upsertSecret('INTER_CERTIFICATE', {
        privateKey: credentials.certificateBase64,
        password: credentials.certificatePassword,
      });
    }

    if (credentials.webhookSecret) {
      await upsertSecret('INTER_WEBHOOK', {
        password: credentials.webhookSecret,
      });
    }
  }

  private async loadCredentials(tenantId: string, integrationId: string) {
    const secrets = await this.securityService.listSecrets(
      tenantId,
      'BANK_INTEGRATION',
      integrationId,
    );
    const client = secrets.find((item) => item.description === 'INTER_CLIENT');
    const certificate = secrets.find(
      (item) => item.description === 'INTER_CERTIFICATE',
    );
    const webhook = secrets.find((item) => item.description === 'INTER_WEBHOOK');

    return {
      clientId: client?.username || null,
      clientSecret: client?.password || null,
      tokenUrl: client?.details || null,
      certificateBase64: certificate?.privateKey || null,
      certificatePassword: certificate?.password || null,
      webhookSecret: webhook?.password || null,
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

    await this.storeSecrets(tenantId, integration.id, dto.credentials);

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

    await this.prisma.bankIntegration.update({
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

    await this.storeSecrets(tenantId, id, dto.credentials);

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
    const credentials = await this.loadCredentials(tenantId, integration.id);
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
    const credentials = await this.loadCredentials(tenantId, integration.id);

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

  async createCharge(tenantId: string, dto: CreateBankChargeDto) {
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
    const credentials = await this.loadCredentials(tenantId, integration.id);
    const result = await provider.createCharge(
      { integration, tenantId, credentials },
      {
        chargeType: dto.chargeType || 'PIX',
        amount: Number(financialRecord.amount),
        dueDate: dto.dueDate || financialRecord.dueDate?.toISOString() || null,
        payerName: null,
        payerDocument: null,
        description: financialRecord.description,
      },
    );

    return this.prisma.bankCharge.create({
      data: {
        tenantId,
        bankIntegrationId: integration.id,
        bankAccountId: dto.bankAccountId || integration.bankAccountId || null,
        financialRecordId: financialRecord.id,
        provider: integration.provider,
        chargeType: dto.chargeType || 'PIX',
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
    const credentials = await this.loadCredentials(tenantId, integration.id);
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
