import { Injectable } from '@nestjs/common';
import {
  BankingChargeResult,
  BankingHealthcheckResult,
  BankingPaymentResult,
  BankingProvider,
  BankingProviderContext,
  BankingSyncResult,
} from '../banking-provider.interface';

@Injectable()
export class InterBankingProvider implements BankingProvider {
  provider = 'INTER';

  private resolveMode(forceMockData?: boolean): 'MOCK' | 'LIVE' {
    if (forceMockData) return 'MOCK';
    return String(process.env.BANKING_INTER_MODE || 'MOCK').toUpperCase() ===
      'LIVE'
      ? 'LIVE'
      : 'MOCK';
  }

  async healthcheck(
    ctx: BankingProviderContext,
  ): Promise<BankingHealthcheckResult> {
    const mode = this.resolveMode();
    const checks = [
      {
        key: 'client_id',
        label: 'Client ID',
        status: ctx.credentials.clientId ? 'success' : 'warning',
        details: ctx.credentials.clientId
          ? 'Client ID configurado.'
          : 'Client ID ainda não configurado.',
      },
      {
        key: 'client_secret',
        label: 'Client Secret',
        status: ctx.credentials.clientSecret ? 'success' : 'warning',
        details: ctx.credentials.clientSecret
          ? 'Client Secret configurado.'
          : 'Client Secret ainda não configurado.',
      },
      {
        key: 'certificate',
        label: 'Certificado',
        status: ctx.credentials.certificateBase64 ? 'success' : 'warning',
        details: ctx.credentials.certificateBase64
          ? 'Certificado armazenado no cofre.'
          : 'Certificado ainda não configurado.',
      },
      {
        key: 'bank_account_link',
        label: 'Conta interna vinculada',
        status: ctx.integration.bankAccountId ? 'success' : 'warning',
        details: ctx.integration.bankAccountId
          ? 'Conta bancária do Xjur vinculada.'
          : 'Nenhuma conta bancária do Xjur vinculada à integração.',
      },
    ] as BankingHealthcheckResult['checks'];

    if (mode === 'MOCK') {
      checks.push({
        key: 'transport',
        label: 'Transporte Banco Inter',
        status: 'success',
        details:
          'Modo MOCK ativo. Fluxo liberado para homologação interna sem chamar a API do Inter.',
      });

      return {
        success: true,
        configured: true,
        mode,
        checks,
        message:
          'Integração Banco Inter pronta para homologação interna em modo MOCK.',
      };
    }

    const configured =
      Boolean(ctx.credentials.clientId) &&
      Boolean(ctx.credentials.clientSecret) &&
      Boolean(ctx.credentials.certificateBase64);

    checks.push({
      key: 'transport',
      label: 'Transporte Banco Inter',
      status: configured ? 'warning' : 'error',
      details: configured
        ? 'Credenciais principais presentes. A validação LIVE ainda depende de autenticação mTLS completa no ambiente.'
        : 'Faltam credenciais mínimas para operar em modo LIVE.',
    });

    return {
      success: false,
      configured,
      mode,
      checks,
      message: configured
        ? 'Integração configurada, mas a autenticação LIVE do Banco Inter ainda não foi validada automaticamente.'
        : 'Integração Banco Inter incompleta para operar em modo LIVE.',
    };
  }

  async syncTransactions(
    ctx: BankingProviderContext,
    params?: { startDate?: string; endDate?: string; forceMockData?: boolean },
  ): Promise<BankingSyncResult> {
    const mode = this.resolveMode(params?.forceMockData);

    if (mode === 'LIVE') {
      return {
        success: false,
        mode,
        transactions: [],
        message:
          'Sincronização LIVE do Banco Inter ainda depende da etapa final de autenticação mTLS/homologação oficial.',
      };
    }

    const now = new Date();
    const baseDate = params?.startDate ? new Date(params.startDate) : now;
    const transactions = [
      {
        externalTransactionId: `inter-mock-credit-${ctx.integration.id}-001`,
        direction: 'IN',
        entryType: 'PIX',
        occurredAt: baseDate.toISOString(),
        postedAt: baseDate.toISOString(),
        amount: 2500.0,
        description: 'Recebimento mock via Pix Banco Inter',
        counterpartyName: 'Cliente Exemplo',
        counterpartyDocument: '12345678901',
        txid: `TXID-${ctx.integration.id}-001`,
        endToEndId: `E2E-${ctx.integration.id}-001`,
        status: 'CAPTURED',
        rawPayload: {
          source: 'mock',
          provider: 'INTER',
          type: 'credit',
        },
      },
      {
        externalTransactionId: `inter-mock-debit-${ctx.integration.id}-002`,
        direction: 'OUT',
        entryType: 'PIX',
        occurredAt: new Date(now.getTime() - 86400000).toISOString(),
        postedAt: new Date(now.getTime() - 86400000).toISOString(),
        amount: -380.45,
        description: 'Pagamento mock via Pix Banco Inter',
        counterpartyName: 'Fornecedor Exemplo',
        counterpartyDocument: '98765432000100',
        txid: `TXID-${ctx.integration.id}-002`,
        endToEndId: `E2E-${ctx.integration.id}-002`,
        status: 'CAPTURED',
        rawPayload: {
          source: 'mock',
          provider: 'INTER',
          type: 'debit',
        },
      },
    ];

    return {
      success: true,
      mode,
      account: {
        currentBalance: 12119.55,
        externalAccountId:
          ctx.integration.externalAccountId || `inter-mock-${ctx.integration.id}`,
      },
      transactions,
      message:
        'Sincronização mock concluída. Dados de exemplo do Banco Inter persistidos no Xjur.',
    };
  }

  async createCharge(
    ctx: BankingProviderContext,
    params: {
      chargeType: string;
      amount: number;
      dueDate?: string | null;
      payerName?: string | null;
      payerDocument?: string | null;
      description: string;
    },
  ): Promise<BankingChargeResult> {
    const mode = this.resolveMode();

    if (mode === 'LIVE') {
      return {
        success: false,
        mode,
        chargeType: params.chargeType,
        status: 'PENDING_CONFIGURATION',
        message:
          'Cobrança LIVE do Banco Inter ainda depende da homologação final do fluxo oficial.',
      };
    }

    const reference = `inter-charge-${ctx.integration.id}-${Date.now()}`;
    const pixPayload =
      '00020126580014BR.GOV.BCB.PIX0136mock-banco-inter-chave5204000053039865406250.005802BR5913XJUR HOMOLOG6009SAO PAULO62140510INTERMOCK6304ABCD';

    return {
      success: true,
      mode,
      chargeType: params.chargeType,
      status: 'CREATED_MOCK',
      externalChargeId: reference,
      txid: params.chargeType === 'PIX' ? `TXID-${Date.now()}` : null,
      barcode:
        params.chargeType === 'BOLETO'
          ? '34191790010104351004791020150008291070026000'
          : null,
      digitableLine:
        params.chargeType === 'BOLETO'
          ? '34191.79001 01043.510047 91020.150008 2 91070026000'
          : null,
      pixQrCode: params.chargeType === 'PIX' ? pixPayload : null,
      pixCopyPaste: params.chargeType === 'PIX' ? pixPayload : null,
      rawRequest: { provider: 'INTER', ...params },
      rawResponse: { mock: true, reference },
      message: 'Cobrança mock criada no Banco Inter.',
    };
  }

  async createPayment(
    ctx: BankingProviderContext,
    params: {
      paymentType: string;
      amount: number;
      beneficiaryName?: string | null;
      beneficiaryDocument?: string | null;
      description: string;
    },
  ): Promise<BankingPaymentResult> {
    const mode = this.resolveMode();

    if (mode === 'LIVE') {
      return {
        success: false,
        mode,
        paymentType: params.paymentType,
        status: 'PENDING_CONFIGURATION',
        message:
          'Pagamento LIVE do Banco Inter ainda depende da homologação final do fluxo oficial.',
      };
    }

    const reference = `inter-payment-${ctx.integration.id}-${Date.now()}`;
    return {
      success: true,
      mode,
      paymentType: params.paymentType,
      status: 'REQUESTED_MOCK',
      externalPaymentId: reference,
      beneficiaryName: params.beneficiaryName || null,
      beneficiaryDocument: params.beneficiaryDocument || null,
      rawRequest: { provider: 'INTER', ...params },
      rawResponse: { mock: true, reference },
      message: 'Pagamento mock solicitado ao Banco Inter.',
    };
  }
}
