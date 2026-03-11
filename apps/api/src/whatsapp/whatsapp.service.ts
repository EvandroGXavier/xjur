import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma.service';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { WhatsappGateway } from './whatsapp.gateway';
import { EvolutionService, EvolutionConfig } from '../evolution/evolution.service';
import { FileLogger } from '../common/file-logger';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly fileLogger = new FileLogger();

  /**
   * Mapa de instâncias que foram "killed" (405/401).
   * Quando recebemos 405, deletamos a instância na Evolution e
   * adicionamos aqui com timestamp. Qualquer webhook recebido
   * nos próximos 30s para esta instância é ignorado.
   */
  private readonly killedInstances = new Map<string, number>();
  private readonly KILL_COOLDOWN_MS = 30000; // 30 segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionService: EvolutionService,
    @Inject(forwardRef(() => TicketsGateway))
    private readonly ticketsGateway: TicketsGateway,
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Evolution API Integration Initialized');
    try {
      await this.restoreSessions();
    } catch (error) {
      this.logger.warn(`Failed to restore WhatsApp sessions (Evolution API may be unavailable): ${error.message}`);
      this.logger.warn('The API will continue running without WhatsApp restoration. Tags, contacts, and other modules are unaffected.');
    }
  }

  // ==========================================
  // CONFIGURA�!ÒO DIN�MICA POR CONEXÒO
  // ==========================================

  /**
   * Busca configuração customizada da Evolution API para uma conexão específica.
   * Se a conexão tem evolutionUrl e evolutionApiKey no config, usa esses valores.
   * Caso contrário, retorna undefined e o EvolutionService usa os defaults (.env).
   */
  private async getEvolutionConfig(connectionId: string): Promise<EvolutionConfig | undefined> {
    try {
      const connection = await this.prisma.connection.findUnique({
        where: { id: connectionId },
        select: { config: true }
      });

      const config = connection?.config as any || {};
      const settings = config.evolutionSettings || {};
      if (config.evolutionVersion) {
        settings.whatsappVersion = config.evolutionVersion;
      }

      if (config.evolutionUrl && config.evolutionApiKey) {
        return {
          apiUrl: config.evolutionUrl,
          apiKey: config.evolutionApiKey,
          settings
        };
      }
      
      // Mesmo sem URL/Key customizada, podemos ter settings customizadas para os defaults
      return {
        apiUrl: this.evolutionService['defaultApiUrl'] || process.env.EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: this.evolutionService['defaultApiKey'] || process.env.EVOLUTION_API_KEY || '',
        settings
      };
    } catch (e) {
      this.logger.error(`Failed to fetch evolution config for ${connectionId}: ${e.message}`);
    }
    return undefined;
  }

  private unwrapMessageContent(message: any): any {
    if (!message) return message;
    if (message.ephemeralMessage) return this.unwrapMessageContent(message.ephemeralMessage.message);
    if (message.viewOnceMessage) return this.unwrapMessageContent(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2) return this.unwrapMessageContent(message.viewOnceMessageV2.message);
    if (message.documentWithCaptionMessage) return this.unwrapMessageContent(message.documentWithCaptionMessage.message);
    if (message.editMessage) return this.unwrapMessageContent(message.editMessage.message);
    return message;
  }

  private getMediaNode(realContent: any): any {
    return realContent?.imageMessage
      || realContent?.videoMessage
      || realContent?.audioMessage
      || realContent?.documentMessage
      || realContent?.stickerMessage
      || null;
  }

  private extractMediaBase64(message: any, eventPayload?: any, realContent?: any): string | null {
    const mediaNode = this.getMediaNode(realContent);
    const candidates = [
      message?.base64,
      message?.data?.base64,
      eventPayload?.data?.base64,
      eventPayload?.base64,
      eventPayload?.data?.message?.base64,
      mediaNode?.base64,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 100) {
        return candidate;
      }
    }

    return null;
  }

  private extractMediaDetails(type: string, realContent: any) {
    const mediaNode = this.getMediaNode(realContent);
    const mimeType = mediaNode?.mimetype || mediaNode?.mimeType || undefined;
    const fileName = mediaNode?.fileName || mediaNode?.title || undefined;

    return { mimeType, fileName };
  }

  private resolveMediaExtension(type: string, mimeType?: string, fileName?: string): string {
    const originalExtension = fileName ? path.extname(fileName).replace('.', '').toLowerCase() : '';
    if (originalExtension) {
      return originalExtension;
    }

    const mimeMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/opus': 'ogg',
      'audio/webm': 'webm',
      'application/msword': 'doc',
      'application/pdf': 'pdf',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/zip': 'zip',
      'image/gif': 'gif',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'text/plain': 'txt',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    };

    if (mimeType && mimeMap[mimeType.toLowerCase()]) {
      return mimeMap[mimeType.toLowerCase()];
    }

    switch (type) {
      case 'AUDIO':
        return 'ogg';
      case 'IMAGE':
        return 'jpg';
      case 'VIDEO':
        return 'mp4';
      case 'STICKER':
        return 'webp';
      case 'DOCUMENT':
        return 'pdf';
      default:
        return 'bin';
    }
  }

  private saveInboundMedia(type: string, base64Data: string, mimeType?: string, fileName?: string): string | null {
    try {
      let normalizedBase64 = base64Data;
      if (normalizedBase64.includes('base64,')) {
        normalizedBase64 = normalizedBase64.split('base64,')[1];
      }

      const buffer = Buffer.from(normalizedBase64, 'base64');
      const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const fileId = `${Date.now()}_${Math.round(Math.random() * 1000)}`;
      const extension = this.resolveMediaExtension(type, mimeType, fileName);
      const savedFileName = `${fileId}.${extension}`;
      const filePath = path.join(uploadsDir, savedFileName);
      fs.writeFileSync(filePath, buffer);
      return `storage/uploads/${savedFileName}`;
    } catch (error) {
      this.logger.error(`Failed to save Evolution media: ${error.message}`);
      return null;
    }
  }
  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Restaura sessões ativas ao iniciar o módulo.
   * Verifica o estado real na Evolution e atualiza o banco.
   */
  private async restoreSessions() {
    const activeConnections = await this.prisma.connection.findMany({
      where: { 
        type: 'WHATSAPP',
        status: { in: ['CONNECTED', 'PAIRING'] } 
      }
    });

    this.logger.log(`Found ${activeConnections.length} active WhatsApp connections to restore`);

    for (const connection of activeConnections) {
      try {
        this.logger.log(`Restoring session for connection ${connection.id}`);
        const evolutionConfig = await this.getEvolutionConfig(connection.id);
        
        const status = await this.evolutionService.getInstanceStatus(connection.id, evolutionConfig);
        const state = status.instance?.state;
        
        if (state === 'open') {
          // Instância conectada � atualizar webhook
          this.logger.log(`Instance ${connection.id} is OPEN. Refreshing webhook...`);
          const apiUrl = process.env.APP_URL || 'http://host.docker.internal:3000';
          const webhookUrl = `${apiUrl}/api/evolution/webhook`;
          await this.evolutionService.setWebhook(connection.id, webhookUrl, evolutionConfig);
          
          await this.prisma.connection.update({
            where: { id: connection.id },
            data: { status: 'CONNECTED', qrCode: null }
          });
        } else if (state === 'close' || state === 'connecting') {
          // Instância existe mas não está conectada
          this.logger.warn(`Instance ${connection.id} is ${state}. Marking DISCONNECTED.`);
          await this.prisma.connection.update({
            where: { id: connection.id },
            data: { status: 'DISCONNECTED', qrCode: null }
          });
        } else {
          // Instância não encontrada na Evolution
          this.logger.warn(`Instance ${connection.id} not found in Evolution (state: ${state}). Marking DISCONNECTED.`);
          await this.prisma.connection.update({
            where: { id: connection.id },
            data: { status: 'DISCONNECTED', qrCode: null }
          });
        }
      } catch (error) {
        this.logger.error(`Failed to restore session ${connection.id}: ${error.message}`);
        // Marcar como desconectada para evitar loops
        await this.prisma.connection.update({
          where: { id: connection.id },
          data: { status: 'DISCONNECTED', qrCode: null }
        }).catch(() => {});
      }
    }
  }

  /**
   * Cria uma nova sessão WhatsApp via Evolution API.
   * Fluxo: Delete antiga (se existir) �  Create �  Set Webhook �  Connect �  QR Code
   */
  async createSession(connectionId: string): Promise<any> {
    this.logger.log(`Creating Evolution session for ${connectionId}`);
    
    // Limpar cooldown de kill para esta instância (permite novos webhooks)
    this.killedInstances.delete(connectionId);
    
    try {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      
      // 1. Limpar instância antiga (se existir) para garantir sessão limpa
      try {
        await this.evolutionService.deleteInstance(connectionId, evolutionConfig);
        this.logger.log(`Cleaned up old instance for ${connectionId}`);
      } catch (e) {
        // Ignorar � pode não existir
      }

      // Pequeno delay para a Evolution processar a deleção
      await new Promise(resolve => setTimeout(resolve, 500));

      // Antecipamos o registro de PAIRING para evitar que o "ghost 405 / logout" bloqueie as instâncias logo após a criação da porta
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'PAIRING', qrCode: null }
      });
      this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');

      // 2. Criar nova instância
      const createResult = await this.evolutionService.createInstance(connectionId, evolutionConfig);
      this.logger.log(`Instance created: ${JSON.stringify(createResult?.instance?.instanceName || 'ok')}`);

      // 3. Configurar Webhook (usar URL interna Docker para comunicação container-a-container)
      const webhookBaseUrl = process.env.WEBHOOK_INTERNAL_URL || process.env.APP_URL || 'http://host.docker.internal:3000';
      const webhookUrl = `${webhookBaseUrl}/api/evolution/webhook`;
      this.logger.log(`Setting default webhook URL: ${webhookUrl}`);  
      
      const webhookResult = await this.evolutionService.setWebhook(connectionId, webhookUrl, evolutionConfig);
      this.logger.log(`Webhook result: ${JSON.stringify(webhookResult)}`);

      // 4. Conectar instância (isso gera o QR Code)
      const connectResponse = await this.evolutionService.connectInstance(connectionId, evolutionConfig);
      
      // 5. Processar QR Code se veio na resposta direta
      if (connectResponse?.base64 || connectResponse?.code) {
        const qrData = connectResponse.base64 || connectResponse.code;
        await this.prisma.connection.update({
          where: { id: connectionId },
          data: { qrCode: qrData, status: 'PAIRING' }
        });
        this.whatsappGateway.emitQrCode(connectionId, qrData);
        this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');
        this.logger.log(`QR Code emitted directly from connect response for ${connectionId}`);
      }

      return connectResponse;
    } catch (error) {
      this.logger.error(`Error in createSession for ${connectionId}: ${error.message}`);
      // Marcar como erro no banco
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'ERROR', qrCode: null }
      }).catch(() => {});
      this.whatsappGateway.emitConnectionError(connectionId, error.message);
      throw error;
    }
  }

  /**
   * Desconecta e remove a instância da Evolution para limpeza total.
   */
  async logout(connectionId: string) {
    try {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      
      // Tenta logout primeiro, depois deleta
      await this.evolutionService.logoutInstance(connectionId, evolutionConfig);
      await this.evolutionService.deleteInstance(connectionId, evolutionConfig);
      
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'DISCONNECTED', qrCode: null }
      });
      this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
      this.logger.log(`Connection ${connectionId} logged out and cleaned`);
    } catch (e) {
      this.logger.error(`Error logging out ${connectionId}: ${e.message}`);
      // Mesmo com erro, marcar como desconectada
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'DISCONNECTED', qrCode: null }
      }).catch(() => {});
    }
  }

  async disconnect(connectionId: string) {
    return this.logout(connectionId);
  }

  /**
   * Emite eventos crus recebidos do Webhook para a aba de testes no Front-End
   */
  emitRawWebhookEvent(connectionId: string, payload: any) {
    this.whatsappGateway.emitRawEvent(connectionId, payload);
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

  /**
   * Processa atualizações de conexão vindas do webhook da Evolution.
   * 
   * Estados possíveis:
   *   - open: Conectado com sucesso
   *   - connecting: Tentando reconectar (emite PAIRING)
   *   - close: Desconectado
   * 
   * StatusReason:
   *   - 200: OK
   *   - 401: Não autorizado (sessão expirou)
   *   - 405: Logout pelo celular
   *   - 408: Timeout
   */
  async handleEvolutionConnectionUpdate(connectionId: string, data: any) {
    const state = data.state;
    const reason = data.statusReason;

    // ���� COOLDOWN CHECK ����
    // Se esta instância foi "killed" recentemente, ignorar TODOS os webhooks
    const killedAt = this.killedInstances.get(connectionId);
    if (killedAt) {
      if (Date.now() - killedAt < this.KILL_COOLDOWN_MS) {
        // Ainda no cooldown � ignora silenciosamente
        return;
      }
      // Cooldown expirou � limpar
      this.killedInstances.delete(connectionId);
    }
    
    this.logger.log(`Connection ${connectionId}: state=${state}, reason=${reason}`);
    
    // ���� 405/401: SESSÒO EXPIROU ����
    // Deletar instância na Evolution para PARAR o loop de reconexão
    // MAS: NÒO deletar se a connection está em PAIRING (criação nova, estado transitório)
    if (reason === 405 || reason === 401) {
      // Verificar se está em fase de criação (PAIRING) � se sim, ignorar o 405/401
      // pois é um estado transitório normal da Evolution antes do QR code
      try {
        const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
        if (conn?.status === 'PAIRING') {
          this.logger.warn(`Connection ${connectionId} got ${reason} but is PAIRING � ignoring (transient state)`);
          return;
        }
      } catch (e) {
        // Se não conseguir verificar, prosseguir com kill
      }

      // Adicionar ao cooldown IMEDIATAMENTE para bloquear webhooks subsequentes
      this.killedInstances.set(connectionId, Date.now());
      
      this.logger.warn(`Connection ${connectionId} expired (reason: ${reason}). KILLING instance to stop reconnect loop.`);
      
      try {
        // Deletar instância na Evolution para que ela pare de reconectar
        const evolutionConfig = await this.getEvolutionConfig(connectionId);
        await this.evolutionService.deleteInstance(connectionId, evolutionConfig);
        this.logger.log(`Instance ${connectionId} deleted from Evolution after 405/401`);
      } catch (e) {
        this.logger.error(`Failed to delete instance after expiry: ${e.message}`);
      }

      try {
        await this.prisma.connection.update({
          where: { id: connectionId },
          data: { status: 'DISCONNECTED', qrCode: null }
        });
        this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
      } catch (e) {
        this.logger.error(`Failed to update expired connection: ${e.message}`);
      }
      return;
    }

    // ���� 408: TIMEOUT ����
    // Ignorar silenciosamente
    if (reason === 408 && state === 'close') {
      this.logger.debug(`Connection ${connectionId} timeout � ignoring`);
      return;
    }

    // ���� MAPEAR ESTADO ����
    let status = 'DISCONNECTED';
    if (state === 'open') status = 'CONNECTED';
    else if (state === 'connecting' || state === 'qrCode') status = 'PAIRING';
    
    const updateData: any = { status };
    if (data.qrCode) {
      updateData.qrCode = data.qrCode;
    } else if (status === 'CONNECTED') {
      updateData.qrCode = null;
    }

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

  /**
   * Processa QR Codes recebidos via webhook dedicado (qrcode.updated).
   */
  async handleEvolutionQrCode(connectionId: string, qrcode: any) {
    const qrRaw = qrcode?.base64 || qrcode?.code;
    if (!qrRaw) {
      this.logger.warn(`QR Code received for ${connectionId} but no data found`);
      return;
    }

    this.logger.log(`�x� QR Code received via webhook for ${connectionId}`);

    try {
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { qrCode: qrRaw, status: 'PAIRING' }
      });
      
      this.whatsappGateway.emitQrCode(connectionId, qrRaw);
      this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');
    } catch (e) {
      this.logger.error(`Failed to save QR code: ${e.message}`);
    }
  }

  /**
   * Processa mensagens recebidas via webhook (messages.upsert).
   */
  async handleEvolutionMessage(connectionId: string, message: any, eventPayload?: any) {
    if (message.key?.remoteJid === 'status@broadcast') return;

    this.fileLogger.log(`Processing Evolution message for ${connectionId}. JID: ${message.key?.remoteJid}`);

    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) return;

    const messageContent = message.message;
    if (!messageContent) return;

    const realContent = this.unwrapMessageContent(messageContent);
    if (!realContent) return;

    let type = 'TEXT';
    let text = '';
    const quotedId = realContent.extendedTextMessage?.contextInfo?.stanzaId || null;

    if (realContent.conversation) {
      text = realContent.conversation;
    } else if (realContent.extendedTextMessage) {
      text = realContent.extendedTextMessage.text || '';
    } else if (realContent.imageMessage) {
      type = 'IMAGE';
      text = realContent.imageMessage.caption || '';
    } else if (realContent.videoMessage) {
      type = 'VIDEO';
      text = realContent.videoMessage.caption || '';
    } else if (realContent.audioMessage) {
      type = 'AUDIO';
      text = '[Audio]';
    } else if (realContent.documentMessage) {
      type = 'DOCUMENT';
      text = realContent.documentMessage.fileName || '[Documento]';
    } else if (realContent.stickerMessage) {
      type = 'STICKER';
      text = '[Figurinha]';
    } else if (realContent.pollCreationMessage) {
      text = `[Enquete] ${realContent.pollCreationMessage.name || ''}`;
    } else if (realContent.contactMessage) {
      text = `[Contato] ${realContent.contactMessage.displayName || ''}`;
    } else if (realContent.locationMessage) {
      text = '[Localizacao]';
    }

    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const pushName = message.pushName || 'WhatsApp Contact';

    if (isGroup) {
      const config = connection.config as any || {};
      if (config.blockGroups && !(config.groupWhitelist || []).includes(remoteJid)) return;
    }

    try {
      const tenantId = connection.tenantId;
      const fullJid = remoteJid.replace(/:[0-9]+/, '');
      const phoneRaw = fullJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');

      if (/[a-zA-Z]/.test(phoneRaw) && !isGroup) {
        this.fileLogger.warn(`Skipping message processing for ${phoneRaw}: Invalid WhatsApp ID (contains letters)`);
        return;
      }

      let phoneClean = phoneRaw.replace(/\D/g, '');
      const phoneTail = phoneClean.length >= 8 ? phoneClean.slice(-8) : phoneClean;

      if (isGroup || fullJid.includes('@lid')) {
        phoneClean = fullJid;
      }

      let contact: any = null;

      if (phoneTail && !isGroup && !fullJid.includes('@lid')) {
        const phoneTail4 = phoneClean.length >= 4 ? phoneClean.slice(-4) : phoneClean;

        const candidateContacts = await this.prisma.contact.findMany({
          where: {
            tenantId,
            OR: [
              { whatsapp: { contains: phoneTail4 } },
              { phone: { contains: phoneTail4 } }
            ]
          }
        });

        contact = candidateContacts.find(c => {
          const wClean = (c.whatsapp || '').replace(/\D/g, '');
          const pClean = (c.phone || '').replace(/\D/g, '');
          return (wClean && wClean.endsWith(phoneTail)) || (pClean && pClean.endsWith(phoneTail));
        });
      }

      if (!contact) {
        contact = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            OR: [
              { whatsapp: { equals: fullJid } },
              { whatsapp: { equals: phoneRaw } }
            ]
          }
        });
      }

      if (contact && fullJid.includes('@lid') && !contact.whatsapp?.includes('@lid')) {
        this.logger.log(`Fixing legacy LID contact WhatsApp number: ${contact.whatsapp} -> ${fullJid}`);
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: { whatsapp: fullJid }
        });
      }

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            tenantId,
            name: pushName || phoneClean || 'Sem Nome',
            whatsapp: phoneClean || '99 99999999',
            category: isGroup ? 'Grupo' : 'Lead',
            email: 'nt@nt.com.br',
            document: null,
            notes: `Adicionado automaticamente via WhatsApp. ${fullJid}`
          }
        });
      }

      if (!isGroup && !contact.profilePicUrl && !message.key.fromMe) {
        try {
          const evolutionConfig = await this.getEvolutionConfig(connectionId);
          const pic = await this.evolutionService.fetchProfilePictureUrl(connectionId, fullJid, evolutionConfig);
          if (pic) {
            contact = await this.prisma.contact.update({
              where: { id: contact.id },
              data: { profilePicUrl: pic }
            });
          }
        } catch (e) {}
      }

      const { mimeType, fileName } = this.extractMediaDetails(type, realContent);
      const mediaBase64 = type !== 'TEXT' ? this.extractMediaBase64(message, eventPayload, realContent) : null;
      let mediaPath: string | null = null;

      if (type !== 'TEXT') {
        if (mediaBase64) {
          mediaPath = this.saveInboundMedia(type, mediaBase64, mimeType, fileName);
        } else {
          this.logger.warn(`Evolution media message ${message.key?.id} arrived without base64 payload. type=${type} instance=${connectionId}`);
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
            status: 'WAITING',
            priority: 'MEDIUM',
            channel: 'WHATSAPP',
            title: isGroup ? pushName : `Chat from ${pushName}`
          }
        });
        isNewTicket = true;
      }

      const isFromMe = message.key.fromMe;
      const metadata: Record<string, any> = {
        connectionId,
        remoteJid: fullJid,
        source: 'evolution-webhook'
      };
      if (mimeType) metadata.mimeType = mimeType;
      if (fileName) metadata.fileName = fileName;

      const dbMessage = await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: isFromMe ? 'USER' : 'CONTACT',
          senderId: isFromMe ? null : contact.id,
          content: isGroup && message.pushName && !isFromMe ? `__${message.pushName}__: ${text}` : text,
          contentType: type === 'VIDEO' || type === 'DOCUMENT' ? 'FILE' : type === 'STICKER' ? 'IMAGE' : type,
          mediaUrl: mediaPath,
          externalId: message.key.id,
          status: isFromMe ? 'SENT' : 'DELIVERED',
          quotedId,
          metadata
        }
      });

      let updateData: any = {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        waitingReply: !isFromMe
      };

      if (!isFromMe && ticket.status === 'RESOLVED') {
        updateData.status = 'WAITING';
      }

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: updateData
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
  /**
   * Processa atualizações de status de mensagem (sent, delivered, read).
   */
  async handleEvolutionMessageUpdate(connectionId: string, data: any) {
    const externalId = data.key?.id;
    if (!externalId) return;

    const statusKey = data.status;
    let newStatus = 'SENT';
    if (statusKey === 4 || statusKey === 5) newStatus = 'READ';
    else if (statusKey === 3) newStatus = 'DELIVERED';
    else if (statusKey === 2) newStatus = 'SENT';
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
    } catch (e) {
      this.logger.error(`Error updating message status: ${e.message}`);
    }
  }

  /**
   * Processa atualizações de presença (online/digitando).
   */
  async handleEvolutionPresenceUpdate(connectionId: string, data: any) {
    const jid = data.key?.remoteJid || data.id;
    if (!jid) return;

    const phone = jid.split('@')[0].split(':')[0];
    const phoneDigits = phone.replace(/\D/g, '');
    const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-8) : phoneDigits;
    const phoneTail4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : phoneDigits;

    try {
      const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (conn) {
        let contact: any = null;

        if (phoneTail4) {
          const candidateContacts = await this.prisma.contact.findMany({
            where: {
              tenantId: conn.tenantId,
              OR: [
                { whatsapp: { contains: phoneTail4 } },
                { phone: { contains: phoneTail4 } }
              ]
            }
          });

          contact = candidateContacts.find((candidate) => {
            const whatsappDigits = (candidate.whatsapp || '').replace(/\D/g, '');
            const phoneDigitsCandidate = (candidate.phone || '').replace(/\D/g, '');
            return (whatsappDigits && whatsappDigits.endsWith(phoneTail)) || (phoneDigitsCandidate && phoneDigitsCandidate.endsWith(phoneTail));
          });
        }

        if (!contact) {
          contact = await this.prisma.contact.findFirst({
            where: {
              tenantId: conn.tenantId,
              OR: [
                { whatsapp: jid },
                { whatsapp: phone },
                { phone }
              ]
            }
          });
        }

        if (contact) {
          this.ticketsGateway.emitPresenceUpdate(
            conn.tenantId,
            contact.id,
            data.presences?.[jid]?.lastKnownPresence || 'available'
          );
        }
      }
    } catch (e) {
      this.logger.error(`Error processing presence update: ${e.message}`);
    }
  }
  // ==========================================
  // OUTGOING METHODS
  // ==========================================

  async sendText(connectionId: string, to: string, text: string) {
    const evolutionConfig = await this.getEvolutionConfig(connectionId);
    const response = await this.evolutionService.sendText(connectionId, to, text, {}, evolutionConfig);
    // Para v2.1.1, a resposta inclui a chave da mensagem
    return response?.key?.id || response?.message?.key?.id;
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
    const absoluteUrl = url.startsWith('http') || url.startsWith('data:') ? url : `${process.env.APP_URL || 'http://host.docker.internal:3000'}/${url}`;
    const response = await this.evolutionService.sendMedia(connectionId, to, type, absoluteUrl, caption, fileName, evolutionConfig);
    return response?.key?.id || response?.message?.key?.id;
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

  async updateSettings(connectionId: string, settings: any) {
    const evolutionConfig = await this.getEvolutionConfig(connectionId);
    
    // Atualizar no banco de dados primeiro
    const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });
    const currentConfig = connection?.config as any || {};
    
    // Separar o que é behavior setting do que é webhook
    const { evolutionSettings, webhookUrl, webhookEnabled } = settings;

    await this.prisma.connection.update({
      where: { id: connectionId },
      data: {
        config: {
          ...currentConfig,
          evolutionSettings: evolutionSettings || currentConfig.evolutionSettings,
          webhookUrl: webhookUrl !== undefined ? webhookUrl : currentConfig.webhookUrl,
          webhookEnabled: webhookEnabled !== undefined ? webhookEnabled : currentConfig.webhookEnabled
        }
      }
    });

    // Se estiver conectado, aplicar na Evolution API
    if (connection?.status === 'CONNECTED') {
      if (evolutionSettings) {
        await this.evolutionService.updateSettings(connectionId, evolutionSettings, evolutionConfig);
      }
      
      // Sempre garantimos que o webhook da DR.X está ativo na Evolution
      // O encaminhamento é feito via Controller (proxy)
      const webhookBaseUrl = process.env.WEBHOOK_INTERNAL_URL || process.env.APP_URL || 'http://host.docker.internal:3000';
      const defaultWebhookUrl = `${webhookBaseUrl}/api/evolution/webhook`;
      await this.evolutionService.setWebhook(connectionId, defaultWebhookUrl, evolutionConfig);
    }

    return { success: true };
  }

  async syncContacts(connectionId: string) {
    try {
      const evolutionConfig = await this.getEvolutionConfig(connectionId);
      const connection = await this.prisma.connection.findUnique({
        where: { id: connectionId }
      });
      if (!connection) return { success: false, message: 'Conexão não encontrada' };

      const contactsData = await this.evolutionService.findContacts(connectionId, evolutionConfig);
      
      let importedCount = 0;
      let updatedCount = 0;
      const contactsList = Array.isArray(contactsData) ? contactsData : 
                          Array.isArray(contactsData?.contacts) ? contactsData.contacts : 
                          Array.isArray(contactsData?.data) ? contactsData.data : [];

      if (contactsList.length > 0) {
        for (const c of contactsList) {
          const remoteJid = c.id || c.remoteJid || c.jid;
          if (!remoteJid || remoteJid === 'status@broadcast') continue;

          const isGroup = remoteJid.endsWith('@g.us');
          // Limpa o JID para pegar só o número
          let phoneRaw = remoteJid.split('@')[0].split(':')[0];
          
          if (/[a-zA-Z]/.test(phoneRaw) && !isGroup) {
             continue;
          }

          let phoneClean = phoneRaw.replace(/\D/g, '');
          // Para o Brasil, garantir que tenha o código do país se não tiver
          if (phoneClean.length <= 11 && !phoneClean.startsWith('55')) {
              phoneClean = '55' + phoneClean;
          }
          
          if (isGroup || remoteJid.includes('@lid')) {
              phoneClean = remoteJid;
          }

          const phoneTail = phoneClean.length >= 8 ? phoneClean.slice(-8) : phoneClean;
          
          let pushName = c.name || c.pushName || c.verifiedName || phoneClean;
          let picUrl = c.profilePictureUrl || c.profilePicUrl || c.imgUrl || null;

          let contact: any = null;
          
          if (phoneTail && !isGroup && !remoteJid.includes('@lid')) {
            const phoneTail4 = phoneClean.length >= 4 ? phoneClean.slice(-4) : phoneClean;
            
            const candidateContacts = await this.prisma.contact.findMany({
              where: { 
                tenantId: connection.tenantId, 
                OR: [
                  { whatsapp: { contains: phoneTail4 } },
                  { phone: { contains: phoneTail4 } }
                ]
              }
            });

            contact = candidateContacts.find(c => {
               const wClean = (c.whatsapp || '').replace(/\D/g, '');
               const pClean = (c.phone || '').replace(/\D/g, '');
               return (wClean && wClean.endsWith(phoneTail)) || (pClean && pClean.endsWith(phoneTail));
            });
          }

          if (!contact) {
            contact = await this.prisma.contact.findFirst({
              where: { 
                 tenantId: connection.tenantId, 
                 OR: [
                   { whatsapp: { equals: remoteJid } },
                   { whatsapp: { equals: phoneRaw } }
                 ]
              }
            });
          }

          if (contact) {
            // Conta como sucesso de sincronismo de qualquer forma, mesmo que não altere
            const updateData: any = {};
            if (picUrl && contact.profilePicUrl !== picUrl) updateData.profilePicUrl = picUrl;
            
            if (Object.keys(updateData).length > 0) {
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: updateData
              });
              updatedCount++;
            }
          } else {
            await this.prisma.contact.create({
              data: {
                tenantId: connection.tenantId,
                name: pushName || phoneClean || 'Sem Nome',
                whatsapp: phoneClean || '99 99999999', // Phone é mantido como opcional agora
                category: isGroup ? 'Grupo' : 'Lead',
                profilePicUrl: picUrl,
                email: 'nt@nt.com.br',
                document: null,
                notes: `Adicionado automaticamente via WhatsApp Sync.`
              }
            });
            importedCount++;
          }
        }
      }

      this.logger.log(`Synced: ${importedCount} imported, ${updatedCount} updated from Evolution API`);
      return { success: true, message: `${importedCount} novos contatos criados e ${updatedCount} atualizados (de um total de ${contactsList.length} do WhatsApp).` };
    } catch (e) {
      this.logger.error(`Error syncing contacts: ${e.message}`);
      return { success: false, message: `Erro ao sincronizar: ${e.message}` };
    }
  }

  async getDetailedDiagnostics() {
    return { engine: 'Evolution API', version: '2.1.1' };
  }
}
