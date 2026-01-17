import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeDASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  WASocket,
  Contact as BaileysContact,
  proto
} from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '@dr-x/database'; // Assuming this exists or will be exported
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private socket: WASocket;
  private readonly logger = new Logger(WhatsappService.name);
  private authState: any;
  private saveCreds: any;

  constructor(
    private readonly gateway: WhatsappGateway,
    // Inject PrismaService if available, otherwise we use it directly or via module
    // Assuming standard injection for now. If PrismaService isn't global, we need to import it.
    // For now, I'll assume usage of PrismaClient if service injection fails, but better to use Service.
  ) {}

  async onModuleInit() {
    this.connectToWhatsapp();
  }

  async connectToWhatsapp() {
    // Auth strategy: save sessions to 'storage/auth_info_baileys'
    const authPath = path.resolve(__dirname, '../../../../storage/auth_info_baileys');
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    this.authState = state;
    this.saveCreds = saveCreds;

    this.socket = makeDASocket({
      auth: state,
      printQRInTerminal: true, // Helpful for logs
      browser: Browsers.macOS('Desktop'),
      logger: this.logger as any, // Baileys expects a pino logger, NestJS logger might need adapter or ignore
      // pino({ level: 'silent' }) could be better if we want to reduce noise
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('QR Code received');
        this.gateway.emitQrCode(qr);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.error(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        if (shouldReconnect) {
          this.connectToWhatsapp(); // Reconnect
        } else {
            this.gateway.emitStatus('DISCONNECTED');
        }
      } else if (connection === 'open') {
        this.logger.log('Opened connection');
        this.gateway.emitStatus('CONNECTED');
      }
    });

    this.socket.ev.on('messages.upsert', async (m) => {
      // console.log(JSON.stringify(m, undefined, 2));
        
      if (m.type === 'notify') {
          for (const msg of m.messages) {
              if (!msg.key.fromMe) {
                 await this.handleIncomingMessage(msg);
              }
          }
      }
    });
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
      this.logger.log(`Received message from ${msg.key.remoteJid}`);
      // Here we will integrate with TriagemService or Prisma directly
      // For now, just logging content
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (text) {
          this.logger.log(`Content: ${text}`);
          this.gateway.emitNewMessage({
              from: msg.key.remoteJid,
              text: text,
              name: msg.pushName
          });
          
          // TODO: Save to DB via TriagemService
      }
  }

  async sendText(to: string, text: string) {
      if (!this.socket) throw new Error('Socket not initialized');
      // Ensure 'to' has domain
      const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text });
  }
}
