import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  WASocket,
  proto,
  ConnectionState,
  downloadMediaMessage,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
import NodeCache from 'node-cache'; // Import local NodeCache
import { PrismaService } from '../prisma.service';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { WhatsappGateway } from './whatsapp.gateway';

import { FileLogger } from '../common/file-logger';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private sessions: Map<string, WASocket> = new Map();
  private reconnecting: Set<string> = new Set();
  private msgRetryCounterCache: Map<string, NodeCache> = new Map(); // Store caches per connection
  private readonly logger = new Logger(WhatsappService.name);
  private readonly fileLogger = new FileLogger();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TicketsGateway))
    private readonly ticketsGateway: TicketsGateway,
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Restoring WhatsApp sessions...');
    await this.restoreSessions();
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
        this.logger.log(`Restoring session for connection ${connection.id} (${connection.name})`);
        await this.createSession(connection.id);
      } catch (error) {
        this.logger.error(`Failed to restore session ${connection.id}: ${error.message}`);
        await this.prisma.connection.update({
          where: { id: connection.id },
          data: { status: 'DISCONNECTED', qrCode: null }
        });
      }
    }
  }

  async createSession(connectionId: string) {
    this.fileLogger.log(`Starting createSession for ${connectionId}`);
    // If session already exists and is alive, destroy it first to force new QR
    if (this.sessions.has(connectionId)) {
      this.logger.log(`Destroying existing session for ${connectionId} before recreating`);
      this.fileLogger.log(`Destroying existing session for ${connectionId}`);
      try {
        const oldSocket = this.sessions.get(connectionId);
        oldSocket?.ev?.removeAllListeners('connection.update');
        oldSocket?.ev?.removeAllListeners('creds.update');
        oldSocket?.ev?.removeAllListeners('messages.upsert');
        oldSocket?.end(undefined);
      } catch (e) {
        this.logger.warn(`Error cleaning up old session: ${e.message}`);
      }
      this.sessions.delete(connectionId);
      // Clean up cache for retry counter
      this.msgRetryCounterCache.delete(connectionId);
    }

    const sessionDir = path.resolve(process.cwd(), 'storage/sessions', connectionId);
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // Use Pino logger for Baileys with debug level as requested
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const envLevel = process.env.WA_LOGGER_LEVEL || 'debug';
    const level = validLevels.includes(envLevel) ? envLevel : 'debug';

    const logger = require('pino')({ 
        level,
    });
    this.fileLogger.log(`Initialized Pino logger for ${connectionId}`);

    // Create a new cache for message retries for this connection
    const msgRetryCounterCache = new NodeCache();
    this.msgRetryCounterCache.set(connectionId, msgRetryCounterCache);

    const socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger, // Use real logger
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      msgRetryCounterCache, // Use the cache for retries
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: false,
    });

    this.sessions.set(connectionId, socket);
    this.reconnecting.delete(connectionId);

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;
      this.fileLogger.log(`Connection Update for ${connectionId}: ${JSON.stringify({ connection, qr: !!qr, error: lastDisconnect?.error })}`);

      if (qr) {
        this.logger.log(`📢 QR Code generated for Connection ${connectionId}`);
        try {
          // Save QR as data URL in database for polling fallback
          const QRCode = require('qrcode');
          const dataUrl = await QRCode.toDataURL(qr);
          await this.prisma.connection.update({
            where: { id: connectionId },
            data: { 
              qrCode: dataUrl,
              status: 'PAIRING'
            }
          });
          this.fileLogger.log(`QR Code saved to DB for ${connectionId}`);

          // Emit QR raw string via WebSocket for real-time rendering
          this.whatsappGateway.emitQrCode(connectionId, qr);
          this.whatsappGateway.emitConnectionStatus(connectionId, 'PAIRING');
        } catch (e) {
          this.logger.error(`Failed to process QR: ${e.message}`);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Connection ${connectionId} closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        
        // Clean up current session
        this.sessions.delete(connectionId);
        this.msgRetryCounterCache.delete(connectionId); // Clean cache on close

        if (shouldReconnect && !this.reconnecting.has(connectionId)) {
          this.reconnecting.add(connectionId);
          
          await this.prisma.connection.update({
            where: { id: connectionId },
            data: { status: 'DISCONNECTED', qrCode: null }
          });
          
          // Notify frontend of disconnection so it shows reconnect UI
          this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
          
          // Try to reconnect after delay
          setTimeout(async () => {
            try {
              await this.createSession(connectionId);
            } catch (e) {
              this.logger.error(`Reconnection failed for ${connectionId}: ${e.message}`);
              this.reconnecting.delete(connectionId);
            }
          }, 3000);
        } else {
          // Logged out — clean everything
          await this.prisma.connection.update({
            where: { id: connectionId },
            data: { status: 'DISCONNECTED', qrCode: null }
          });
          this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
          
          try { 
            fs.rmSync(sessionDir, { recursive: true, force: true }); 
          } catch (e) {}
        }
      } else if (connection === 'open') {
        this.logger.log(`✅ Connection ${connectionId} opened!`);
        this.reconnecting.delete(connectionId);
        
        await this.prisma.connection.update({
          where: { id: connectionId },
          data: { status: 'CONNECTED', qrCode: null }
        });
        
        // Notify frontend
        this.whatsappGateway.emitConnectionStatus(connectionId, 'CONNECTED');
      }
    });



    // Handle Message Status Updates (Blue Ticks)
    socket.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
             if (update.update.status && update.key.id) {
                 const statusKey = update.update.status;
                 let newStatus = 'SENT';
                 
                 // Map Baileys enum to our status
                 // PENDING=0, SERVER_ACK=1, DELIVERY_ACK=2, READ=3, PLAYED=4
                 if (statusKey === 3 || statusKey === 4) newStatus = 'READ';
                 else if (statusKey === 2) newStatus = 'DELIVERED';
                 else if (statusKey === 1) newStatus = 'SENT';
                 else return; // Ignore pending or others

                 try {
                     const msg = await this.prisma.ticketMessage.findUnique({
                         where: { externalId: update.key.id }
                     });

                     if (msg) {
                         const data: any = { status: newStatus };
                         if (newStatus === 'READ') data.readAt = new Date();

                         await this.prisma.ticketMessage.update({
                             where: { id: msg.id },
                             data
                         });
                         
                         // Need tenantId. Fetch connection cached? Or from DB.
                         // Optimization: cached?
                         // For now DB.
                         const conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
                         if (conn) {
                             this.ticketsGateway.emitMessageStatus(conn.tenantId, msg.ticketId, msg.id, newStatus);
                         }
                     }
                 } catch (e) {
                     // console.error(e);
                 }
             }
        }
    });

    // Handle incoming messages
    socket.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            await this.handleIncomingMessage(connectionId, msg, socket);
          }
        }
      }
    });

    return socket;
  }


  private async handleIncomingMessage(connectionId: string, msg: proto.IWebMessageInfo, socket: WASocket) {
    const messageContent = msg.message;
    if (!messageContent) return;

    let text = messageContent.conversation || messageContent.extendedTextMessage?.text;
    let type = 'TEXT';
    
    // Detect Media Types
    if (messageContent.imageMessage) {
        text = messageContent.imageMessage.caption || '[Imagem]';
        type = 'IMAGE';
    } else if (messageContent.videoMessage) {
        text = messageContent.videoMessage.caption || '[Vídeo]';
        type = 'VIDEO';
    } else if (messageContent.audioMessage) {
        text = '[Áudio]';
        type = 'AUDIO';
    } else if (messageContent.documentMessage) {
        text = messageContent.documentMessage.fileName || '[Documento]';
        type = 'DOCUMENT';
    } else if (messageContent.stickerMessage) {
        text = '[Figurinha]';
        type = 'STICKER';
    }

    if (!text && type === 'TEXT') return;

    let remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    let pushName = msg.pushName || 'WhatsApp Contact';
    
    // ==========================================
    // GROUP HANDLING LOGIC
    // ==========================================
    if (isGroup) {
        // Fetch Connection Config to check for Blocks/Whitelists
        const connection = await this.prisma.connection.findUnique({
            where: { id: connectionId }
        });
        
        if (!connection) return;

        const config = connection.config as any || {};
        const blockGroups = config.blockGroups || false; // Default: Allow all
        const groupWhitelist = config.groupWhitelist || []; // Array of Group JIDs

        if (blockGroups) {
            // If blocking is enabled, only allow if in whitelist
            if (!groupWhitelist.includes(remoteJid)) {
                this.logger.log(`🚫 Blocking message from group ${remoteJid} (Not in whitelist)`);
                return;
            }
        }

        // Get Real Group Name
        try {
            const groupMetadata = await socket.groupMetadata(remoteJid);
            pushName = groupMetadata.subject || 'Grupo WhatsApp';
        } catch (e) {
            this.logger.warn(`Could not fetch group metadata for ${remoteJid}`);
            pushName = 'Grupo WhatsApp';
        }
    }

    this.logger.log(`Received message from ${remoteJid} (Group: ${isGroup}) on connection ${connectionId}: ${text}`);

    try {
      const connection = await this.prisma.connection.findUnique({
        where: { id: connectionId }
      });

      if (!connection) return;

      const tenantId = connection.tenantId;

      // Find or create contact
      // For groups, the Contact is the Group itself.
      // Phone for group is the JID (ex: 123456@g.us) WITHOUT suffix if we follow previous logic?
      // Previous logic stripped @s.whatsapp.net. 
      // Let's store the full ID for groups or a simplified version?
      // Let's store the raw ID minus suffix to avoid confusion, BUT for groups the ID can be long.
      // Let's stick to: Phone = JID (without suffix for compatibility, but unique)
      
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
            whatsapp: fullJid, // Save full JID
            category: isGroup ? 'Grupo' : 'Lead',
            notes: isGroup ? `Group JID: ${remoteJid}` : undefined
          }
        });
      } else {
          const updates: any = {};
          if (isGroup && contact.name !== pushName) updates.name = pushName;
          if (!contact.whatsapp) updates.whatsapp = fullJid;
          
          if (Object.keys(updates).length > 0) {
              contact = await this.prisma.contact.update({
                  where: { id: contact.id },
                  data: updates
              });
          }
      }

      // 📸 Profile Picture Sync
      if (!contact.profilePicUrl) {
           try {
               const ppUrl = await socket.profilePictureUrl(remoteJid, 'image');
               if (ppUrl) {
                   contact = await this.prisma.contact.update({
                       where: { id: contact.id },
                       data: { profilePicUrl: ppUrl }
                   });
               }
           } catch (e) {
               // Ignore privacy restrictions
           }
      }

      // Find open ticket for this contact
      let ticket = await this.prisma.ticket.findFirst({
        where: { 
          tenantId, 
          contactId: contact.id,
          status: { not: 'CLOSED' }
        }
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

      // Map Baileys type to System type
      let dbType = type;
      if (type === 'VIDEO') dbType = 'FILE';
      if (type === 'STICKER') dbType = 'IMAGE';
      if (type === 'DOCUMENT') dbType = 'FILE';

      let mediaPath: string | null = null;
      if (type !== 'TEXT') {
        try {
          // Utilizar logger undefined para evitar conflito de tipos (Nest vs Pino)
          const buffer = await downloadMediaMessage(
            msg as any,
            'buffer',
            { }, 
            { 
               logger: console as any, // Simple console logger fallback
               reuploadRequest: (msg as any).update 
            }
          );
          
          const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

          const fileId = `${Date.now()}_${Math.round(Math.random() * 1000)}`;
          let ext = 'bin';
          
          if (type === 'AUDIO') ext = 'ogg'; // WhatsApp PTT -> OGG
          else if (type === 'IMAGE') ext = 'jpg';
          else if (type === 'VIDEO') ext = 'mp4';
          else if (type === 'STICKER') ext = 'webp';
          else if (type === 'DOCUMENT') {
              const name = messageContent.documentMessage?.fileName;
              if (name) ext = name.split('.').pop() || 'bin';
          }

          const fileName = `${fileId}.${ext}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          
          // Use forward slashes for cross-platform compatibility in URL
          mediaPath = `storage/uploads/${fileName}`; 
          this.logger.log(`Media saved: ${mediaPath}`);
          
        } catch (e) {
          this.logger.error(`Media download failed: ${e.message}`);
        }
      }

      // Create message
      // If group, we might want to know WHO sent it.
      let finalContent = text;
      if (isGroup && msg.pushName) {
          finalContent = `__${msg.pushName}__: ${text}`;
      }

      const message = await this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: 'CONTACT',
          senderId: contact.id,
          content: finalContent,
          contentType: dbType,
          mediaUrl: mediaPath,
          externalId: msg.key.id,
          status: 'DELIVERED'
        }
      });

      // Update ticket
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() }
      });

      // Emit WebSocket events
      const fullTicket = await this.prisma.ticket.findFirst({
        where: { id: ticket.id },
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true, whatsapp: true, category: true } },
          _count: { select: { messages: true } },
        },
      });

      if (isNewTicket) {
        this.ticketsGateway.emitTicketCreated(tenantId, fullTicket);
      } else {
        this.ticketsGateway.emitTicketUpdated(tenantId, fullTicket);
      }
      this.ticketsGateway.emitNewMessage(tenantId, ticket.id, message);

    } catch (error) {
      this.logger.error(`Error processing incoming message: ${error.message}`);
    }
  }

  async sendText(connectionId: string, to: string, text: string) {
    const socket = this.sessions.get(connectionId);
    if (!socket) {
      this.logger.error(`❌ Session ${connectionId} not found in memory`);
      throw new Error(`Socket not initialized for connection ${connectionId}`);
    }

    if (!this.isSessionAlive(connectionId)) {
      this.logger.error(`❌ Session ${connectionId} exists but is not alive (no user)`);
      throw new Error(`WhatsApp connection is lost for ${connectionId}`);
    }
    
    // Normalize phone number (Ensure 55 for Brazil if not present)
    const jid = this.formatJid(to);
    
    if (!jid || !jid.includes('@')) {
         this.logger.error(`❌ Invalid JID generated for ${to}: ${jid}`);
         throw new Error(`Invalid WhatsApp number: ${to}`);
    }

    this.logger.log(`📤 Message Req: to=${to} jid=${jid} text="${text}" conn=${connectionId}`);

    try {
      // Validate existence on WhatsApp (optional, but good for debugging)
      // const [result] = await socket.onWhatsApp(jid);
      // if (!result?.exists) {
      //    this.logger.warn(`⚠️ Number ${jid} not found on WhatsApp`);
      // }

      // Send with linkPreview disabled to avoid potential crashes in link parsing
      // Ensure presence is subscribed to avoid "delivery" issues if possible
      await socket.presenceSubscribe(jid);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for presence to sync

      // Send message
      // @ts-ignore - Explicitly disable link preview to prevent crashes, ignoring type check
      const response = await socket.sendMessage(jid, { text }, { linkPreview: null });    
      this.logger.log(`✅ Message successfully sent to ${jid}`);
      return response?.key?.id;
    } catch (err) {
      this.logger.error(`❌ Baileys sendMessage error for ${to} on connection ${connectionId}: ${err.message} stack=${err.stack}`);
      // Re-throw with clean message
      throw new Error(`Failed to send to ${to}: ${err.message}`);
    }
  }

  async markRead(connectionId: string, jid: string, messageIds: string[]) {
      const socket = this.sessions.get(connectionId);
      if (!socket) return;
      
      const distinctIds = [...new Set(messageIds)];
      const keys = distinctIds.map(id => ({ 
          remoteJid: jid, 
          id, 
          fromMe: false 
      }));
      
      await socket.readMessages(keys);
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
    const socket = this.sessions.get(connectionId);
    if (!socket) {
        throw new Error(`Socket not initialized for connection ${connectionId}`);
    }
    if (!this.isSessionAlive(connectionId)) {
         this.logger.error(`❌ Session ${connectionId} exists but is not alive`);
        throw new Error(`WhatsApp connection is lost for ${connectionId}`);
    }

    const jid = this.formatJid(to);
    
    if (!jid || !jid.includes('@')) {
         this.logger.error(`❌ Invalid JID generated for ${to}: ${jid}`);
         throw new Error(`Invalid WhatsApp number: ${to}`);
    }

    this.logger.log(`📤 Media Req: to=${to} jid=${jid} type=${type} url=${url} mime=${mimetype} conn=${connectionId}`);

    try {
        let mediaBuffer: Buffer;
        let finalPath = url;
        
        // Resolve path absolute/relative
        if (!fs.existsSync(finalPath)) {
            finalPath = path.resolve(process.cwd(), url);
            if (!fs.existsSync(finalPath)) {
                 throw new Error(`File not found: ${url} (Resolved: ${finalPath})`);
            }
        }

        try {
            mediaBuffer = fs.readFileSync(finalPath);
        } catch (e) {
            this.logger.error(`Failed to read file at ${finalPath}: ${e.message}`);
            throw new Error(`Could not read media file: ${e.message}`);
        }

        let messageContent: any;

        if (type === 'image') {
            messageContent = { image: mediaBuffer, caption };
        } else if (type === 'video') {
            messageContent = { video: mediaBuffer, caption };
        } else if (type === 'audio') {
            messageContent = { audio: mediaBuffer, mimetype: mimetype || 'audio/mp4', ptt: true }; 
        } else {
            // Document
            messageContent = { 
                document: mediaBuffer, 
                fileName: fileName || path.basename(finalPath), 
                mimetype: mimetype || 'application/octet-stream',
                caption 
            };
        }

        const response = await socket.sendMessage(jid, messageContent);
        this.logger.log(`✅ Media successfully sent to ${jid}`);
        return response?.key?.id;

    } catch (err) {
        this.logger.error(`❌ Baileys sendMedia error: ${err.message} stack=${err.stack}`);
         throw new Error(`Failed to send media to ${to}: ${err.message}`);
    }
  }

  private formatJid(contact: string): string {
    // If it already contains explicit server, trust it
    if (contact.includes('@s.whatsapp.net') || contact.includes('@g.us') || contact.includes('@lid')) {
        return contact;
    }

    // Numeric Processing for JID
    let number = contact.replace(/\D/g, ''); // Remove all non-digits

    // Heuristics for Brazil (DDI 55)
    // 1. If starts with 55 and length seems right (12 or 13 digits), trust it.
    if (number.startsWith('55')) {
        if (number.length >= 12) return `${number}@s.whatsapp.net`;
        // If it starts with 55 but is short (e.g. 55319999), it's invalid or missing digits.
        // But might be legitimate if it's a short code? unlikely for WA.
    }

    // 2. If length is 10 or 11 (DDD + Number), assume BR and add 55.
    if (number.length === 10 || number.length === 11) {
        return `55${number}@s.whatsapp.net`;
    }

    // 3. Fallback: If we have a number but it doesn't fit above, return as is with suffix
    // (Could be international number without + or just weird format)
    if (number.length > 0) {
        return `${number}@s.whatsapp.net`;
    }

    return '';

  }

  getConnectionStatus(connectionId: string) {
    const socket = this.sessions.get(connectionId);
    const isConnected = socket && (socket as any).user;
    return {
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      user: isConnected ? (socket as any).user : null,
      timestamp: new Date().toISOString()
    };
  }

  async deleteMessage(connectionId: string, remoteJid: string, messageId: string, fromMe: boolean = true) {
    const socket = this.sessions.get(connectionId);
    if (!socket) {
        throw new Error('Socket not initialized');
    }

    // Format JID if needed
    const jid = this.formatJid(remoteJid);
    if (!jid) throw new Error('Invalid JID');

    const key = {
        remoteJid: jid,
        fromMe,
        id: messageId
    };

    this.logger.log(`🗑️ Deleting message ${messageId} in ${jid} via ${connectionId}`);
    try {
        await socket.sendMessage(jid, { delete: key });
    } catch (e) {
        this.logger.error(`Failed to delete message: ${e.message}`);
        throw e;
    }
  }

  async disconnect(connectionId: string) {
    const socket = this.sessions.get(connectionId);
    if (socket) {
      try {
        socket.ev?.removeAllListeners('connection.update');
        socket.ev?.removeAllListeners('creds.update');
        socket.ev?.removeAllListeners('messages.upsert');
        await socket.logout();
      } catch (e) {
        this.logger.warn(`Error during logout for ${connectionId}: ${e.message}`);
      }
      this.sessions.delete(connectionId);
      this.reconnecting.delete(connectionId);
      
      // Clean session files
      const sessionDir = path.resolve(process.cwd(), 'storage/sessions', connectionId);
      try { 
        fs.rmSync(sessionDir, { recursive: true, force: true }); 
      } catch (e) {}
      
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'DISCONNECTED', qrCode: null }
      });
      
      this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
    }
  }

  getSession(connectionId: string): WASocket | undefined {
    return this.sessions.get(connectionId);
  }

  isSessionAlive(connectionId: string): boolean {
    const socket = this.sessions.get(connectionId);
    return !!(socket && (socket as any).user);
  }

  async getDetailedDiagnostics() {
    this.logger.log('🕵️ Running detailed diagnostics...');
    
    // Check Memory
    const memorySessions: any[] = [];
    this.sessions.forEach((socket, id) => {
        memorySessions.push({
            id,
            isAlive: !!(socket && (socket as any).user),
            user: (socket as any)?.user?.id || 'Unknown'
        });
    });

    // Check Database
    const dbConnections = await this.prisma.connection.findMany({
        where: { type: 'WHATSAPP' }
    });

    return {
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        memory: {
            count: this.sessions.size,
            sessions: memorySessions
        },
        database: dbConnections.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            qrCodeLength: c.qrCode?.length || 0,
            updatedAt: c.updatedAt
        }))
    };
  }
}