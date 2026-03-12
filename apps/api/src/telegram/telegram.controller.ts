import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { DrxClawService } from '../drx-claw/drx-claw.service';
import { TelegramService } from './telegram.service';

@Controller('communications/channels/telegram')
export class TelegramController {
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

    const result = await this.drxClawService.handleTelegramInbound(
      connectionId,
      update,
    );

    if (result.reply && result.chatId) {
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
          externalMessageId: `${result.chatId}:${sent?.message_id}`,
          replyToMessageId: sent?.message_id,
        });
      }
    }

    return { ok: true };
  }
}
