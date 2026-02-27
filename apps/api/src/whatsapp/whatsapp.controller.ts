import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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

  @Post(':id/sync-contacts')
  async syncContacts(@Param('id') id: string) {
      return this.whatsappService.syncContacts(id);
  }

  @Post(':id/settings')
  async updateSettings(@Param('id') id: string, @Body() settings: any) {
      return this.whatsappService.updateSettings(id, settings);
  }

  @Get('debug')
  getDebugInfo() {
      // @ts-ignore
      return this.whatsappService.getDetailedDiagnostics();
  }
}
