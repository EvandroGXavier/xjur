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
    
    // Extrai o connectionId original do instanceName dinâmico
    let instance = data.instance;
    if (instance && typeof instance === 'string' && instance.includes('-')) {
      const parts = instance.split('-');
      if (parts.length > 5) { // UUID tem 5 partes
        instance = parts.slice(0, 5).join('-');
        data.instance = instance; // <-- Essa é a linha chave para propagar pro WhatsappService
      }
    }
    
    this.logger.debug(`Webhook received: ${event} from instance ${instance} (evo_id: ${data.instance})`);
    
    // Prevent terminal flooding with huge base64 files
    const payloadStr = JSON.stringify(data, (key, value) => {
      if (key === 'base64') return '[REDACTED_BASE64]';
      return value;
    });
    this.logger.debug(`Webhook payload: ${payloadStr.length > 2000 ? payloadStr.substring(0, 2000) + '... [TRUNCATED]' : payloadStr}`);

    switch (event) {
      case 'qrcode.updated':
        await this.handleQrCodeUpdated(instance, data);
        break;
      case 'messages.upsert':
        await this.handleMessagesUpsert(instance, data);
        break;
      case 'connection.update':
        await this.handleConnectionUpdate(instance, data);
        break;
      case 'messages.update':
        await this.handleMessagesUpdate(instance, data);
        break;
      case 'presence.update':
        await this.handlePresenceUpdate(instance, data);
        break;
      default:
        // this.logger.debug(`Unhandled event type: ${event}`);
        break;
    }

    return { status: 'success' };
  }

  private async handleQrCodeUpdated(instance: string, data: any) {
    const qrcode = data.data.qrcode;
    await (this.whatsappService as any).handleEvolutionQrCode(instance, qrcode);
  }

  private async handleMessagesUpsert(instance: string, data: any) {
    const message = data.data;

    // We proxy this to the existing WhatsApp service logic for processing
    // but we need to adapt the data format from Evolution to Baileys if we want to reuse handleIncomingMessage
    // OR just implement a new handler in WhatsappService that accepts Evolution format.
    
    // For now, let's call a new method we'll create in WhatsappService
    await (this.whatsappService as any).handleEvolutionMessage(instance, message);
  }

  private async handleConnectionUpdate(instance: string, data: any) {
    const connection = data.data;
    
    // connection.status can be 'open', 'connecting', 'close'
    // connection.qr is the base64 QR code if available
    
    await (this.whatsappService as any).handleEvolutionConnectionUpdate(instance, connection);
  }

  private async handleMessagesUpdate(instance: string, data: any) {
    // Handle message status (sent/delivered/read)
    await (this.whatsappService as any).handleEvolutionMessageUpdate(instance, data.data);
  }

  private async handlePresenceUpdate(instance: string, data: any) {
    // Handle typing status
    await (this.whatsappService as any).handleEvolutionPresenceUpdate(instance, data.data);
  }
}
