import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  settings?: {
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
    this.logger.log(`Evolution API defaults: URL=${this.defaultApiUrl}`);
  }

  // ==========================================
  // HTTP CLIENT
  // ==========================================

  private getClient(config?: EvolutionConfig): AxiosInstance {
    const baseURL = config?.apiUrl || this.defaultApiUrl;
    const apikey = config?.apiKey || this.defaultApiKey;

    return axios.create({
      baseURL,
      timeout: 30000,
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

      // 403 = "already in use", 409 = "already exists" — ambos significam que a instância já existe
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
      this.logger.log(`Setting webhook for "${instanceName}" → ${webhookUrl}`);
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
      // Não lançamos o erro — o webhook global pode cobrir isso
      return { success: false, error: error.message };
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
      const isGroup = number.includes('@g.us');
      const formattedNumber = isGroup ? number : number.replace(/\D/g, '');

      const response = await client.post(`/message/sendText/${instanceName}`, {
        number: formattedNumber,
        text: text,
        options: {
          delay: 1000,
          presence: 'composing'
        }
      });
      return response.data;
    } catch (error) {
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
    fileName?: string,
    config?: EvolutionConfig
  ) {
    try {
      const client = this.getClient(config);
      const endpoint = type === 'image' ? 'sendImage' : type === 'video' ? 'sendVideo' : type === 'audio' ? 'sendWhatsAppAudio' : 'sendDocument';
      
      const isGroup = number.includes('@g.us');
      const formattedNumber = isGroup ? number : number.replace(/\D/g, '');

      // Resolve o mediaUrl para base64 se for um caminho local
      let mediaData = mediaUrl;
      // Tratar caso de audio sem prefixo
      if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:')) {
         const fs = require('fs');
         const path = require('path');
         const fullPath = path.join(process.cwd(), mediaUrl);
         if (fs.existsSync(fullPath)) {
            const fileBuffer = fs.readFileSync(fullPath);
            const ext = path.extname(fullPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
                '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.mp3': 'audio/mpeg'
            };
            const mime = mimeTypes[ext] || 'application/octet-stream';
            mediaData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
         } else {
            this.logger.warn(`Local file not found for sending: ${fullPath}`);
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
}
