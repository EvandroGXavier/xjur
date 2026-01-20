import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  WASocket,
  proto
} from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private socket: WASocket;
  private readonly logger = new Logger(WhatsappService.name);
  private authState: any;
  private saveCreds: any;

  constructor(
    private readonly gateway: WhatsappGateway,
  ) {}

  async onModuleInit() {
    this.connectToWhatsapp();
  }

  async connectToWhatsapp() {
    const authPath = path.resolve(__dirname, '../../../../storage/auth_info_baileys');
    
    // Garante que a pasta existe
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    this.authState = state;
    this.saveCreds = saveCreds;

    // --- MOCK LOGGER (SOLUÇÃO BLINDADA) ---
    // Objeto simples que satisfaz o Baileys sem precisar do Pino
    const loggerMock: any = {
        level: 'warn',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => loggerMock, // O segredo: retorna a si mesmo, evitando o erro
    };

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      logger: loggerMock,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('📢 QR CODE NOVO GERADO! Enviando para o Frontend...');
        this.gateway.emitQrCode(qr);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Conexão fechada. Reconectar: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(() => this.connectToWhatsapp(), 3000);
        } else {
            this.gateway.emitStatus('DISCONNECTED');
            // Limpeza de segurança no logout
            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
        }
      } else if (connection === 'open') {
        this.logger.log('✅ CONECTADO AO WHATSAPP!');
        this.gateway.emitStatus('CONNECTED');
      }
    });

    this.socket.ev.on('messages.upsert', async (m) => {
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
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (text) {
          this.logger.log(`Mensagem recebida de ${msg.key.remoteJid}`);
          this.gateway.emitNewMessage({
              from: msg.key.remoteJid,
              text: text,
              name: msg.pushName
          });
      }
  }

  async sendText(to: string, text: string) {
      if (!this.socket) throw new Error('Socket não inicializado');
      const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text });
  }
}