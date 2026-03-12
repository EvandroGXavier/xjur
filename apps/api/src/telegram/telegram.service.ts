import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TelegramService {
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

  private buildWebhookUrl(connection: any) {
    const baseUrl = this.getWebhookBaseUrl(connection);
    if (!baseUrl) {
      throw new BadRequestException(
        'Defina TELEGRAM_WEBHOOK_BASE_URL, APP_URL ou webhookBaseUrl na conexao Telegram.',
      );
    }

    return `${baseUrl}/api/communications/channels/telegram/${connection.id}/webhook`;
  }

  private getWebhookSecret(connection: any) {
    const config = this.normalizeConfig(connection.config);
    return String(config.webhookSecret || '').trim();
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
    const me = await this.apiRequest(botToken, 'getMe');

    await this.apiRequest(botToken, 'setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: false,
    });

    const updatedConfig = {
      ...config,
      webhookSecret,
      webhookUrl,
      botUsername: me?.username || null,
      botId: me?.id || null,
      botFirstName: me?.first_name || null,
      lastError: null,
      lastConnectedAt: new Date().toISOString(),
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
      } catch (_error) {
        // Mantemos a desconexao local mesmo se o webhook remoto ja estiver removido.
      }
    }

    await this.prisma.connection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        config: {
          ...config,
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
        status: connection.status,
        configured: false,
        webhookUrl: config.webhookUrl || null,
      };
    }

    try {
      const webhookInfo = await this.apiRequest(botToken, 'getWebhookInfo');
      return {
        status: connection.status,
        configured: true,
        webhookUrl: webhookInfo?.url || config.webhookUrl || null,
        pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
        lastErrorDate: webhookInfo?.last_error_date || null,
        lastErrorMessage: webhookInfo?.last_error_message || null,
        botUsername: config.botUsername || null,
      };
    } catch (error: any) {
      return {
        status: 'ERROR',
        configured: true,
        webhookUrl: config.webhookUrl || null,
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
    options?: {
      replyToMessageId?: number;
      disableNotification?: boolean;
    },
  ) {
    const connection = await this.getConnection(connectionId);
    const token = this.getBotToken(connection);

    if (!token) {
      throw new InternalServerErrorException('botToken do Telegram nao configurado.');
    }

    const result = await this.apiRequest(token, 'sendMessage', {
      chat_id: chatId,
      text,
      disable_notification: options?.disableNotification ?? false,
      ...(options?.replyToMessageId
        ? { reply_parameters: { message_id: options.replyToMessageId } }
        : {}),
    });

    return result;
  }
}
