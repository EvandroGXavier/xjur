import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma.service';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { WhatsappGateway } from './whatsapp.gateway';
import { EvolutionService } from '../evolution/evolution.service';
import { FileLogger } from '../common/file-logger';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly fileLogger = new FileLogger();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionService: EvolutionService,
    @Inject(forwardRef(() => TicketsGateway))
    private readonly ticketsGateway: TicketsGateway,
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Evolution API Integration Initialized');
    await this.restoreSessions();
  }

  private async getEvolutionConfig(connectionId: string): Promise<any> {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      select: { config: true }
    });

    const config = connection?.config as any || {};
    if (config.evolutionUrl && config.evolutionApiKey) {
      return {
        apiUrl: config.evolutionUrl,
        apiKey: config.evolutionApiKey
      };
    }
    return undefined;
  }

  private async restoreSessions() {
    const activeConnections = await this.prisma.connection.findMany({
      where: { 
        type: 'WHATSAPP',
        status: { in: ['CONNECTED', 'PAIRING'] } 
      }
    });

    for (const connection of activeConnections) {
      try {
        this.logger.log(`Restoring Evolution session for connection ${connection.id}`);
        const evolutionConfig = await this.getEvolutionConfig(connection.id);
        
        // Ensure instance exists in Evolution
        const status = await this.evolutionService.getInstanceStatus(connection.id, evolutionConfig);
        
        // Refresh webhook - Must include /api prefix
        const apiUrl = process.env.APP_URL || 'http://host.docker.internal:3000';
        const webhookUrl = `${apiUrl}/api/evolution/webhook`;
        
        if (status.instance?.state === 'open' || status.instance?.state === 'close') {
          try {
            await this.evolutionService.setWebhook(connection.id, webhookUrl, evolutionConfig);
          } catch (we) {
            this.logger.error(`Failed to update webhook for ${connection.id} during restore: ${we.message}`);
          }
        } else {
          this.logger.warn(`Instance ${connection.id} is not found or has unknown state in Evolution. State: ${status.instance?.state}`);
        }
        
      } catch (error) {
        this.logger.error(`Failed to restore session ${connection.id}: ${error.message}`);
      }
    }
  }

  async createSession(connectionId: string): Promise<any> {
    this.logger.log(`Creating Evolution session for ${connectionId}`);
    try {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      
      // 1. Create Instance
      try {
        await this.evolutionService.createInstance(connectionId, evolutionConfig);
      } catch (e) {
        this.logger.warn(`Instance creation might have failed or already exists: ${e.message}`);
      }

      // 2. Set Webhook
      try {
        const apiUrl = process.env.APP_URL || 'http://host.docker.internal:3000';
        const webhookUrl = `${apiUrl}/api/evolution/webhook`;
        await this.evolutionService.setWebhook(connectionId, webhookUrl, evolutionConfig);
      } catch (e) {
        this.logger.error(`Failed to set webhook for ${connectionId}: ${e.message}`);
      }

      // 3. Connect
      const connectResponse = await this.evolutionService.connectInstance(connectionId, evolutionConfig);
      
      if (connectResponse.base64 || connectResponse.code) {
          const qrData = connectResponse.base64 || connectResponse.code;
          await this.prisma.connection.update({
              where: { id: connectionId },
              data: { qrCode: qrData, status: 'PAIRING' }
          });
          this.whatsappGateway.emitQrCode(connectionId, qrData);
          this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');
      }

      return connectResponse;
    } catch (error) {
      this.logger.error(`Error in createSession: ${error.message}`);
      throw error;
    }
  }

  async logout(connectionId: string) {
      try {
          const evolutionConfig = await this.getEvolutionConfig(connectionId);
          // Try to logout and then delete for a clean state
          await this.evolutionService.logoutInstance(connectionId, evolutionConfig);
          await this.evolutionService.deleteInstance(connectionId, evolutionConfig);
          
          await this.prisma.connection.update({
              where: { id: connectionId },
              data: { status: 'DISCONNECTED', qrCode: null }
          });
          this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
      } catch (e) {
          this.logger.error(`Error logging out: ${e.message}`);
      }
  }

  async disconnect(connectionId: string) {
      return this.logout(connectionId);
  }

  async getConnectionStatus(connectionId: string) {
    const evolutionConfig = await this.getEvolutionConfig(connectionId);
    const status = await this.evolutionService.getInstanceStatus(connectionId, evolutionConfig);
    return { 
      status: status.instance?.state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
      sessionName: connectionId
    };
  }

  // ==========================================
  // WEBHOOK HANDLERS
  // ==========================================

  async handleEvolutionConnectionUpdate(connectionId: string, data: any) {
    this.logger.log(`Connection Update for ${connectionId}: ${data.state} (Reason: ${data.statusReason || 'none'})`);
    
    // Se recebemos um erro 405 ou 401, a sessão expirou ou foi desconectada pelo celular
    // Marcamos como DISCONNECTED e não deixamos o status flutuar para PAIRING
    if (data.statusReason === 405 || data.statusReason === 401) {
        await this.prisma.connection.update({
            where: { id: connectionId },
            data: { status: 'DISCONNECTED', qrCode: null }
        });
        this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
        return;
    }

    let status = 'DISCONNECTED';
    if (data.state === 'open') status = 'CONNECTED';
    else if (data.state === 'connecting' || data.state === 'qrCode') status = 'PAIRING';
    
    const updateData: any = { status };
    if (data.qrCode) updateData.qrCode = data.qrCode;
    else if (status === 'CONNECTED' || status === 'DISCONNECTED') updateData.qrCode = null;

    try {
        await this.prisma.connection.update({
            where: { id: connectionId },
            data: updateData
        });
        this.whatsappGateway.emitConnectionStatus(connectionId, status);
    } catch (e) {
        this.logger.error(`Failed to update connection status: ${e.message}`);
    }
    
    if (data.qrCode) {
        this.whatsappGateway.emitQrCode(connectionId, data.qrCode);
    }
  }

  async handleEvolutionQrCode(connectionId: string, qrcode: any) {
    const qrRaw = qrcode.base64 || qrcode.code;
    if (!qrRaw) return;

    this.logger.log(`📸 QR Code received via webhook for ${connectionId}`);

    await this.prisma.connection.update({
        where: { id: connectionId },
        data: { qrCode: qrRaw, status: 'PAIRING' }
    });
    
    this.whatsappGateway.emitQrCode(connectionId, qrRaw);
    this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');
  }

  async handleEvolutionMessage(connectionId: string, message: any) {
    if (message.key?.fromMe) return;
    if (message.key?.remoteJid === 'status@broadcast') return;

    this.fileLogger.log(`Processing Evolution message for ${connectionId}. JID: ${message.key?.remoteJid}`);
    
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) return;

    const messageContent = message.message;
    if (!messageContent) return;

    const unwrap = (m: any): any => {
        if (!m) return m;
        if (m.ephemeralMessage) return unwrap(m.ephemeralMessage.message);
        if (m.viewOnceMessage) return unwrap(m.viewOnceMessage.message);
        if (m.viewOnceMessageV2) return unwrap(m.viewOnceMessageV2.message);
        if (m.documentWithCaptionMessage) return unwrap(m.documentWithCaptionMessage.message);
        if (m.editMessage) return unwrap(m.editMessage.message);
        return m;
    };
    const realContent = unwrap(messageContent);
    if (!realContent) return;

    let text = realContent.conversation || realContent.extendedTextMessage?.text || realContent.imageMessage?.caption || realContent.videoMessage?.caption || realContent.documentMessage?.caption || '';
    let type = 'TEXT';
    let quotedId = realContent.extendedTextMessage?.contextInfo?.stanzaId || null;
    
    if (realContent.imageMessage) type = 'IMAGE';
    else if (realContent.videoMessage) type = 'VIDEO';
    else if (realContent.audioMessage) { text = '[Áudio]'; type = 'AUDIO'; }
    else if (realContent.documentMessage) { text = text || realContent.documentMessage.fileName || '[Documento]'; type = 'DOCUMENT'; }
    else if (realContent.stickerMessage) { text = '[Figurinha]'; type = 'STICKER'; }
    else if (realContent.pollCreationMessage) { text = `[Enquete] ${realContent.pollCreationMessage.name}`; }

    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    let pushName = message.pushName || 'WhatsApp Contact';

    if (isGroup) {
        const config = connection.config as any || {};
        if (config.blockGroups && !(config.groupWhitelist || []).includes(remoteJid)) return;
    }

    try {
      const tenantId = connection.tenantId;
      let fullJid = remoteJid.replace(/:[0-9]+/, '');
      let phone = fullJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      let contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone }
      });

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            tenantId,
            name: pushName,
            phone: phone,
            whatsapp: fullJid,
            category: isGroup ? 'Grupo' : 'Lead',
          }
        });
      }

      let mediaPath: string | null = null;
      if (type !== 'TEXT' && message.base64) {
          try {
              const buffer = Buffer.from(message.base64, 'base64');
              const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

              const fileId = `${Date.now()}_${Math.round(Math.random() * 1000)}`;
              let ext = 'bin';
              if (type === 'AUDIO') ext = 'ogg'; 
              else if (type === 'IMAGE') ext = 'jpg';
              else if (type === 'VIDEO') ext = 'mp4';
              else if (type === 'STICKER') ext = 'webp';
              
              const fileName = `${fileId}.${ext}`;
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, buffer);
              mediaPath = `storage/uploads/${fileName}`;
          } catch (e) {
              this.logger.error(`Failed to save Evolution media: ${e.message}`);
          }
      }

      let ticket = await this.prisma.ticket.findFirst({
        where: { tenantId, contactId: contact.id, status: { not: 'CLOSED' } }
      });

      let isNewTicket = false;
      if (!ticket) {
        ticket = await this.prisma.ticket.create({
          data: {
            tenantId,
            contactId: contact.id,
            status: 'OPEN',
            priority: 'MEDIUM',
            channel: 'WHATSAPP',
            title: isGroup ? pushName : `Chat from ${pushName}`
          }
        });
        isNewTicket = true;
      }

      const dbMessage = await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: 'CONTACT',
          senderId: contact.id,
          content: isGroup && message.pushName ? `__${message.pushName}__: ${text}` : text,
          contentType: type === 'VIDEO' || type === 'DOCUMENT' ? 'FILE' : type === 'STICKER' ? 'IMAGE' : type,
          mediaUrl: mediaPath,
          externalId: message.key.id,
          status: 'DELIVERED',
          quotedId
        }
      });

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date(), lastMessageAt: new Date(), waitingReply: true }
      });

      const fullTicket = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { contact: true, _count: { select: { messages: true } } }
      });

      if (isNewTicket) this.ticketsGateway.emitTicketCreated(tenantId, fullTicket);
      else this.ticketsGateway.emitTicketUpdated(tenantId, fullTicket);
      this.ticketsGateway.emitNewMessage(tenantId, ticket.id, dbMessage);

    } catch (error) {
      this.logger.error(`Error processing Evolution message: ${error.message}`);
    }
  }

  async handleEvolutionMessageUpdate(connectionId: string, data: any) {
      const externalId = data.key?.id;
      if (!externalId) return;
      const statusKey = data.status;
      let newStatus = 'SENT';
      if (statusKey === 3 || statusKey === 4) newStatus = 'READ';
      else if (statusKey === 2) newStatus = 'DELIVERED';
      else return;

      try {
          const msg = await this.prisma.ticketMessage.findUnique({ where: { externalId } });
          if (msg) {
              await this.prisma.ticketMessage.update({
                  where: { id: msg.id },
                  data: { status: newStatus, readAt: newStatus === 'READ' ? new Date() : undefined }
              });
              const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
              if (conn) {
                  this.ticketsGateway.emitMessageStatus(conn.tenantId, msg.ticketId, msg.id, newStatus);
              }
          }
      } catch (e) {}
  }

  async handleEvolutionPresenceUpdate(connectionId: string, data: any) {
      const jid = data.key?.remoteJid || data.id;
      if (!jid) return;
      const phone = jid.split('@')[0].split(':')[0];
      const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (conn) {
          const contact = await this.prisma.contact.findFirst({
              where: { tenantId: conn.tenantId, phone }
          });
          if (contact) {
              this.ticketsGateway.emitPresenceUpdate(conn.tenantId, contact.id, data.presences?.[jid]?.lastKnownPresence || 'available');
          }
      }
  }

  // ==========================================
  // OUTGOING METHODS
  // ==========================================

  async sendText(connectionId: string, to: string, text: string) {
    const evolutionConfig = await this.getEvolutionConfig(connectionId);
    const response = await this.evolutionService.sendText(connectionId, to, text, {}, evolutionConfig);
    return response?.key?.id;
  }

  async sendMedia(
    connectionId: string, 
    to: string, 
    type: 'image' | 'video' | 'audio' | 'document', 
    url: string,
    caption?: string,
    mimetype?: string,
    fileName?: string
  ) {
    const evolutionConfig = await this.getEvolutionConfig(connectionId);
    const absoluteUrl = url.startsWith('http') ? url : `${process.env.APP_URL || 'http://host.docker.internal:3000'}/${url}`;
    const response = await this.evolutionService.sendMedia(connectionId, to, type, absoluteUrl, caption, fileName, evolutionConfig);
    return response?.key?.id;
  }

  async markRead(connectionId: string, jid: string, messageIds: string[]) {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      const phone = jid.split('@')[0];
      await this.evolutionService.markRead(connectionId, phone, evolutionConfig);
  }

  async deleteMessage(connectionId: string, jid: string, messageId: string, fromMe: boolean) {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      await this.evolutionService.deleteMessage(connectionId, jid, messageId, fromMe, evolutionConfig);
  }

  async syncContacts(connectionId: string) {
      return { success: true, message: 'Sincronização iniciada via Evolution API' };
  }

  async getDetailedDiagnostics() {
      return { engine: 'Evolution API', version: '2.x' };
  }
}