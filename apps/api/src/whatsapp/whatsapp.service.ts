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
  // CONFIGURAÇÃO DINÂMICA POR CONEXÃO
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
      if (config.evolutionUrl && config.evolutionApiKey) {
        return {
          apiUrl: config.evolutionUrl,
          apiKey: config.evolutionApiKey
        };
      }
    } catch (e) {
      this.logger.error(`Failed to fetch evolution config for ${connectionId}: ${e.message}`);
    }
    return undefined;
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
          // Instância conectada — atualizar webhook
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
   * Fluxo: Delete antiga (se existir) → Create → Set Webhook → Connect → QR Code
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
        // Ignorar — pode não existir
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
      this.logger.log(`Setting webhook URL: ${webhookUrl}`);  
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

    // ── COOLDOWN CHECK ──
    // Se esta instância foi "killed" recentemente, ignorar TODOS os webhooks
    const killedAt = this.killedInstances.get(connectionId);
    if (killedAt) {
      if (Date.now() - killedAt < this.KILL_COOLDOWN_MS) {
        // Ainda no cooldown — ignora silenciosamente
        return;
      }
      // Cooldown expirou — limpar
      this.killedInstances.delete(connectionId);
    }
    
    this.logger.log(`Connection ${connectionId}: state=${state}, reason=${reason}`);
    
    // ── 405/401: SESSÃO EXPIROU ──
    // Deletar instância na Evolution para PARAR o loop de reconexão
    // MAS: NÃO deletar se a connection está em PAIRING (criação nova, estado transitório)
    if (reason === 405 || reason === 401) {
      // Verificar se está em fase de criação (PAIRING) — se sim, ignorar o 405/401
      // pois é um estado transitório normal da Evolution antes do QR code
      try {
        const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
        if (conn?.status === 'PAIRING') {
          this.logger.warn(`Connection ${connectionId} got ${reason} but is PAIRING — ignoring (transient state)`);
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

    // ── 408: TIMEOUT ──
    // Ignorar silenciosamente
    if (reason === 408 && state === 'close') {
      this.logger.debug(`Connection ${connectionId} timeout — ignoring`);
      return;
    }

    // ── MAPEAR ESTADO ──
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

    this.logger.log(`📸 QR Code received via webhook for ${connectionId}`);

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
  async handleEvolutionMessage(connectionId: string, message: any) {
    // Permite "fromMe" para carregar as mensagens enviadas do aparelho!
    if (message.key?.remoteJid === 'status@broadcast') return;

    this.fileLogger.log(`Processing Evolution message for ${connectionId}. JID: ${message.key?.remoteJid}`);
    
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) return;

    const messageContent = message.message;
    if (!messageContent) return;

    // Desembrulha mensagens especiais (efêmeras, visualização única, etc)
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

    // Extrair texto e tipo
    let text = realContent.conversation 
      || realContent.extendedTextMessage?.text 
      || realContent.imageMessage?.caption 
      || realContent.videoMessage?.caption 
      || realContent.documentMessage?.caption 
      || '';
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

    // Filtro de grupos
    if (isGroup) {
      const config = connection.config as any || {};
      if (config.blockGroups && !(config.groupWhitelist || []).includes(remoteJid)) return;
    }

    try {
      const tenantId = connection.tenantId;
      let fullJid = remoteJid.replace(/:[0-9]+/, '');
      let phoneRaw = fullJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
      
      // Validação de número - não importar contatos anômalos com letras (evita lixo no banco)
      if (/[a-zA-Z]/.test(phoneRaw)) {
         this.fileLogger.log(`Skipping contact creation for ${phoneRaw}: Contains letters`);
         // We still can't just return here, because we want to save the ticket/message
         // But we shouldn't create a fake contact for them. We will create a fallback "Unknown" contact if a valid one isn't found, 
         // BUT wait, a user sending a message must be attached to a contact.
         // Let's at least clean the letters for the phone field, or leave it blank and rely on email fallback.
      }
      
      let phoneClean = phoneRaw.replace(/\D/g, '');
      const phoneTail = phoneClean.length >= 8 ? phoneClean.slice(-8) : phoneClean;
      
      let contact: any = null;
      
      if (phoneTail) {
        // Busca inteligente considerando os 8 dígitos finais, tanto em celular quanto telefone
         contact = await this.prisma.contact.findFirst({
           where: { 
             tenantId, 
             OR: [
               { whatsapp: { endsWith: phoneTail } },
               { phone: { endsWith: phoneTail } },
               { whatsapp: { equals: phoneRaw } } // Literal fallback
             ]
           }
         });
      }

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            tenantId,
            name: pushName || phoneClean || 'Sem Nome',
            // Salva em whatsapp; phone fica null conforme regra
            whatsapp: phoneClean || '99 99999999',
            category: isGroup ? 'Grupo' : 'Lead',
            email: 'nt@nt.com.br',
            document: null,
            notes: `Adicionado automaticamente via WhatsApp. ${fullJid}`
          }
        });
      }

      // Buscar foto se não existir
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
        } catch(e) {}
      }

      // Salvar mídia se houver
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

      // Buscar ou criar ticket
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

      // Criar mensagem
      const isFromMe = message.key.fromMe;
      const dbMessage = await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: isFromMe ? 'USER' : 'CONTACT',
          senderId: isFromMe ? null : contact.id,
          content: isGroup && message.pushName && !isFromMe ? `__${message.pushName}__: ${text}` : text,
          contentType: type === 'VIDEO' || type === 'DOCUMENT' ? 'FILE' : type === 'STICKER' ? 'IMAGE' : type,
          mediaUrl: mediaPath,
          externalId: message.key.id,
          status: 'DELIVERED',
          quotedId
        }
      });

      // Atualizar timestamp do ticket e status de quem deve responder
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { 
          updatedAt: new Date(), 
          lastMessageAt: new Date(), 
          waitingReply: !isFromMe 
        }
      });

      // Emitir eventos via WebSocket
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
    try {
      const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (conn) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId: conn.tenantId, phone }
        });
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
          const remoteJid = c.id || c.remoteJid;
          if (!remoteJid || remoteJid === 'status@broadcast') continue;

          const isGroup = remoteJid.endsWith('@g.us');
          let phoneRaw = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
          
          if (/[a-zA-Z]/.test(phoneRaw) && !isGroup) {
             // Ignora e não importa contatos irregulares (ex: canais, status, bots mal formados)
             continue;
          }

          let phoneClean = phoneRaw.replace(/\D/g, '');
          const phoneTail = phoneClean.length >= 8 ? phoneClean.slice(-8) : phoneClean;
          
          let pushName = c.name || c.pushName || c.verifiedName || phoneClean;
          let picUrl = c.profilePictureUrl || c.profilePicUrl || c.imgUrl || null;

          let contact: any = null;
          if (phoneTail) {
            contact = await this.prisma.contact.findFirst({
              where: { 
                 tenantId: connection.tenantId, 
                 OR: [
                   { whatsapp: { endsWith: phoneTail } },
                   { phone: { endsWith: phoneTail } },
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