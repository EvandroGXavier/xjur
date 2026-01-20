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
import pino from 'pino';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private socket: WASocket;
  private readonly logger = new Logger(WhatsappService.name); // Logger do Nest (para nós)
  private authState: any;
  private saveCreds: any;

  constructor(
    private readonly gateway: WhatsappGateway,
  ) {}

  async onModuleInit() {
    this.connectToWhatsapp();
  }

  async connectToWhatsapp() {
    // Define o caminho para salvar a sessão (Credenciais)
    const authPath = path.resolve(__dirname, '../../../../storage/auth_info_baileys');
    
    // Garante que a pasta existe
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    this.authState = state;
    this.saveCreds = saveCreds;

    // CONFIGURAÇÃO DO SOCKET (AQUI ESTAVA O ERRO)
    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false, // Desligamos isso pois usamos o Socket.io
      browser: Browsers.macOS('Desktop'),
      // Fix: Usamos o pino logger que o Baileys exige, em nível 'warn' para limpar o log
      logger: pino({ level: 'warn' }) as any,
    });

    // Escuta eventos de atualização de credenciais (Login salvo)
    this.socket.ev.on('creds.update', saveCreds);

    // Gerenciamento de Conexão e QR Code
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Se gerou QR Code, envia para o Frontend
      if (qr) {
        this.logger.log('QR Code recebido - Enviando para o Frontend');
        this.gateway.emitQrCode(qr);
      }

      // Se a conexão caiu
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        this.logger.warn(\Conexão fechada. Motivo: \\);
        
        if (shouldReconnect) {
          this.logger.log('Tentando reconectar automaticamente...');
          this.connectToWhatsapp();
        } else {
            this.logger.error('Desconectado permanentemente (Logout). É necessário escanear novamente.');
            this.gateway.emitStatus('DISCONNECTED');
            // Opcional: Apagar a pasta authPath aqui se quiser forçar logout limpo
        }
      } else if (connection === 'open') {
        this.logger.log('? Conexão com WhatsApp estabelecida com sucesso!');
        this.gateway.emitStatus('CONNECTED');
      }
    });

    // Escuta novas mensagens
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
      // Log limpo apenas com quem mandou
      // this.logger.log(\Mensagem recebida de \\);

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      
      if (text) {
          // Envia para o Frontend em tempo real
          this.gateway.emitNewMessage({
              from: msg.key.remoteJid,
              text: text,
              name: msg.pushName
          });
          
          // TODO: Aqui entraremos com o Prisma para salvar no Banco de Dados depois
      }
  }

  async sendText(to: string, text: string) {
      if (!this.socket) throw new Error('Socket não inicializado');
      
      // Formata o número para o padrão do WhatsApp (sempre com @s.whatsapp.net)
      const jid = to.includes('@s.whatsapp.net') ? to : \\@s.whatsapp.net\;
      
      await this.socket.sendMessage(jid, { text });
  }
}
