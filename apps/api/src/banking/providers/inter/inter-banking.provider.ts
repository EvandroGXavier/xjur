import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as https from 'https';
import {
  BankingChargeResult,
  BankingHealthcheckResult,
  BankingPaymentResult,
  BankingProvider,
  BankingProviderContext,
  BankingSyncResult,
} from '../banking-provider.interface';

type InterMode = 'MOCK' | 'LIVE';

interface InterRuntimeConfig {
  mode: InterMode;
  environment: 'SANDBOX' | 'PRODUCTION';
  apiBaseUrl: string;
  tokenUrl: string;
  chargePath: string;
  timeoutMs: number;
  tokenScope?: string;
  numDaysAgenda: number;
}

interface InterMetadataConfig {
  apiBaseUrl?: string;
  tokenUrl?: string;
  chargePath?: string;
  timeoutMs?: number;
  scope?: string | string[];
  numDaysAgenda?: number;
}

@Injectable()
export class InterBankingProvider implements BankingProvider {
  provider = 'INTER';
  private readonly tokenCache = new Map<
    string,
    {
      accessToken: string;
      expiresAt: number;
    }
  >();

  private resolveMode(forceMockData?: boolean): InterMode {
    if (forceMockData) return 'MOCK';
    return String(process.env.BANKING_INTER_MODE || 'MOCK').toUpperCase() ===
      'LIVE'
      ? 'LIVE'
      : 'MOCK';
  }

  private getMetadata(ctx: BankingProviderContext): InterMetadataConfig {
    const metadata =
      ctx.integration?.metadata &&
      typeof ctx.integration.metadata === 'object' &&
      !Array.isArray(ctx.integration.metadata)
        ? ctx.integration.metadata
        : {};

    const interMetadata =
      metadata.inter &&
      typeof metadata.inter === 'object' &&
      !Array.isArray(metadata.inter)
        ? metadata.inter
        : metadata;

    return interMetadata as InterMetadataConfig;
  }

  private getDefaultApiBaseUrl(environment: 'SANDBOX' | 'PRODUCTION') {
    return environment === 'PRODUCTION'
      ? 'https://cdpj.partners.bancointer.com.br'
      : 'https://cdpj-sandbox.partners.uatinter.co';
  }

  private ensureLeadingSlash(path: string) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private resolveRuntimeConfig(
    ctx: BankingProviderContext,
    forceMockData?: boolean,
  ): InterRuntimeConfig {
    const metadata = this.getMetadata(ctx);
    const environment =
      String(ctx.integration?.environment || 'SANDBOX').toUpperCase() ===
      'PRODUCTION'
        ? 'PRODUCTION'
        : 'SANDBOX';
    const apiBaseUrl = String(
      metadata.apiBaseUrl || this.getDefaultApiBaseUrl(environment),
    )
      .trim()
      .replace(/\/+$/, '');
    const tokenUrl = String(
      ctx.credentials.tokenUrl ||
        metadata.tokenUrl ||
        `${apiBaseUrl}/oauth/v2/token`,
    ).trim();
    const chargePath = this.ensureLeadingSlash(
      String(metadata.chargePath || '/cobranca/v3/cobrancas').trim(),
    );
    const timeoutMs = Math.max(5000, Number(metadata.timeoutMs || 30000));
    const rawScope = metadata.scope;
    const tokenScope = Array.isArray(rawScope)
      ? rawScope.filter(Boolean).join(' ').trim()
      : String(rawScope || '').trim() || undefined;

    return {
      mode: this.resolveMode(forceMockData),
      environment,
      apiBaseUrl,
      tokenUrl,
      chargePath,
      timeoutMs,
      tokenScope,
      numDaysAgenda: Math.max(0, Number(metadata.numDaysAgenda || 60)),
    };
  }

  private hasMainCredentials(ctx: BankingProviderContext) {
    const hasCertificatePair = Boolean(
      ctx.credentials.certificatePem && ctx.credentials.privateKeyPem,
    );

    return Boolean(
      ctx.credentials.clientId &&
        ctx.credentials.clientSecret &&
        (ctx.credentials.certificateBase64 || hasCertificatePair),
    );
  }

  private decodeCertificate(base64Value: string) {
    const cleaned = String(base64Value || '').trim();
    if (!cleaned) {
      throw new Error('Certificado A1 em Base64 nao informado.');
    }

    if (cleaned.includes('-----BEGIN')) {
      throw new Error(
        'O provider LIVE do Banco Inter espera um certificado A1 em PFX/P12 codificado em Base64.',
      );
    }

    const normalized = cleaned.replace(/\s+/g, '');
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length) {
      throw new Error('Nao foi possivel decodificar o certificado A1 em Base64.');
    }

    return buffer;
  }

  private createHttpsAgent(ctx: BankingProviderContext) {
    if (ctx.credentials.certificatePem && ctx.credentials.privateKeyPem) {
      return new https.Agent({
        cert: ctx.credentials.certificatePem,
        key: ctx.credentials.privateKeyPem,
        passphrase: ctx.credentials.certificatePassword || undefined,
        keepAlive: true,
        rejectUnauthorized: true,
      });
    }

    if (!ctx.credentials.certificateBase64) {
      throw new Error(
        'Certificado do Banco Inter nao configurado para a integracao.',
      );
    }

    return new https.Agent({
      pfx: this.decodeCertificate(ctx.credentials.certificateBase64),
      passphrase: ctx.credentials.certificatePassword || undefined,
      keepAlive: true,
      rejectUnauthorized: true,
    });
  }

  private buildTokenCacheKey(
    ctx: BankingProviderContext,
    config: InterRuntimeConfig,
  ) {
    return [
      ctx.integration.id,
      config.environment,
      config.tokenUrl,
      config.tokenScope || '',
    ].join(':');
  }

  private buildTokenErrorMessage(error: unknown) {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      const details =
        typeof responseData === 'string'
          ? responseData
          : responseData?.title ||
            responseData?.message ||
            responseData?.detail ||
            responseData?.error_description ||
            responseData?.error ||
            null;

      return details
        ? `Falha ao autenticar no Banco Inter: ${details}`
        : `Falha ao autenticar no Banco Inter (HTTP ${error.response?.status || 'sem-status'}).`;
    }

    return error instanceof Error
      ? error.message
      : 'Falha desconhecida ao autenticar no Banco Inter.';
  }

  private buildRequestErrorMessage(error: unknown, fallback: string) {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      const details =
        typeof responseData === 'string'
          ? responseData
          : responseData?.title ||
            responseData?.message ||
            responseData?.detail ||
            responseData?.error ||
            responseData?.violacoes?.map?.((item: any) => item?.razao)?.join('; ') ||
            null;

      return details
        ? `${fallback}: ${details}`
        : `${fallback} (HTTP ${error.response?.status || 'sem-status'}).`;
    }

    return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
  }

  private async fetchAccessToken(
    ctx: BankingProviderContext,
    config: InterRuntimeConfig,
  ) {
    const cacheKey = this.buildTokenCacheKey(ctx, config);
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 15000) {
      return cached.accessToken;
    }

    if (!ctx.credentials.clientId || !ctx.credentials.clientSecret) {
      throw new Error('Client ID e Client Secret sao obrigatorios para o Banco Inter.');
    }

    const body = new URLSearchParams();
    body.set('client_id', ctx.credentials.clientId);
    body.set('client_secret', ctx.credentials.clientSecret);
    body.set('grant_type', 'client_credentials');
    if (config.tokenScope) {
      body.set('scope', config.tokenScope);
    }

    const httpsAgent = this.createHttpsAgent(ctx);

    try {
      const response = await axios.post(config.tokenUrl, body.toString(), {
        httpsAgent,
        timeout: config.timeoutMs,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const accessToken = String(response.data?.access_token || '').trim();
      if (!accessToken) {
        throw new Error('O Banco Inter nao retornou access_token na autenticacao.');
      }

      const expiresIn = Math.max(60, Number(response.data?.expires_in || 300));
      this.tokenCache.set(cacheKey, {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return accessToken;
    } catch (error) {
      throw new Error(this.buildTokenErrorMessage(error));
    }
  }

  private async requestInter<T>(
    ctx: BankingProviderContext,
    config: InterRuntimeConfig,
    request: {
      method: 'GET' | 'POST';
      url: string;
      data?: Record<string, any>;
    },
  ) {
    const accessToken = await this.fetchAccessToken(ctx, config);
    const httpsAgent = this.createHttpsAgent(ctx);

    const response = await axios.request<T>({
      method: request.method,
      baseURL: config.apiBaseUrl,
      url: request.url,
      data: request.data,
      httpsAgent,
      timeout: config.timeoutMs,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-conta-corrente': ctx.integration.accountNumber || undefined,
      },
    });

    return response.data;
  }

  private truncate(value: string, maxLength: number) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.length > maxLength
      ? normalized.slice(0, maxLength)
      : normalized;
  }

  private normalizeDateInput(value?: string | null) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  private normalizePhone(value?: string | null) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length <= 2) {
      return {
        ddd: null,
        telefone: digits,
      };
    }

    return {
      ddd: digits.slice(0, 2),
      telefone: digits.slice(2, 11),
    };
  }

  private buildPagador(params: {
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
  }) {
    const document = String(params.payerDocument || '').replace(/\D/g, '');
    if (!document) {
      throw new Error('O pagador da cobranca precisa ter CPF ou CNPJ.');
    }

    const pagador: Record<string, any> = {
      cpfCnpj: document,
      tipoPessoa: document.length > 11 ? 'JURIDICA' : 'FISICA',
      nome: this.truncate(String(params.payerName || ''), 100),
    };

    if (!pagador.nome) {
      throw new Error('O pagador da cobranca precisa ter nome.');
    }

    if (params.payerEmail) {
      pagador.email = this.truncate(params.payerEmail, 120);
    }

    const phone = this.normalizePhone(params.payerPhone);
    if (phone?.ddd) pagador.ddd = phone.ddd;
    if (phone?.telefone) pagador.telefone = phone.telefone;

    if (params.payerAddress) {
      const zipCode = String(params.payerAddress.zipCode || '').replace(/\D/g, '');
      if (zipCode) pagador.cep = zipCode;
      if (params.payerAddress.street) {
        pagador.endereco = this.truncate(params.payerAddress.street, 100);
      }
      if (params.payerAddress.number) {
        pagador.numero = this.truncate(params.payerAddress.number, 20);
      }
      if (params.payerAddress.complement) {
        pagador.complemento = this.truncate(
          params.payerAddress.complement,
          30,
        );
      }
      if (params.payerAddress.district) {
        pagador.bairro = this.truncate(params.payerAddress.district, 60);
      }
      if (params.payerAddress.city) {
        pagador.cidade = this.truncate(params.payerAddress.city, 60);
      }
      if (params.payerAddress.state) {
        pagador.uf = this.truncate(params.payerAddress.state.toUpperCase(), 2);
      }
    }

    return pagador;
  }

  private buildBoletoPayload(
    ctx: BankingProviderContext,
    config: InterRuntimeConfig,
    params: {
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
  ) {
    const dueDate = this.normalizeDateInput(params.dueDate);
    if (!dueDate) {
      throw new Error(
        'A cobranca LIVE do Banco Inter exige uma data de vencimento valida.',
      );
    }

    const seuNumero = crypto
      .createHash('sha1')
      .update(`${ctx.integration.id}:${Date.now()}:${params.description}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    return {
      seuNumero,
      valorNominal: Number(Number(params.amount || 0).toFixed(2)),
      dataVencimento: dueDate,
      numDiasAgenda: config.numDaysAgenda,
      pagador: this.buildPagador(params),
      mensagem: {
        linha1: this.truncate(params.description || ctx.integration.displayName, 80),
      },
    };
  }

  private pickString(...values: unknown[]) {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
    }
    return null;
  }

  private extractChargeResult(
    chargeType: string,
    payload: Record<string, any>,
    responseData: any,
  ): BankingChargeResult {
    const boleto = responseData?.boleto || responseData?.boletoDetalhe || {};
    const pix = responseData?.pix || responseData?.pixDetalhe || {};

    return {
      success: true,
      mode: 'LIVE',
      chargeType,
      status:
        this.pickString(
          responseData?.situacao,
          responseData?.status,
          boleto?.situacao,
          boleto?.status,
          'CREATED',
        ) || 'CREATED',
      externalChargeId: this.pickString(
        responseData?.codigoSolicitacao,
        responseData?.id,
        responseData?.nossoNumero,
        payload.seuNumero,
      ),
      txid: this.pickString(responseData?.txid, pix?.txid),
      barcode: this.pickString(
        responseData?.codigoBarras,
        boleto?.codigoBarras,
        responseData?.barcode,
      ),
      digitableLine: this.pickString(
        responseData?.linhaDigitavel,
        boleto?.linhaDigitavel,
        responseData?.digitableLine,
      ),
      pixQrCode: this.pickString(
        responseData?.qrCode,
        responseData?.pixQrCode,
        pix?.qrCode,
      ),
      pixCopyPaste: this.pickString(
        responseData?.pixCopiaECola,
        responseData?.copiaECola,
        pix?.copiaECola,
      ),
      rawRequest: payload,
      rawResponse: responseData,
      message: 'Cobranca LIVE criada no Banco Inter.',
    };
  }

  async healthcheck(
    ctx: BankingProviderContext,
  ): Promise<BankingHealthcheckResult> {
    const config = this.resolveRuntimeConfig(ctx);
    const checks = [
      {
        key: 'client_id',
        label: 'Client ID',
        status: ctx.credentials.clientId ? 'success' : 'warning',
        details: ctx.credentials.clientId
          ? 'Client ID configurado.'
          : 'Client ID ainda nao configurado.',
      },
      {
        key: 'client_secret',
        label: 'Client Secret',
        status: ctx.credentials.clientSecret ? 'success' : 'warning',
        details: ctx.credentials.clientSecret
          ? 'Client Secret configurado.'
          : 'Client Secret ainda nao configurado.',
      },
      {
        key: 'certificate',
        label: 'Certificado / Chave',
        status:
          ctx.credentials.certificateBase64 ||
          (ctx.credentials.certificatePem && ctx.credentials.privateKeyPem)
            ? 'success'
            : 'warning',
        details:
          ctx.credentials.certificateBase64 ||
          (ctx.credentials.certificatePem && ctx.credentials.privateKeyPem)
            ? 'Material criptografico armazenado no cofre.'
            : 'Certificado e chave ainda nao configurados.',
      },
      {
        key: 'bank_account_link',
        label: 'Conta interna vinculada',
        status: ctx.integration.bankAccountId ? 'success' : 'warning',
        details: ctx.integration.bankAccountId
          ? 'Conta bancaria do Xjur vinculada.'
          : 'Nenhuma conta bancaria do Xjur vinculada a integracao.',
      },
    ] as BankingHealthcheckResult['checks'];

    if (config.mode === 'MOCK') {
      checks.push({
        key: 'transport',
        label: 'Transporte Banco Inter',
        status: 'success',
        details:
          'Modo MOCK ativo. Fluxo liberado para homologacao interna sem chamar a API do Inter.',
      });

      return {
        success: true,
        configured: true,
        mode: config.mode,
        checks,
        message:
          'Integracao Banco Inter pronta para homologacao interna em modo MOCK.',
      };
    }

    const configured = this.hasMainCredentials(ctx);
    if (!configured) {
      checks.push({
        key: 'transport',
        label: 'Transporte Banco Inter',
        status: 'error',
        details:
          'Faltam Client ID, Client Secret ou o conjunto certificado/chave para operar em LIVE.',
      });

      return {
        success: false,
        configured,
        mode: config.mode,
        checks,
        message: 'Integracao Banco Inter incompleta para operar em modo LIVE.',
      };
    }

    try {
      await this.fetchAccessToken(ctx, config);

      checks.push({
        key: 'transport',
        label: 'Transporte Banco Inter',
        status: 'success',
        details:
          'Autenticacao mTLS validada com sucesso no Banco Inter para este ambiente.',
      });

      return {
        success: true,
        configured: true,
        mode: config.mode,
        checks,
        message:
          'Integracao Banco Inter validada com autenticacao mTLS e token em ambiente LIVE.',
      };
    } catch (error) {
      checks.push({
        key: 'transport',
        label: 'Transporte Banco Inter',
        status: 'error',
        details: this.buildTokenErrorMessage(error),
      });

      return {
        success: false,
        configured: true,
        mode: config.mode,
        checks,
        message: this.buildTokenErrorMessage(error),
      };
    }
  }

  async syncTransactions(
    ctx: BankingProviderContext,
    params?: { startDate?: string; endDate?: string; forceMockData?: boolean },
  ): Promise<BankingSyncResult> {
    const config = this.resolveRuntimeConfig(ctx, params?.forceMockData);

    if (config.mode === 'LIVE') {
      return {
        success: false,
        mode: config.mode,
        transactions: [],
        message:
          'Sincronizacao LIVE do Banco Inter ainda depende da etapa dedicada de extrato e saldos.',
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
      mode: config.mode,
      account: {
        currentBalance: 12119.55,
        externalAccountId:
          ctx.integration.externalAccountId || `inter-mock-${ctx.integration.id}`,
      },
      transactions,
      message:
        'Sincronizacao mock concluida. Dados de exemplo do Banco Inter persistidos no Xjur.',
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
  ): Promise<BankingChargeResult> {
    const config = this.resolveRuntimeConfig(ctx);

    if (config.mode === 'MOCK') {
      const reference = `inter-charge-${ctx.integration.id}-${Date.now()}`;
      const pixPayload =
        '00020126580014BR.GOV.BCB.PIX0136mock-banco-inter-chave5204000053039865406250.005802BR5913XJUR HOMOLOG6009SAO PAULO62140510INTERMOCK6304ABCD';

      return {
        success: true,
        mode: config.mode,
        chargeType: params.chargeType,
        status: 'CREATED_MOCK',
        externalChargeId: reference,
        txid: `TXID-${Date.now()}`,
        barcode:
          params.chargeType === 'BOLETO'
            ? '34191790010104351004791020150008291070026000'
            : null,
        digitableLine:
          params.chargeType === 'BOLETO'
            ? '34191.79001 01043.510047 91020.150008 2 91070026000'
            : null,
        // Boleto híbrido Inter: todo boleto também carrega QR Code PIX
        pixQrCode: pixPayload,
        pixCopyPaste: pixPayload,
        rawRequest: { provider: 'INTER', ...params },
        rawResponse: { mock: true, reference },
        message: 'Cobranca mock criada no Banco Inter.',
      };
    }

    if (String(params.chargeType || '').toUpperCase() !== 'BOLETO') {
      return {
        success: false,
        mode: config.mode,
        chargeType: params.chargeType,
        status: 'NOT_SUPPORTED',
        message:
          'A emissao LIVE implementada nesta etapa cobre boleto/cobranca do Banco Inter. Pix cobranca ficara no bloco dedicado do provider.',
      };
    }

    try {
      const payload = this.buildBoletoPayload(ctx, config, params);
      const responseData = await this.requestInter<any>(ctx, config, {
        method: 'POST',
        url: config.chargePath,
        data: payload,
      });

      return this.extractChargeResult(params.chargeType, payload, responseData);
    } catch (error) {
      return {
        success: false,
        mode: config.mode,
        chargeType: params.chargeType,
        status: 'ERROR',
        rawRequest: {
          chargeType: params.chargeType,
          amount: params.amount,
          dueDate: params.dueDate,
          payerName: params.payerName,
          payerDocument: params.payerDocument,
        },
        message: this.buildRequestErrorMessage(
          error,
          'Nao foi possivel criar a cobranca LIVE no Banco Inter',
        ),
      };
    }
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
    const config = this.resolveRuntimeConfig(ctx);

    if (config.mode === 'LIVE') {
      return {
        success: false,
        mode: config.mode,
        paymentType: params.paymentType,
        status: 'PENDING_CONFIGURATION',
        message:
          'Pagamento LIVE do Banco Inter ainda depende da homologacao final do fluxo oficial.',
      };
    }

    const reference = `inter-payment-${ctx.integration.id}-${Date.now()}`;
    return {
      success: true,
      mode: config.mode,
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
