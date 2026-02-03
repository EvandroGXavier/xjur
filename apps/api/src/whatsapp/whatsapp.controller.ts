import { Controller, Get, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('send')
  async sendMessage(@Body() body: { to: string; message: string }) {
    await this.whatsappService.sendText(body.to, body.message);
    return { success: true };
  }

  @Get('status')
  getStatus() {
      return this.whatsappService.getConnectionStatus();
  }

  @Post('disconnect')
  async disconnect() {
      await this.whatsappService.disconnect();
      return { success: true, message: 'Desconectado com sucesso' };
  }
}
