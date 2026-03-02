import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { EvolutionService } from './evolution.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import axios from 'axios';

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
    
    // Prevent terminal flooding with huge base64 files
    const payloadStr = JSON.stringify(data, (key, value) => {
      if (key === 'base64') return '[REDACTED_BASE64]';
      return value;
    });
    this.logger.debug(`Webhook payload: ${payloadStr.length > 2000 ? payloadStr.substring(0, 2000) + '... [TRUNCATED]' : payloadStr}`);

    // Emitir raw target data para o painel de testes (DEBUG)
    this.whatsappService.emitRawWebhookEvent(instance, data);

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

    // Encaminhar para webhook externo se configurado
    await this.forwardWebhook(instance, data);

    return { status: 'success' };
  }

  private async forwardWebhook(instanceName: string, data: any) {
    try {
      // @ts-ignore - Acessando PrismaService do WhatsappService ou injetando se necessário
      const prisma = this.whatsappService['prisma'];
      const connection = await prisma.connection.findUnique({
        where: { id: instanceName },
        select: { config: true }
      });

      const config = connection?.config as any || {};
      if (config.webhookEnabled && config.webhookUrl) {
        this.logger.debug(`Forwarding webhook from ${instanceName} to ${config.webhookUrl}`);
        
        axios.post(config.webhookUrl, data, { timeout: 5000 }).catch(e => {
          this.logger.warn(`Failed to forward webhook to ${config.webhookUrl}: ${e.message}`);
        });
      }
    } catch (e) {
      this.logger.error(`Error in forwardWebhook: ${e.message}`);
    }
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
