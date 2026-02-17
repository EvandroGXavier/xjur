import { Controller, Get, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('send')
  async sendMessage(@Body() body: { connectionId: string; to: string; message: string }) {
    await this.whatsappService.sendText(body.connectionId, body.to, body.message);
    return { success: true };
  }

  @Get('status')
  getStatus(@Body() body: { connectionId: string }) {
      return this.whatsappService.getConnectionStatus(body.connectionId);
  }

  @Post('disconnect')
  async disconnect(@Body() body: { connectionId: string }) {
      await this.whatsappService.disconnect(body.connectionId);
      return { success: true, message: 'Desconectado com sucesso' };
  }

  @Get('debug')
  getDebugInfo() {
      // @ts-ignore
      return this.whatsappService.getDetailedDiagnostics();
  }
}
