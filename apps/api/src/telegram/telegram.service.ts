import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import FormData from 'form-data';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import { WhisperTranscription } from './utils/whisper.util';
import { PdfExtractor } from './utils/pdf.util';

type TelegramSendOptions = {
  replyToMessageId?: number;
  disableNotification?: boolean;
};

type TelegramOutboundInput = TelegramSendOptions & {
  connectionId: string;
  chatId: string;
  text?: string;
  contentType?: string | null;
  mediaPath?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly TELEGRAM_MESSAGE_LIMIT = 4096;
  private readonly TELEGRAM_CAPTION_LIMIT = 1024;

  constructor(private readonly prisma: PrismaService) {}

  private normalizeConfig(config: any) {
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  }

  private async getConnection(connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.type !== 'TELEGRAM') {
      throw new NotFoundException('Conexao Telegram nao encontrada');
    }

    return connection;
  }

  private getBotToken(connection: any) {
    const config = this.normalizeConfig(connection.config);
    return String(config.botToken || '').trim();
  }

  private getWebhookBaseUrl(connection: any) {
    const config = this.normalizeConfig(connection.config);
    const fromConfig = String(config.webhookBaseUrl || '').trim();
    const fromEnv =
      String(process.env.TELEGRAM_WEBHOOK_BASE_URL || '').trim() ||
      String(process.env.APP_URL || '').trim();

    return (fromConfig || fromEnv).replace(/\/+$/, '');
  }

  private isPrivateHostname(hostname: string) {
    const normalized = String(hostname || '').trim().toLowerCase();

    if (!normalized) return true;
    if (
      normalized === 'localhost' ||
      normalized === '0.0.0.0' ||
      normalized.endsWith('.local') ||
      normalized.endsWith('.internal')
    ) {
      return true;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
      const [first, second] = normalized.split('.').map((part) => Number(part));
      if (first === 10 || first === 127) return true;
      if (first === 169 && second === 254) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
      if (first === 192 && second === 168) return true;
    }

    return false;
  }

  private validateWebhookBaseUrl(baseUrl: string) {
    if (!baseUrl) {
      throw new BadRequestException(
        'Defina TELEGRAM_WEBHOOK_BASE_URL, APP_URL ou webhookBaseUrl na conexao Telegram.',
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(baseUrl);
    } catch (_error) {
      throw new BadRequestException(
        'Webhook Base URL do Telegram invalida. Informe uma URL publica completa, como https://seu-dominio.com.',
      );
    }

    const allowInsecureWebhook = String(process.env.ALLOW_INSECURE_TELEGRAM_WEBHOOK || '')
      .trim()
      .toLowerCase() === 'true';

    if (parsed.protocol !== 'https:' && !allowInsecureWebhook) {
      throw new BadRequestException(
        'O webhook do Telegram exige HTTPS publico. Ajuste APP_URL/webhookBaseUrl ou habilite ALLOW_INSECURE_TELEGRAM_WEBHOOK apenas para testes controlados.',
      );
    }

    if (this.isPrivateHostname(parsed.hostname) && !allowInsecureWebhook) {
      throw new BadRequestException(
        'A URL base do webhook do Telegram nao pode apontar para localhost, IP privado ou endereco interno.',
      );
    }

    return parsed.toString().replace(/\/+$/, '');
  }

  private buildWebhookUrl(connection: any) {
    const baseUrl = this.validateWebhookBaseUrl(this.getWebhookBaseUrl(connection));

    return `${baseUrl}/api/communications/channels/telegram/${connection.id}/webhook`;
  }

  private getWebhookSecret(connection: any) {
    const config = this.normalizeConfig(connection.config);
    return String(config.webhookSecret || '').trim();
  }

  private buildExternalMessageId(chatId: string, messageId: number | string | null | undefined) {
    return `${chatId}:${String(messageId || '').trim()}`;
  }

  private normalizeTelegramText(input?: string | null) {
    return String(input || '').trim();
  }

  private splitLongText(text: string) {
    const normalized = this.normalizeTelegramText(text);
    if (!normalized) return [];
    if (normalized.length <= this.TELEGRAM_MESSAGE_LIMIT) return [normalized];

    const chunks: string[] = [];
    let remaining = normalized;

    while (remaining.length > this.TELEGRAM_MESSAGE_LIMIT) {
      let splitAt = remaining.lastIndexOf('\n\n', this.TELEGRAM_MESSAGE_LIMIT);
      if (splitAt < Math.floor(this.TELEGRAM_MESSAGE_LIMIT * 0.6)) {
        splitAt = remaining.lastIndexOf('\n', this.TELEGRAM_MESSAGE_LIMIT);
      }
      if (splitAt < Math.floor(this.TELEGRAM_MESSAGE_LIMIT * 0.6)) {
        splitAt = remaining.lastIndexOf(' ', this.TELEGRAM_MESSAGE_LIMIT);
      }
      if (splitAt <= 0) {
        splitAt = this.TELEGRAM_MESSAGE_LIMIT;
      }

      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks.filter(Boolean);
  }

  private resolveTelegramSendMethod(contentType?: string | null) {
    switch (String(contentType || 'FILE').trim().toUpperCase()) {
      case 'IMAGE':
        return { method: 'sendPhoto', field: 'photo' };
      case 'AUDIO':
        return { method: 'sendAudio', field: 'audio' };
      case 'VIDEO':
        return { method: 'sendVideo', field: 'video' };
      default:
        return { method: 'sendDocument', field: 'document' };
    }
  }

  private async persistConnectionState(
    connectionId: string,
    status: string,
    configPatch: Record<string, any>,
  ) {
    const connection = await this.getConnection(connectionId);
    const nextConfig = {
      ...this.normalizeConfig(connection.config),
      ...configPatch,
    };

    return this.prisma.connection.update({
      where: { id: connectionId },
      data: {
        status,
        config: nextConfig,
      },
    });
  }

  private async persistConnectionFailure(
    connectionId: string,
    error: any,
    extras?: Record<string, any>,
  ) {
    const message =
      error?.response?.data?.description ||
      error?.response?.data?.message ||
      error?.message ||
      'Falha operacional no canal Telegram.';

    this.logger.error(`Telegram failure connection=${connectionId}: ${message}`);

    await this.persistConnectionState(connectionId, 'ERROR', {
      lastError: message,
      lastErrorMessage: message,
      lastErrorAt: new Date().toISOString(),
      ...extras,
    });
  }

  private async apiRequest(token: string, method: string, payload?: any) {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/${method}`,
        payload || {},
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000,
        },
      );

      if (!response.data?.ok) {
        throw new BadRequestException(
          response.data?.description || `Falha ao executar ${method} no Telegram.`,
        );
      }

      return response.data.result;
    } catch (error: any) {
      const description =
        error?.response?.data?.description ||
        error?.response?.data?.message ||
        error?.message ||
        `Falha ao executar ${method} no Telegram.`;

      if (error?.response?.status === 401 || /unauthorized/i.test(description)) {
        throw new UnauthorizedException(description);
      }

      if (error?.response?.status >= 500 || !error?.response) {
        throw new InternalServerErrorException(description);
      }

      throw new BadRequestException(description);
    }
  }

  private async apiMultipartRequest(
    token: string,
    method: string,
    form: FormData,
  ) {
    try {
      const response = await axios.post(`https://api.telegram.org/bot${token}/${method}`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000,
      });

      if (!response.data?.ok) {
        throw new BadRequestException(
          response.data?.description || `Falha ao executar ${method} no Telegram.`,
        );
      }

      return response.data.result;
    } catch (error: any) {
      const description =
        error?.response?.data?.description ||
        error?.response?.data?.message ||
        error?.message ||
        `Falha ao executar ${method} no Telegram.`;

      if (error?.response?.status === 401 || /unauthorized/i.test(description)) {
        throw new UnauthorizedException(description);
      }

      if (error?.response?.status >= 500 || !error?.response) {
        throw new InternalServerErrorException(description);
      }

      throw new BadRequestException(description);
    }
  }

  async connect(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const config = this.normalizeConfig(connection.config);
    const botToken = this.getBotToken(connection);

    if (!botToken) {
      throw new BadRequestException('Informe o botToken da conexao Telegram antes de conectar.');
    }

    const webhookSecret = this.getWebhookSecret(connection) || randomBytes(24).toString('hex');
    const webhookUrl = this.buildWebhookUrl(connection);
    let webhookConfigured = false;

    await this.persistConnectionState(connection.id, 'PAIRING', {
      lastError: null,
      lastErrorMessage: null,
      pendingUpdateCount: null,
      webhookUrl,
      webhookExpectedUrl: webhookUrl,
      lastWebhookCheckAt: new Date().toISOString(),
    });

    try {
      const me = await this.apiRequest(botToken, 'getMe');

      await this.apiRequest(botToken, 'setWebhook', {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: false,
      });
      webhookConfigured = true;

      const webhookInfo = await this.apiRequest(botToken, 'getWebhookInfo');
      if (String(webhookInfo?.url || '').trim() !== webhookUrl) {
        throw new BadRequestException(
          'O Telegram confirmou a conexao, mas o webhook registrado nao corresponde ao webhook esperado.',
        );
      }

      const updatedConfig = {
        ...config,
        webhookSecret,
        webhookUrl,
        webhookExpectedUrl: webhookUrl,
        webhookStatus: 'SYNCED',
        botUsername: me?.username || null,
        botId: me?.id || null,
        botFirstName: me?.first_name || null,
        pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
        lastError: null,
        lastErrorMessage: null,
        lastErrorDate: webhookInfo?.last_error_date || null,
        lastConnectedAt: new Date().toISOString(),
        lastWebhookCheckAt: new Date().toISOString(),
      };

      await this.prisma.connection.update({
        where: { id: connection.id },
        data: {
          status: 'CONNECTED',
          config: updatedConfig,
        },
      });

      return {
        status: 'CONNECTED',
        webhookUrl,
        botUsername: updatedConfig.botUsername,
        botId: updatedConfig.botId,
        message: 'Telegram conectado com webhook configurado.',
      };
    } catch (error: any) {
      if (webhookConfigured) {
        try {
          await this.apiRequest(botToken, 'deleteWebhook', {
            drop_pending_updates: false,
          });
        } catch (cleanupError: any) {
          this.logger.warn(
            `Falha ao remover webhook Telegram apos erro de conexao ${connectionId}: ${cleanupError?.message || cleanupError}`,
          );
        }
      }

      await this.persistConnectionFailure(connection.id, error, {
        webhookUrl: null,
        webhookExpectedUrl: webhookUrl,
        webhookStatus: 'ERROR',
      });
      throw error;
    }
  }

  async disconnect(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const config = this.normalizeConfig(connection.config);
    const botToken = this.getBotToken(connection);

    if (botToken) {
      try {
        await this.apiRequest(botToken, 'deleteWebhook', {
          drop_pending_updates: false,
        });
      } catch (error: any) {
        this.logger.warn(
          `Falha ao remover webhook remoto do Telegram connection=${connectionId}: ${error?.message || error}`,
        );
      }
    }

    await this.prisma.connection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        config: {
          ...config,
          webhookUrl: null,
          webhookExpectedUrl: null,
          webhookStatus: 'DISCONNECTED',
          pendingUpdateCount: 0,
          lastError: null,
          lastErrorMessage: null,
          lastErrorDate: null,
          lastWebhookCheckAt: new Date().toISOString(),
          lastDisconnectedAt: new Date().toISOString(),
        },
      },
    });

    return { status: 'DISCONNECTED', message: 'Telegram desconectado.' };
  }

  async getStatus(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const config = this.normalizeConfig(connection.config);
    const botToken = this.getBotToken(connection);

    if (!botToken) {
      return {
        status: 'DISCONNECTED',
        configured: false,
        webhookUrl: config.webhookUrl || null,
        expectedWebhookUrl: null,
      };
    }

    try {
      const expectedWebhookUrl = this.buildWebhookUrl(connection);
      const botInfo = await this.apiRequest(botToken, 'getMe');
      const webhookInfo = await this.apiRequest(botToken, 'getWebhookInfo');
      const registeredWebhookUrl = String(webhookInfo?.url || '').trim() || null;
      const webhookMatches = registeredWebhookUrl === expectedWebhookUrl;
      const actualStatus = registeredWebhookUrl
        ? webhookMatches
          ? 'CONNECTED'
          : 'ERROR'
        : 'DISCONNECTED';

      if (
        actualStatus !== connection.status ||
        config.webhookUrl !== registeredWebhookUrl ||
        config.lastErrorMessage !== (webhookInfo?.last_error_message || null) ||
        config.pendingUpdateCount !== (webhookInfo?.pending_update_count ?? 0)
      ) {
        await this.persistConnectionState(connection.id, actualStatus, {
          webhookUrl: registeredWebhookUrl,
          webhookExpectedUrl: expectedWebhookUrl,
          webhookStatus: registeredWebhookUrl
            ? webhookMatches
              ? 'SYNCED'
              : 'MISMATCH'
            : 'DISCONNECTED',
          pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
          lastError: webhookInfo?.last_error_message || null,
          lastErrorMessage: webhookInfo?.last_error_message || null,
          lastErrorDate: webhookInfo?.last_error_date || null,
          lastWebhookCheckAt: new Date().toISOString(),
          botUsername: botInfo?.username || config.botUsername || null,
          botId: botInfo?.id || config.botId || null,
          botFirstName: botInfo?.first_name || config.botFirstName || null,
        });
      }

      return {
        status: actualStatus,
        configured: true,
        webhookUrl: registeredWebhookUrl,
        expectedWebhookUrl,
        webhookMatches,
        pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
        lastErrorDate: webhookInfo?.last_error_date || null,
        lastErrorMessage: webhookInfo?.last_error_message || null,
        botUsername: botInfo?.username || config.botUsername || null,
      };
    } catch (error: any) {
      await this.persistConnectionFailure(connection.id, error, {
        webhookStatus: 'ERROR',
      });
      return {
        status: 'ERROR',
        configured: true,
        webhookUrl: config.webhookUrl || null,
        expectedWebhookUrl: config.webhookExpectedUrl || null,
        webhookMatches: false,
        lastErrorMessage: error?.message || 'Falha ao consultar status do Telegram.',
      };
    }
  }

  async assertWebhookRequest(connectionId: string, receivedSecret?: string) {
    const connection = await this.getConnection(connectionId);
    const secret = this.getWebhookSecret(connection);

    if (!secret) {
      throw new UnauthorizedException('Webhook Telegram sem secret configurado.');
    }

    if (secret !== String(receivedSecret || '').trim()) {
      throw new UnauthorizedException('Secret do webhook Telegram invalido.');
    }

    return connection;
  }

  async sendMessageByConnection(
    connectionId: string,
    chatId: string,
    text: string,
    options?: TelegramSendOptions,
  ) {
    return this.sendOutboundMessage({
      connectionId,
      chatId,
      text,
      replyToMessageId: options?.replyToMessageId,
      disableNotification: options?.disableNotification,
    });
  }

  async sendOutboundMessage(input: TelegramOutboundInput) {
    const connection = await this.getConnection(input.connectionId);
    const token = this.getBotToken(connection);
    const chatId = String(input.chatId || '').trim();
    const text = this.normalizeTelegramText(input.text);
    const mediaPath = input.mediaPath ? String(input.mediaPath).trim() : '';
    const contentType = String(input.contentType || 'TEXT').trim().toUpperCase();

    if (!token) {
      throw new InternalServerErrorException('botToken do Telegram nao configurado.');
    }

    if (!chatId) {
      throw new BadRequestException('Chat ID do Telegram nao informado.');
    }

    if (!text && !mediaPath) {
      throw new BadRequestException('Mensagem Telegram vazia.');
    }

    const results: any[] = [];

    if (mediaPath) {
      const absoluteMediaPath = path.isAbsolute(mediaPath)
        ? mediaPath
        : path.resolve(process.cwd(), mediaPath);

      if (!fs.existsSync(absoluteMediaPath)) {
        throw new BadRequestException('Arquivo da mensagem Telegram nao encontrado no servidor.');
      }

      const { method, field } = this.resolveTelegramSendMethod(contentType);
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(field, fs.createReadStream(absoluteMediaPath), {
        filename: input.fileName || path.basename(absoluteMediaPath),
        contentType: input.mimeType || undefined,
      });
      form.append('disable_notification', String(Boolean(input.disableNotification)));

      const caption = text.length <= this.TELEGRAM_CAPTION_LIMIT ? text : '';
      if (caption) {
        form.append('caption', caption);
      }
      if (input.replyToMessageId) {
        form.append('reply_parameters', JSON.stringify({ message_id: input.replyToMessageId }));
      }

      const mediaResult = await this.apiMultipartRequest(token, method, form);
      results.push(mediaResult);

      if (text.length > this.TELEGRAM_CAPTION_LIMIT) {
        const chunks = this.splitLongText(text);
        for (const [index, chunk] of chunks.entries()) {
          const sent = await this.apiRequest(token, 'sendMessage', {
            chat_id: chatId,
            text: chunk,
            disable_notification: input.disableNotification ?? false,
            ...(index === 0 && input.replyToMessageId
              ? { reply_parameters: { message_id: input.replyToMessageId } }
              : {}),
          });
          results.push(sent);
        }
      }
    } else {
      const chunks = this.splitLongText(text);
      for (const [index, chunk] of chunks.entries()) {
        const sent = await this.apiRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: chunk,
          disable_notification: input.disableNotification ?? false,
          ...(index === 0 && input.replyToMessageId
            ? { reply_parameters: { message_id: input.replyToMessageId } }
            : {}),
        });
        results.push(sent);
      }
    }

    const messageIds = results
      .map((item) => Number(item?.message_id))
      .filter((value) => Number.isFinite(value));
    const primaryMessageId = messageIds[0] || null;
    const lastMessageId = messageIds.at(-1) || primaryMessageId;

    this.logger.log(
      `Telegram outbound connection=${input.connectionId} chat=${chatId} parts=${results.length} contentType=${contentType}`,
    );

    return {
      ...results.at(-1),
      message_id: lastMessageId,
      messages: results,
      messageIds,
      chunkCount: results.length,
      externalMessageId: this.buildExternalMessageId(chatId, primaryMessageId),
    };
  }

  async extractAudioTranscription(connectionId: string, fileId: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    const { config } = await this.prisma.connection.findFirst({
      where: { tenantId: connection.tenantId, type: 'DRX_CLAW' },
    }) as any;

    const localPath = await this.downloadTelegramFile(connectionId, fileId);
    try {
      const text = await WhisperTranscription.transcribe(localPath, config);
      return text;
    } finally {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  }

  async extractPdfText(connectionId: string, fileId: string): Promise<string> {
    const localPath = await this.downloadTelegramFile(connectionId, fileId);
    try {
      const text = await PdfExtractor.extract(localPath);
      return text;
    } finally {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  }

  async sendMarkdownAsDocument(connectionId: string, chatId: string, markdown: string, fileName: string = 'document.md') {
    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const localPath = path.join(tempDir, `${Date.now()}_${fileName}`);
    fs.writeFileSync(localPath, markdown);

    try {
      return await this.sendOutboundMessage({
        connectionId,
        chatId,
        contentType: 'FILE',
        mediaPath: localPath,
        fileName,
      });
    } finally {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  }

  async downloadTelegramFile(connectionId: string, fileId: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    const token = this.getBotToken(connection);
    const fileInfo = await this.apiRequest(token, 'getFile', { file_id: fileId });
    const filePath = fileInfo.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const localPath = path.join(tempDir, `telegram_${Date.now()}_${path.basename(filePath)}`);
    const writer = fs.createWriteStream(localPath);

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(localPath));
      writer.on('error', reject);
    });
  }

  async sendChatAction(connectionId: string, chatId: string, action: 'typing' | 'upload_photo' | 'record_video' | 'record_voice' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note') {
    const connection = await this.getConnection(connectionId);
    const token = this.getBotToken(connection);
    return this.apiRequest(token, 'sendChatAction', { chat_id: chatId, action });
  }
}
