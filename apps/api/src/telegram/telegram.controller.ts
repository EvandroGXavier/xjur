import { Body, Controller, Headers, Logger, Param, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { CommunicationsService } from '../communications/communications.service';

@Controller('communications/channels/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  @Post(':connectionId/webhook')
  async handleWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
    @Body() update: any,
  ) {
    // 1. Validar Origem
    const connection = await this.telegramService.assertWebhookRequest(connectionId, secretToken);

    // 2. Extrair dados básicos da mensagem/update
    const message = update.message || update.edited_message;
    if (!message) {
      this.logger.debug(`Telegram update sem mensagem (update_id: ${update.update_id}) para conexao ${connectionId}`);
      return { ok: true };
    }

    const chatId = String(message.chat.id);
    const content = message.text || message.caption || '';
    const externalMessageId = `${chatId}:${message.message_id}`;

    // 3. CAPTURA BRUTA (No-Treatment)
    // Encaminhar para o banco de eventos brutos sem nenhuma lógica de negócio.
    await this.communicationsService.processIncoming({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      channel: 'TELEGRAM',
      from: chatId,
      name: message.from?.first_name || message.from?.username || `User ${chatId}`,
      content: content,
      contentType: message.photo ? 'IMAGE' : message.voice || message.audio ? 'AUDIO' : message.document ? 'FILE' : 'TEXT',
      externalThreadId: chatId,
      externalMessageId: externalMessageId,
      metadata: {
        provider: 'TELEGRAM',
        update, // Grava o JSON bruto original do Telegram para auditoria completa
        chatType: message.chat.type,
      }
    });

    return { ok: true };
  }
}
