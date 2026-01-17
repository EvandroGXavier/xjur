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
      // Simple status check, could be expanded
      return { status: 'Endpoint Active' };
  }
}
