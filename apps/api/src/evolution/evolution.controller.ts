import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { EvolutionService } from './evolution.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Controller('evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() data: any) {
    const event = data.event;
    const instance = data.instance;
    
    this.logger.debug(`Webhook received: ${event} from instance ${instance}`);
    this.logger.debug(`Webhook payload: ${JSON.stringify(data)}`);

    switch (event) {
      case 'qrcode.updated':
        await this.handleQrCodeUpdated(data);
        break;
      case 'messages.upsert':
        await this.handleMessagesUpsert(data);
        break;
      case 'connection.update':
        await this.handleConnectionUpdate(data);
        break;
      case 'messages.update':
        await this.handleMessagesUpdate(data);
        break;
      case 'presence.update':
        await this.handlePresenceUpdate(data);
        break;
      default:
        // this.logger.debug(`Unhandled event type: ${event}`);
        break;
    }

    return { status: 'success' };
  }

  private async handleQrCodeUpdated(data: any) {
    const instance = data.instance;
    const qrcode = data.data.qrcode;
    await (this.whatsappService as any).handleEvolutionQrCode(instance, qrcode);
  }

  private async handleMessagesUpsert(data: any) {
    const instance = data.instance;
    const message = data.data;

    // We proxy this to the existing WhatsApp service logic for processing
    // but we need to adapt the data format from Evolution to Baileys if we want to reuse handleIncomingMessage
    // OR just implement a new handler in WhatsappService that accepts Evolution format.
    
    // For now, let's call a new method we'll create in WhatsappService
    await (this.whatsappService as any).handleEvolutionMessage(instance, message);
  }

  private async handleConnectionUpdate(data: any) {
    const instance = data.instance;
    const connection = data.data;
    
    // connection.status can be 'open', 'connecting', 'close'
    // connection.qr is the base64 QR code if available
    
    await (this.whatsappService as any).handleEvolutionConnectionUpdate(instance, connection);
  }

  private async handleMessagesUpdate(data: any) {
    // Handle message status (sent/delivered/read)
    await (this.whatsappService as any).handleEvolutionMessageUpdate(data.instance, data.data);
  }

  private async handlePresenceUpdate(data: any) {
    // Handle typing status
    await (this.whatsappService as any).handleEvolutionPresenceUpdate(data.instance, data.data);
  }
}
