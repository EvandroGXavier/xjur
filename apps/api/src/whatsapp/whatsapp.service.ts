import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
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
import NodeCache = require('node-cache');
import { PrismaService } from '../prisma.service';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { WhatsappGateway } from './whatsapp.gateway';

import { FileLogger } from '../common/file-logger';

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private sessions: Map<string, WASocket> = new Map();
  private initializingSessions: Map<string, Promise<WASocket>> = new Map();
  private reconnecting: Set<string> = new Set();
  private msgRetryCounterCache: Map<string, NodeCache> = new Map(); // Store caches per connection
  private jidCache: Map<string, NodeCache> = new Map(); // Cache verified JIDs
  private connectionCache: Map<string, any> = new Map(); // Cache connection data
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

  async onModuleDestroy() {
    this.logger.log('Shutting down WhatsApp sessions...');
    for (const [id, socket] of this.sessions.entries()) {
        try {
            socket.end(undefined);
            this.logger.log(`Session ${id} closed.`);
        } catch (e) {
            this.logger.error(`Error closing session ${id}: ${e.message}`);
        }
    }
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

  async createSession(connectionId: string): Promise<WASocket> {
    // If session is already being initialized, return that promise
    if (this.initializingSessions.has(connectionId)) {
      this.fileLogger.log(`Session for ${connectionId} is already being initialized, returning existing promise`);
      return this.initializingSessions.get(connectionId)!;
    }

    const sessionPromise = this._internalCreateSession(connectionId);
    this.initializingSessions.set(connectionId, sessionPromise);
    
    try {
      const socket = await sessionPromise;
      return socket;
    } finally {
      this.initializingSessions.delete(connectionId);
    }
  }

  private async _internalCreateSession(connectionId: string): Promise<WASocket> {
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

    const loggerPath = path.resolve(process.cwd(), 'baileys-internal.log');
    const logger = require('pino')({ 
        level,
    }, require('pino').destination(loggerPath));
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
      markOnlineOnConnect: true,
      shouldIgnoreJid: (jid) => jid.includes('broadcast'), // Performance: ignore broadcasts
    });

    // Initialize JID cache for this connection
    this.jidCache.set(connectionId, new NodeCache({ stdTTL: 3600 })); // 1 hour TTL

    this.sessions.set(connectionId, socket);
    this.reconnecting.delete(connectionId);

    socket.ev.on('creds.update', saveCreds);

    // Use process for batch events (more robust in newer Baileys)
    socket.ev.process(async (events) => {
        this.fileLogger.log(`EVENT BATCH: ${Object.keys(events).join(', ')}`);
        // 1. Connection Updates
        if (events['connection.update']) {
            const update = events['connection.update'];
            const { connection, lastDisconnect, qr } = update;
            this.fileLogger.log(`Connection Update for ${connectionId}: ${JSON.stringify({ connection, qr: !!qr, error: lastDisconnect?.error })}`);

            if (qr) {
                this.logger.log(`📢 QR Code generated for Connection ${connectionId}`);
                try {
                    const QRCode = require('qrcode');
                    const dataUrl = await QRCode.toDataURL(qr);
                    await this.prisma.connection.update({
                        where: { id: connectionId },
                        data: { qrCode: dataUrl, status: 'PAIRING' }
                    });
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
                
                this.sessions.delete(connectionId);
                this.msgRetryCounterCache.delete(connectionId);
                this.jidCache.delete(connectionId);

                if (shouldReconnect && !this.reconnecting.has(connectionId)) {
                    this.reconnecting.add(connectionId);
                    await this.prisma.connection.update({
                        where: { id: connectionId },
                        data: { status: 'DISCONNECTED', qrCode: null }
                    });
                    this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
                    setTimeout(() => this.createSession(connectionId), 3000);
                } else {
                    await this.prisma.connection.update({
                        where: { id: connectionId },
                        data: { status: 'DISCONNECTED', qrCode: null }
                    });
                    this.whatsappGateway.emitConnectionStatus(connectionId, 'DISCONNECTED');
                    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
                }
            } else if (connection === 'open') {
                this.logger.log(`✅ Connection ${connectionId} opened! User: ${socket.user?.id}`);
                this.reconnecting.delete(connectionId);
                
                // Force online presence to ensure message delivery
                await socket.sendPresenceUpdate('available');

                await this.prisma.connection.update({
                    where: { id: connectionId },
                    data: { status: 'CONNECTED', qrCode: null }
                });
                this.whatsappGateway.emitConnectionStatus(connectionId, 'CONNECTED');
            }
        }

        // 2. Incoming Messages
        if (events['messages.upsert']) {
            const m = events['messages.upsert'];
            this.fileLogger.log(`MESSAGES.UPSERT EVENT: type=${m.type} count=${m.messages?.length}`);
            
            for (const msg of m.messages) {
                const remoteJid = msg.key.remoteJid;
                this.fileLogger.log(`Message Item: fromMe=${msg.key.fromMe} jid=${remoteJid} id=${msg.key.id} type=${m.type}`);
                
                // Process ALL incoming non-self messages, regardless of type (notify or append)
                if (!msg.key.fromMe && remoteJid !== 'status@broadcast') {
                    await this.handleIncomingMessage(connectionId, msg, socket);
                }
            }
        }

        // 4. Contact Updates (Real Import)
        if (events['contacts.set']) {
            const contacts = events['contacts.set'].contacts;
            this.logger.log(`📥 Contacts Set for ${connectionId}: ${contacts.length} contacts. Importing...`);
            await this.importContactsBatch(connectionId, contacts);
        }

        if (events['contacts.upsert']) {
            const contacts = events['contacts.upsert'];
            this.logger.log(`📥 Contacts Upsert for ${connectionId}: ${contacts.length} contacts. Importing...`);
            await this.importContactsBatch(connectionId, contacts);
        }

        // 5. Contact Profile Picture Updates
        if (events['contacts.update']) {
            for (const update of events['contacts.update']) {
                if (update.imgUrl && update.id) {
                    this.logger.log(`🖼️ Profile picture updated for ${update.id}`);
                    await this.updateContactProfilePic(connectionId, update.id, update.imgUrl);
                }
            }
        }

        // 3. Message Status Updates (Blue Ticks)
        if (events['messages.update']) {
            for (const update of events['messages.update']) {
                if (update.update.status && update.key.id) {
                    const statusKey = update.update.status;
                    let newStatus = 'SENT';
                    if (statusKey === 3 || statusKey === 4) newStatus = 'READ';
                    else if (statusKey === 2) newStatus = 'DELIVERED';
                    else if (statusKey === 1) newStatus = 'SENT';
                    else continue;

                    try {
                        const msg = await this.prisma.ticketMessage.findUnique({
                            where: { externalId: update.key.id }
                        });
                        if (msg) {
                            const data: any = { status: newStatus };
                            if (newStatus === 'READ') data.readAt = new Date();
                            await this.prisma.ticketMessage.update({ where: { id: msg.id }, data });
                            
                            let conn = await this.prisma.connection.findUnique({ where: { id: connectionId } });
                            if (conn) {
                                this.ticketsGateway.emitMessageStatus(conn.tenantId, msg.ticketId, msg.id, newStatus);
                            }
                        }
                    } catch (e) {
                        this.logger.error(`Error updating message status: ${e.message}`);
                    }
                }
            }
        }
    });

    return socket;
  }


  private async handleIncomingMessage(connectionId: string, msg: proto.IWebMessageInfo, socket: WASocket) {
    this.fileLogger.log(`Processing handleIncomingMessage for ${connectionId}. JID: ${msg.key.remoteJid}`);
    
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
        this.fileLogger.warn(`Connection ${connectionId} not found in DB during handleIncomingMessage`);
        return;
    }

    const messageContent = msg.message;
    if (!messageContent) return;

    // Recursive unwrap for ephemeral and other containers
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

    if (!realContent) {
        this.fileLogger.log(`Message from ${msg.key.remoteJid} has no real content after unwrapping.`);
        return;
    }

    let text = realContent.conversation || realContent.extendedTextMessage?.text || realContent.imageMessage?.caption || realContent.videoMessage?.caption || realContent.documentMessage?.caption || '';
    let type = 'TEXT';
    
    // Detect Media Types
    if (realContent.imageMessage) {
        type = 'IMAGE';
    } else if (realContent.videoMessage) {
        type = 'VIDEO';
    } else if (realContent.audioMessage) {
        text = '[Áudio]';
        type = 'AUDIO';
    } else if (realContent.documentMessage) {
        text = text || realContent.documentMessage.fileName || '[Documento]';
        type = 'DOCUMENT';
    } else if (realContent.stickerMessage) {
        text = '[Figurinha]';
        type = 'STICKER';
    }

    if (!text && type === 'TEXT' && !realContent.pollCreationMessage) {
        this.fileLogger.log(`Skipping empty message or unhandled type from ${msg.key.remoteJid}: ${JSON.stringify(realContent)}`);
        return;
    }

    // Handle Polls (Simple text representation)
    if (realContent.pollCreationMessage) {
        text = `[Enquete] ${realContent.pollCreationMessage.name}`;
    }

    let remoteJid = msg.key.remoteJid;
    if (!remoteJid) {
        this.fileLogger.error(`Message has no remoteJid! skipping.`);
        return;
    }
    const isGroup = remoteJid.endsWith('@g.us');
    let pushName = msg.pushName || 'WhatsApp Contact';
    
    // ==========================================
    // GROUP HANDLING LOGIC
    // ==========================================
    if (isGroup) {
        const config = connection.config as any || {};
        const blockGroups = config.blockGroups ?? false; // Default: CHANGED TO FALSE to avoid blocking by mistake
        const groupWhitelist = config.groupWhitelist || []; // Array of Group JIDs

        if (blockGroups) {
            // 1. Check Manual Whitelist
            let isAllowed = groupWhitelist.includes(remoteJid);

            // 2. Check if Group is associated with any Process
            if (!isAllowed) {
                const processWithGroup = await this.prisma.process.findFirst({
                    where: {
                        tenantId: connection.tenantId,
                        OR: [
                            { contact: { whatsapp: remoteJid } }, // Direct contact
                            { processParties: { some: { contact: { whatsapp: remoteJid } } } } // Party in process
                        ]
                    }
                });
                if (processWithGroup) {
                    isAllowed = true;
                    this.logger.log(`✅ Auto-allowing group ${remoteJid} because it is linked to process ${processWithGroup.code || processWithGroup.id}`);
                }
            }

            if (!isAllowed) {
                this.logger.log(`🚫 Blocking message from group ${remoteJid} (Not in whitelist and no process found)`);
                return;
            }
        }

        // Get Real Group Name
        try {
            const groupMetadata = await socket.groupMetadata(remoteJid).catch(() => null);
            if (groupMetadata) pushName = groupMetadata.subject || 'Grupo WhatsApp';
        } catch (e) {
            this.logger.warn(`Could not fetch group metadata for ${remoteJid}`);
            pushName = 'Grupo WhatsApp';
        }
    }

    this.logger.log(`Received message from ${remoteJid} (Group: ${isGroup}) on connection ${connectionId}: ${text}`);

    try {
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
      
      // Robust search for contact (handles Brazil 9-digit discrepancy)
      let contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone }
      });

      if (!contact && phone.startsWith('55') && !isGroup) {
          // Try alternative phone format (with/without the 9)
          let altPhone = '';
          if (phone.length === 13 && phone[4] === '9') {
              altPhone = phone.slice(0, 4) + phone.slice(5);
          } else if (phone.length === 12) {
              altPhone = phone.slice(0, 4) + '9' + phone.slice(4);
          }
          
          if (altPhone) {
              this.fileLogger.log(`Searching for alternative phone: ${altPhone}`);
              contact = await this.prisma.contact.findFirst({
                  where: { tenantId, phone: altPhone }
              });
          }
      }

      if (!contact) {
        this.fileLogger.log(`Creating new contact for ${phone} (${pushName})`);
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
          
          // CRITICAL: Update the JID in database if it changed or was empty
          // This ensures that future outgoing messages use the latest verified identity
          if (contact.whatsapp !== fullJid) updates.whatsapp = fullJid;

          // FETCH PROFILE PIC if missing
          if (!contact.profilePicUrl) {
              try {
                  const url = await socket.profilePictureUrl(remoteJid, 'image').catch(() => null);
                  if (url) updates.profilePicUrl = url;
              } catch (e) {}
          }
          
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

      // Check if message already exists
      if (msg.key.id) {
          const existingMsg = await this.prisma.ticketMessage.findUnique({
              where: { externalId: msg.key.id }
          });
          if (existingMsg) {
              this.logger.log(`♻️ Ignored duplicate message: ${msg.key.id}`);
              return;
          }
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
    
    // Use JID discovery to avoid the common Brazil 9-digit identity issue
    const jid = await this.getCorrectJid(socket, to);
    
    if (!jid || !jid.includes('@')) {
         this.logger.error(`❌ Invalid JID generated for ${to}: ${jid}`);
         throw new Error(`Invalid WhatsApp number: ${to}`);
    }

    this.logger.log(`📤 Message Req: to=${to} targetJid=${jid} text="${text}" conn=${connectionId}`);

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

    const jid = await this.getCorrectJid(socket, to);
    
    if (!jid || !jid.includes('@')) {
         this.logger.error(`❌ Invalid JID generated for ${to}: ${jid}`);
         throw new Error(`Invalid WhatsApp number: ${to}`);
    }

    this.fileLogger.log(`📤 Media Req: to=${to} targetJid=${jid} type=${type} url=${url} mime=${mimetype} conn=${connectionId}`);

    try {
        let mediaBuffer: Buffer;
        let finalPath = url;
        
        // Resolve path absolute/relative
        if (!fs.existsSync(finalPath)) {
            finalPath = path.resolve(process.cwd(), url);
            if (!fs.existsSync(finalPath)) {
                this.fileLogger.error(`❌ File not found: ${url} (Resolved: ${finalPath})`);
                throw new Error(`File not found: ${url} (Resolved: ${finalPath})`);
            }
        }
        
        this.fileLogger.log(`📄 Reading file from: ${finalPath}`);

        try {
            mediaBuffer = fs.readFileSync(finalPath);
            this.fileLogger.log(`📦 Buffer loaded: ${mediaBuffer.length} bytes`);
        } catch (e) {
            this.fileLogger.error(`❌ Failed to read file at ${finalPath}: ${e.message}`);
            throw new Error(`Could not read media file: ${e.message}`);
        }

        let messageContent: any;
        let delayMs = 300;
        
        if (type === 'audio') {
            delayMs = 2000; // More time for recording presence
            try {
                await socket.sendPresenceUpdate('recording', jid);
            } catch (e) {}
        }

        if (type === 'image') {
            messageContent = { image: mediaBuffer, caption };
        } else if (type === 'video') {
            messageContent = { video: mediaBuffer, caption };
        } else if (type === 'audio') {
            // WhatsApp PTT (voice note) is NATIVE in OGG/OPUS. 
            // Browser recordings are WebM/OPUS. Sending WebM with audio/ogg label often works 
            // better than audio/mp4 because the codec (Opus) matches what WA expects for PTT.
            const isWebm = (mimetype && mimetype.includes('webm')) || finalPath.endsWith('.webm');
            const finalMime = isWebm ? 'audio/ogg; codecs=opus' : (mimetype || 'audio/mp4');
            
            this.fileLogger.log(`🎵 Preparing audio PTT with mime: ${finalMime} (Source: ${mimetype})`);
            messageContent = { 
                audio: mediaBuffer, 
                mimetype: finalMime, 
                ptt: true 
            }; 
        } else {
            // Document
            messageContent = { 
                document: mediaBuffer, 
                fileName: fileName || path.basename(finalPath), 
                mimetype: mimetype || 'application/octet-stream',
                caption 
            };
        }

        // Ensure presence is subscribed for better delivery
        await socket.presenceSubscribe(jid);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const response = await socket.sendMessage(jid, messageContent);
        this.fileLogger.log(`✅ Media successfully sent to ${jid}. Type: ${type} MsgID: ${response?.key?.id}`);
        return response?.key?.id;

    } catch (err) {
        this.fileLogger.error(`❌ Baileys sendMedia error: ${err.message} stack=${err.stack}`);
         throw new Error(`Failed to send media to ${to}: ${err.message}`);
    }
  }

  private async getCorrectJid(socket: WASocket, to: string): Promise<string> {
    if (!to) return '';
    
    // If it's already a full JID for group or LID, return as is
    if (to.includes('@g.us') || to.includes('@lid')) return to;

    let jid = this.formatJid(to);
    
    // Check JID cache first
    const cache = this.jidCache.get(socket.user?.id || 'default'); // Baileys ID is more reliable for cache key
    const cachedJid = cache?.get<string>(jid);
    if (cachedJid) return cachedJid;

    try {
        // onWhatsApp is the most reliable way to find the real identity
        const [result] = await socket.onWhatsApp(jid);
        if (result?.exists) {
            this.fileLogger.log(`🔍 JID Verified: ${jid} -> ${result.jid}`);
            cache?.set(jid, result.jid);
            return result.jid;
        }

        // Brazil 9-digit heuristic fix
        let numeric = jid.replace(/\D/g, '');
        if (numeric.startsWith('55')) {
            let alternativeJid: string | null = null;
            if (numeric.length === 13 && numeric[4] === '9') {
                // Number has 9, try without it
                alternativeJid = numeric.slice(0, 4) + numeric.slice(5) + '@s.whatsapp.net';
            } else if (numeric.length === 12) {
                // Number doesn't have 9, try with it
                alternativeJid = numeric.slice(0, 4) + '9' + numeric.slice(4) + '@s.whatsapp.net';
            }

            if (alternativeJid) {
                const [altResult] = await socket.onWhatsApp(alternativeJid);
                if (altResult?.exists) {
                    this.fileLogger.log(`🔍 Corrected JID for Brazil: ${jid} -> ${altResult.jid}`);
                    cache?.set(jid, altResult.jid);
                    return altResult.jid;
                }
            }
        }
        this.fileLogger.warn(`⚠️ JID ${jid} not verified on WhatsApp, sending as is.`);
    } catch (e) {
        this.logger.warn(`Could not verify JID onWhatsApp for ${to}: ${e.message}`);
    }

    return jid;
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

  // ==========================================
  // CONTACT SYNC & HELPERS
  // ==========================================
  
  async syncContacts(connectionId: string) {
      const socket = this.sessions.get(connectionId);
      if (!socket) throw new Error('Conexão não está ativa');

      const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return;

      this.logger.log(`🚀 Starting manual contact sync for connection ${connectionId}...`);
      
      try {
          // Manual sync usually means the user wants to force an update
          // We can try to get the list of chats and then fetch metadata/pics
          // Baileys doesn't expose a "getAllContacts" easily without a store, 
          // but we can try to re-trigger a fetch of groups and maybe query some presence.
          
          const groups = await socket.groupFetchAllParticipating();
          this.logger.log(`Synced ${Object.keys(groups).length} groups.`);

          // Background task to refresh all profile pics of existing contacts
          this.refreshAllProfilePics(connectionId).catch(err => 
              this.logger.error(`Error in background PFP refresh: ${err.message}`)
          );

          return { success: true, message: 'Sincronização e atualização de fotos iniciada.' };
      } catch (e) {
          throw new Error(`Falha na sincronização: ${e.message}`);
      }
  }

  private async importContactsBatch(connectionId: string, waContacts: any[]) {
      const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return;
      const tenantId = connection.tenantId;

      this.logger.log(`📦 Processing batch of ${waContacts.length} contacts for tenant ${tenantId}`);

      for (const waContact of waContacts) {
          const jid = waContact.id;
          if (!jid || jid.includes('broadcast')) continue;

          const isGroup = jid.endsWith('@g.us');
          const pushName = waContact.name || waContact.verifiedName || waContact.notify || (isGroup ? 'Grupo WhatsApp' : 'Contato WhatsApp');
          
          let fullJid = jid.replace(/:[0-9]+/, '');
          let phone = fullJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

          try {
              // Same robust search logic as handleIncomingMessage
              let contact = await this.prisma.contact.findFirst({
                  where: { tenantId, phone }
              });

              if (!contact) {
                 await this.prisma.contact.create({
                      data: {
                          tenantId,
                          name: pushName,
                          phone: phone,
                          whatsapp: fullJid,
                          category: isGroup ? 'Grupo' : 'Lead',
                          profilePicUrl: waContact.imgUrl || undefined
                      }
                  });
              } else {
                  // Update existing if name or JID changed
                  const updates: any = {};
                  if (contact.name === 'Contato WhatsApp' && pushName !== 'Contato WhatsApp') updates.name = pushName;
                  if (!contact.whatsapp) updates.whatsapp = fullJid;
                  if (waContact.imgUrl && !contact.profilePicUrl) updates.profilePicUrl = waContact.imgUrl;

                  if (Object.keys(updates).length > 0) {
                      await this.prisma.contact.update({
                          where: { id: contact.id },
                          data: updates
                      });
                  }
              }
          } catch (e) {
              this.logger.error(`Error importing contact ${jid}: ${e.message}`);
          }
      }
  }

  private async refreshAllProfilePics(connectionId: string) {
      const socket = this.sessions.get(connectionId);
      if (!socket) return;

      const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return;

      const contacts = await this.prisma.contact.findMany({
          where: { tenantId: connection.tenantId, whatsapp: { not: null } },
          select: { id: true, whatsapp: true }
      });

      this.logger.log(`📸 Refreshing profile pics for ${contacts.length} contacts...`);

      for (const contact of contacts) {
          try {
              const url = await socket.profilePictureUrl(contact.whatsapp!, 'image').catch(() => null);
              if (url) {
                  await this.prisma.contact.update({
                      where: { id: contact.id },
                      data: { profilePicUrl: url }
                  });
                  // Small delay to avoid rate limiting
                  await new Promise(r => setTimeout(r, 1000));
              }
          } catch (e) {
              this.logger.warn(`Failed to fetch PFP for ${contact.whatsapp}: ${e.message}`);
          }
      }
      this.logger.log(`✅ Profile pic refresh completed for ${connectionId}`);
  }

  private async updateContactProfilePic(connectionId: string, jid: string, url: string) {
      const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return;

      const phone = jid.split('@')[0].split(':')[0];
      await this.prisma.contact.updateMany({
          where: { tenantId: connection.tenantId, phone },
          data: { profilePicUrl: url }
      });
  }
}