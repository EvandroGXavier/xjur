import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';

// Configura o fluent-ffmpeg com o binário estático baixado
ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  settings?: {
    whatsappVersion?: string;
    rejectCall?: boolean;
    msgCall?: string;
    groupsIgnore?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
  };
}

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly defaultApiUrl: string;
  private readonly defaultApiKey: string;

  constructor(private configService: ConfigService) {
    this.defaultApiUrl = this.configService.get<string>('EVOLUTION_API_URL') || 
                         this.configService.get<string>('EVO_SERVER_URL') || 
                         'http://localhost:8080';
    this.defaultApiKey = this.configService.get<string>('EVOLUTION_API_KEY') || 
                         this.configService.get<string>('EVO_API_KEY') || 
                         '';
    
    const enabled = this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
    if (enabled) {
      this.logger.log(`Evolution API defaults: URL=${this.defaultApiUrl}`);
    }
  }

  // ==========================================
  // HTTP CLIENT
  // ==========================================

  private formatNumber(number: string): string {
    if (!number) return '';

    const normalized = number.replace(/:[0-9]+(?=@)/, '').trim();

    // Grupos e LIDs precisam permanecer como identificadores técnicos.
    if (normalized.includes('@g.us') || normalized.includes('@lid')) {
      return normalized;
    }

    // Para envio via Evolution, JID de contato individual deve virar telefone puro.
    if (normalized.includes('@s.whatsapp.net')) {
      return normalized.split('@')[0].replace(/\D/g, '');
    }

    // Remove non-digit characters
    let cleaned = normalized.replace(/\D/g, '');
    
    // Se for um número brasileiro sem DDI (10 ou 11 dígitos), adiciona 55
    if (cleaned.length >= 10 && cleaned.length <= 11 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  }

  private formatMissingWhatsappTarget(number: string): string {
    const trimmed = String(number || '').trim();
    if (!trimmed) return 'destino desconhecido';
    if (trimmed.startsWith('+') || trimmed.includes('@')) return trimmed;
    return `+${trimmed}`;
  }

  private getClient(config?: EvolutionConfig): AxiosInstance {
    const baseURL = config?.apiUrl || this.defaultApiUrl;
    const apikey = config?.apiKey || this.defaultApiKey;

    this.logger.error(`[EVOLUTION] Client Config: baseURL=${baseURL}, apikey=${apikey ? 'PRESENT' : 'MISSING'}`);
    return axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        apikey,
      },
    });
  }

  // ==========================================
  // INSTANCE MANAGEMENT
  // ==========================================

  async createInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      const targetUrl = config?.apiUrl || this.defaultApiUrl;
      this.logger.log(`Creating instance "${instanceName}" at ${targetUrl}`);
      const client = this.getClient(config);

      const response = await client.post('/instance/create', {
        instanceName,
        token: config?.apiKey || this.defaultApiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        whatsappVersion: config?.settings?.whatsappVersion || '2.3000.x',
        rejectCall: config?.settings?.rejectCall ?? false,
        msgCall: config?.settings?.msgCall ?? '',
        groupsIgnore: config?.settings?.groupsIgnore ?? false,
        alwaysOnline: config?.settings?.alwaysOnline ?? true,
        readMessages: config?.settings?.readMessages ?? true,
        readStatus: config?.settings?.readStatus ?? false,
        syncFullHistory: config?.settings?.syncFullHistory ?? false,
      });

      this.logger.log(`Instance "${instanceName}" created successfully`);
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      const errorStr = JSON.stringify(errorData || '').toLowerCase();

      // 403 = "already in use", 409 = "already exists" – ambos significam que a instância já existe
      if (status === 403 || status === 409 || status === 400) {
        if (errorStr.includes('already') || errorStr.includes('in use') || errorStr.includes('existe')) {
          this.logger.log(`Instance "${instanceName}" already exists. Continuing...`);
          return { instance: { instanceName }, alreadyExisted: true };
        }
      }

      this.logger.error(`Error creating instance "${instanceName}" [${status}]: ${error.message}`);
      this.logger.error(`Response data: ${JSON.stringify(errorData)}`);
      throw error;
    }
  }

  async deleteInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Deleting instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.delete(`/instance/delete/${instanceName}`);
      this.logger.log(`Instance "${instanceName}" deleted`);
      return response.data;
    } catch (error) {
      this.logger.warn(`Could not delete instance "${instanceName}": ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async logoutInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Logging out instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.delete(`/instance/logout/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.warn(`Could not logout instance "${instanceName}": ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CONNECTION
  // ==========================================

  async connectInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Connecting instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error connecting instance "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  async getInstanceStatus(instanceName: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return { instance: { state: 'not_found' } };
      return { instance: { state: 'DISCONNECTED' } };
    }
  }

  // ==========================================
  // WEBHOOK CONFIGURATION
  // ==========================================

  /**
   * Configura o webhook para uma instância na Evolution API v2.1.x
   * 
   * Na v2.1.1, o endpoint é POST /webhook/set/{instanceName}
   * O payload deve conter a propriedade "webhook" envolvendo as configurações.
   * 
   * IMPORTANTE: Para instâncias locais (Docker), o webhook GLOBAL já é
   * configurado via variável de ambiente WEBHOOK_GLOBAL_URL no docker-compose.
   * Este método é especialmente útil para instâncias REMOTAS (VPS).
   */
  async setWebhook(instanceName: string, webhookUrl: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Setting webhook for "${instanceName}" -> ${webhookUrl}`);
      const client = this.getClient(config);

      // Formato correto para Evolution v2.1.1:
      // O body precisa ter a propriedade "webhook" envolvendo os dados
      const payload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: [
            "QRCODE_UPDATED",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "PRESENCE_UPDATE"
          ]
        }
      };

      const response = await client.post(`/webhook/set/${instanceName}`, payload);
      this.logger.log(`Webhook set successfully for "${instanceName}"`);
      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      this.logger.error(`Error setting webhook for "${instanceName}" [${error.response?.status}]: ${error.message}`);
      this.logger.error(`Webhook error data: ${JSON.stringify(errorData)}`);
      throw error;
    }
  }

  async updateSettings(instanceName: string, settings: any, config?: EvolutionConfig) {
    try {
      this.logger.log(`Updating settings for "${instanceName}"`);
      const client = this.getClient(config);
      
      // Evolutions v2.x é bem rigorosa com os tipos. 
      // Garantimos que tudo seja boolean ou string limpa.
      const payload = {
        rejectCall: !!settings.rejectCall,
        msgCall: settings.msgCall || "",
        groupsIgnore: !!settings.groupsIgnore,
        alwaysOnline: !!settings.alwaysOnline,
        readMessages: !!settings.readMessages,
        readStatus: !!settings.readStatus,
        syncFullHistory: !!settings.syncFullHistory,
      };

      const response = await client.post(`/settings/set/${instanceName}`, payload);
      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      this.logger.error(`Error updating settings for "${instanceName}" [${error.response?.status}]: ${JSON.stringify(errorData)}`);
      throw error;
    }
  }

  // ==========================================
  // MESSAGING
  // ==========================================

  async sendText(instanceName: string, number: string, text: string, options?: any, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const formattedNumber = this.formatNumber(number);

      // Sanitize payload strictly for Text Protocol
      const payload: any = {
        number: formattedNumber,
        text: text,
        options: {
          delay: options?.delay || 1000,
          presence: options?.presence || 'composing'
        }
      };

      // Support for Quoted Message (Replying to a specific message)
      const quotedId = options?.quotedId || (typeof options?.quoted === 'string' ? options.quoted : options?.quoted?.key?.id);
      if (quotedId) {
        payload.options.quoted = {
          key: {
            id: quotedId
          }
        };
      }

      // Ensure no base64 or media garbage leaks into text route
      if (options?.media || options?.audio) {
         this.logger.warn(`Media passed to sendText for ${number}. Media ignored to preserve text route integrity.`);
      }

      const response = await client.post(`/message/sendText/${instanceName}`, payload);
      return response.data;
    } catch (error) {
      const errResp = error.response?.data?.response?.message;
      const firstErr = Array.isArray(errResp) ? errResp[0] : errResp;
      if (firstErr && firstErr.exists === false) {
        throw new Error(`O destino nao possui WhatsApp (${this.formatMissingWhatsappTarget(number)}).`);
      }
      this.logger.error(`Error sending text to ${number} via "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  async sendMedia(
    instanceName: string,
    number: string,
    type: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string,
    mimeType?: string,
    fileName?: string,
    config?: EvolutionConfig
  ) {
    try {
      const client = this.getClient(config);
      const endpoint = type === 'image' ? 'sendImage' : type === 'video' ? 'sendVideo' : type === 'audio' ? 'sendWhatsAppAudio' : 'sendDocument';

      const formattedNumber = this.formatNumber(number);

      // Resolve mediaUrl para base64 se for caminho local ou URL interna (APP_URL/host.docker.internal).
      // URLs externas reais são passadas diretamente para a Evolution baixar.
      let mediaData = mediaUrl;
      const isExternalHttp = mediaUrl.startsWith('http') &&
        !mediaUrl.includes(process.env.APP_URL || 'host.docker.internal') &&
        !mediaUrl.includes('localhost') &&
        !mediaUrl.includes('127.0.0.1');

      if (!isExternalHttp && !mediaUrl.startsWith('data:')) {
        // Normaliza para caminho relativo ao CWD, removendo prefixos de URL interna
        const cleanUrl = mediaUrl
          .replace(/^https?:\/\/[^/]+/, '') // remove scheme + host
          .replace(/^\//, '');              // remove barra inicial
        const fullPath = path.join(process.cwd(), cleanUrl);

        if (fs.existsSync(fullPath)) {
          if (type === 'audio') {
            // Transcodificação obrigatória para OGG/Opus (requisito do Baileys/WhatsApp)
            const tempOggPath = path.join(process.cwd(), `storage/uploads/temp_${Date.now()}.ogg`);

            await new Promise((resolve, reject) => {
              this.logger.debug(`Transcoding audio to OPUS: ${fullPath}`);
              ffmpeg(fullPath)
                .toFormat('ogg')
                .audioCodec('libopus')
                .on('error', (err) => reject(err))
                .on('end', () => resolve(true))
                .save(tempOggPath);
            });

            const fileBuffer = fs.readFileSync(tempOggPath);
            mediaData = `data:audio/ogg;base64,${fileBuffer.toString('base64')}`;

            try { fs.unlinkSync(tempOggPath); } catch (e) {}
          } else {
            const fileBuffer = fs.readFileSync(fullPath);
            const ext = path.extname(fullPath).toLowerCase();
            const mimeByExt: Record<string, string> = {
              '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
              '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.ogg': 'audio/ogg',
              '.webm': 'audio/webm', '.mp3': 'audio/mpeg',
            };
            // Usa mimeType recebido; fallback por extensão; fallback genérico
            const mime = mimeType || mimeByExt[ext] || 'application/octet-stream';
            mediaData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
          }
        } else {
          this.logger.error(`Local file not found for sending: ${fullPath} - URL origin: ${mediaUrl}`);
          throw new Error(`Arquivo de mídia não encontrado no servidor: ${cleanUrl}`);
        }
      }

      const payload: any = {
        number: formattedNumber,
        options: {
          delay: 1000,
          presence: 'composing'
        }
      };

      if (type === 'audio') {
         payload.audio = mediaData;
      } else {
         payload.media = mediaData;
         payload.mediatype = type === 'document' ? 'document' : type;
         payload.caption = caption || '';
         if (type === 'document' || fileName) {
            payload.fileName = fileName || 'Documento';
         }
      }

      const response = await client.post(`/message/${endpoint}/${instanceName}`, payload);
      return response.data;
    } catch (error) {
      const errResp = error.response?.data?.response?.message;
      const firstErr = Array.isArray(errResp) ? errResp[0] : errResp;
      if (firstErr && firstErr.exists === false) {
        throw new Error(`O destino nao possui WhatsApp (${this.formatMissingWhatsappTarget(number)}).`);
      }
      this.logger.error(`Error sending ${type} to ${number} via "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // CHAT OPERATIONS
  // ==========================================

  async markRead(instanceName: string, number: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.post(`/chat/markMessageAsRead/${instanceName}`, {
        number,
        read: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error marking read for ${number} via "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  async findContacts(instanceName: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      // Na v2.x, findContacts é POST e pode aceitar filtros
      const response = await client.post(`/chat/findContacts/${instanceName}`, {
        where: {}
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error finding contacts via "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  async fetchProfile(instanceName: string, number: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.post(`/chat/fetchProfile/${instanceName}`, { number });
      return response.data;
    } catch (err) {
      this.logger.debug(`Erro ao buscar perfil para ${number}: ${err.message}`);
      return null;
    }
  }

  async fetchProfilePictureUrl(instanceName: string, number: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.post(`/chat/fetchProfilePictureUrl/${instanceName}`, { number });
      return response.data?.profilePictureUrl || response.data?.profilePicUrl || null;
    } catch (error) {
      return null; // Muitas vezes o contato não tem foto ou a rota não acha
    }
  }

  async deleteMessage(instanceName: string, remoteJid: string, messageId: string, fromMe: boolean, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.delete(`/chat/deleteMessage/${instanceName}`, {
        data: {
          remoteJid,
          id: messageId,
          fromMe,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error deleting message ${messageId} via "${instanceName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica se um número possui conta no WhatsApp.
   */
  async checkNumber(instanceName: string, number: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const formattedNumber = this.formatNumber(number);
      const response = await client.post(`/chat/whatsappNumbers/${instanceName}`, {
        numbers: [formattedNumber],
      });
      
      const results = response.data;
      if (Array.isArray(results) && results.length > 0) {
        // Retorna o primeiro resultado formatado
        return {
          exists: results[0].exists || results[0].isWhatsApp || false,
          jid: results[0].jid || results[0].number || null,
          number: results[0].number
        };
      }
      return { exists: false };
    } catch (error) {
      this.logger.error(`Error checking number ${number} via "${instanceName}": ${error.message}`);
      return { exists: false, error: error.message };
    }
  }
}
