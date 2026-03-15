import { Body, Controller, Headers, Logger, Param, Post } from '@nestjs/common';
import { DrxClawService } from '../drx-claw/drx-claw.service';
import { TelegramService } from './telegram.service';

@Controller('communications/channels/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly drxClawService: DrxClawService,
  ) {}

  @Post(':connectionId/webhook')
  async handleWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
    @Body() update: any,
  ) {
    await this.telegramService.assertWebhookRequest(connectionId, secretToken);

    const result = await this.drxClawService.handleTelegramInbound(connectionId, update);

    if (result?.ignored) {
      this.logger.debug(
        `Telegram inbound ignored connection=${connectionId} reason=${result?.reason || 'n/a'} update=${update?.update_id ?? 'unknown'}`,
      );
      return { ok: true, ignored: true, reason: result?.reason || null };
    }

    if (result.reply && result.chatId) {
      try {
        const sent = await this.telegramService.sendMessageByConnection(
          connectionId,
          result.chatId,
          result.reply,
          result.replyToMessageId
            ? { replyToMessageId: result.replyToMessageId }
            : undefined,
        );

        if (result.ticketId && result.tenantId) {
          await this.drxClawService.registerTelegramOutbound({
            tenantId: result.tenantId,
            ticketId: result.ticketId,
            connectionId,
            chatId: result.chatId,
            content: result.reply,
            externalMessageId: sent?.externalMessageId || `${result.chatId}:${sent?.message_id}`,
            replyToMessageId: sent?.message_id,
          });
        }
      } catch (error: any) {
        this.logger.error(
          `Telegram auto-reply failed connection=${connectionId} chat=${result.chatId}: ${error?.message || error}`,
        );
      }
    }

    return { ok: true };
  }
}
