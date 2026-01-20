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

// FIX: Usamos require para garantir que o Pino carregue corretamente na versão 10
const pino = require('pino');

@Injectable()
export class WhatsappService implements OnModuleInit {
  private socket: WASocket;
  private readonly logger = new Logger(WhatsappService.name); // Logger do Nest (para o nosso terminal)
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
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    this.authState = state;
    this.saveCreds = saveCreds;

    // --- A MÁGICA ACONTECE AQUI ---
    // Criamos o logger explicitamente antes de passar para o Baileys
    const baileysLogger = pino({ level: 'error' }); // 'error' para limpar o terminal, 'debug' se quiser ver tudo

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      logger: baileysLogger, // Agora passamos o objeto instanciado corretamente
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('?? QR CODE GERADO! Enviando para o Frontend...');
        this.gateway.emitQrCode(qr);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(\Conexão fechada. Reconectar: \\);
        
        if (shouldReconnect) {
          setTimeout(() => this.connectToWhatsapp(), 3000); // Espera 3s antes de tentar de novo
        } else {
            this.gateway.emitStatus('DISCONNECTED');
            // Se foi logout, limpamos a pasta para evitar loop
            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
        }
      } else if (connection === 'open') {
        this.logger.log('? CONECTADO AO WHATSAPP!');
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
          this.logger.log(\Mensagem de \: \...\);
          this.gateway.emitNewMessage({
              from: msg.key.remoteJid,
              text: text,
              name: msg.pushName
          });
      }
  }

  async sendText(to: string, text: string) {
      if (!this.socket) throw new Error('Socket não inicializado');
      const jid = to.includes('@s.whatsapp.net') ? to : \\@s.whatsapp.net\;
      await this.socket.sendMessage(jid, { text });
  }
}
