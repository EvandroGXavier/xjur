export interface BankingHealthcheckResult {
  success: boolean;
  mode: 'MOCK' | 'LIVE';
  configured: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: 'success' | 'warning' | 'error';
    details: string;
  }>;
  message: string;
}

export interface BankingSyncResult {
  success: boolean;
  mode: 'MOCK' | 'LIVE';
  account?: {
    currentBalance: number;
    externalAccountId?: string | null;
  };
  transactions: Array<{
    externalTransactionId: string;
    direction: string;
    entryType: string;
    occurredAt: string;
    postedAt?: string | null;
    amount: number;
    feeAmount?: number | null;
    description: string;
    counterpartyName?: string | null;
    counterpartyDocument?: string | null;
    txid?: string | null;
    endToEndId?: string | null;
    status?: string;
    rawPayload?: Record<string, any>;
  }>;
  message: string;
}

export interface BankingProviderContext {
  integration: any;
  tenantId: string;
  credentials: {
    clientId?: string | null;
    clientSecret?: string | null;
    certificatePassword?: string | null;
    certificateBase64?: string | null;
    webhookSecret?: string | null;
    tokenUrl?: string | null;
  };
}

export interface BankingChargeResult {
  success: boolean;
  mode: 'MOCK' | 'LIVE';
  chargeType: string;
  status: string;
  externalChargeId?: string | null;
  txid?: string | null;
  barcode?: string | null;
  digitableLine?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  rawRequest?: Record<string, any>;
  rawResponse?: Record<string, any>;
  message: string;
}

export interface BankingPaymentResult {
  success: boolean;
  mode: 'MOCK' | 'LIVE';
  paymentType: string;
  status: string;
  externalPaymentId?: string | null;
  beneficiaryName?: string | null;
  beneficiaryDocument?: string | null;
  rawRequest?: Record<string, any>;
  rawResponse?: Record<string, any>;
  message: string;
}

export interface BankingProvider {
  provider: string;
  healthcheck(ctx: BankingProviderContext): Promise<BankingHealthcheckResult>;
  syncTransactions(
    ctx: BankingProviderContext,
    params?: { startDate?: string; endDate?: string; forceMockData?: boolean },
  ): Promise<BankingSyncResult>;
  createCharge(
    ctx: BankingProviderContext,
    params: {
      chargeType: string;
      amount: number;
      dueDate?: string | null;
      payerName?: string | null;
      payerDocument?: string | null;
      payerEmail?: string | null;
      payerPhone?: string | null;
      payerAddress?: {
        zipCode?: string | null;
        street?: string | null;
        number?: string | null;
        complement?: string | null;
        district?: string | null;
        city?: string | null;
        state?: string | null;
      } | null;
      description: string;
    },
  ): Promise<BankingChargeResult>;
  createPayment(
    ctx: BankingProviderContext,
    params: {
      paymentType: string;
      amount: number;
      beneficiaryName?: string | null;
      beneficiaryDocument?: string | null;
      description: string;
    },
  ): Promise<BankingPaymentResult>;
}
