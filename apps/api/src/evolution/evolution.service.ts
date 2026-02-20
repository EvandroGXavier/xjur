import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
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
  }

  private getClient(config?: EvolutionConfig): AxiosInstance {
    const baseURL = config?.apiUrl || this.defaultApiUrl;
    const apikey = config?.apiKey || this.defaultApiKey;

    return axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        apikey,
      },
    });
  }

  async createInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Creating instance: ${instanceName} at ${config?.apiUrl || 'default URL'}`);
      const client = this.getClient(config);
      const response = await client.post('/instance/create', {
        instanceName,
        token: config?.apiKey || this.defaultApiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        reject_call: false,
        groupsIgnore: false,
        alwaysOnline: true,
        readMessages: true,
        readStatus: false,
      });
      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      const errorStr = JSON.stringify(errorData).toLowerCase();
      if (error.response?.status === 403 || error.response?.status === 400) {
        if (errorStr.includes('already exists') || errorStr.includes('already in use') || errorStr.includes('já existe')) {
          this.logger.log(`Instance ${instanceName} already exists/in use. Continuing...`);
          return { instance: { instanceName } };
        }
      }
      this.logger.error(`Error creating instance ${instanceName}: ${error.message} - Data: ${JSON.stringify(errorData)}`);
      throw error;
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string, config?: EvolutionConfig) {
      try {
          this.logger.log(`Setting webhook for ${instanceName} to ${webhookUrl}`);
          const client = this.getClient(config);
          
          // No Evolution v2, tentaremos o formato direto primeiro, se falhar, o envelopado
          const payload = {
              url: webhookUrl,
              enabled: true,
              events: [
                  "QRCODE_UPDATED",
                  "MESSAGES_UPSERT",
                  "MESSAGES_UPDATE",
                  "MESSAGES_DELETE",
                  "SEND_MESSAGE",
                  "CONNECTION_UPDATE",
                  "PRESENCE_UPDATE"
              ]
          };

          const response = await client.post(`/webhook/set/${instanceName}`, payload);
          return response.data;
      } catch (error) {
          const errorData = error.response?.data;
          this.logger.error(`Error setting webhook for ${instanceName}: ${error.message} - Data: ${JSON.stringify(errorData)}`);
          return { success: false, error: error.message };
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

  async connectInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Connecting instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error connecting instance ${instanceName}: ${error.message}`);
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
      const endpoint = type === 'image' ? 'sendImage' : type === 'video' ? 'sendVideo' : type === 'audio' ? 'sendAudio' : 'sendDocument';
      
      const payload: any = {
        number,
        options: {
          delay: 1200,
          presence: 'composing',
        },
      };

      if (type === 'image') payload.imageMessage = { image: mediaUrl, caption };
      else if (type === 'video') payload.videoMessage = { video: mediaUrl, caption };
      else if (type === 'audio') payload.audioMessage = { audio: mediaUrl };
      else if (type === 'document') payload.documentMessage = { document: mediaUrl, fileName, caption };

      const response = await client.post(`/message/${endpoint}/${instanceName}`, payload);
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending ${type} to ${number} via ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async markRead(instanceName: string, number: string, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.post(`/chat/markMessageAsRead/${instanceName}`, {
        number,
        read: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error marking read for ${number} via ${instanceName}: ${error.message}`);
      throw error;
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
      this.logger.error(`Error deleting message ${messageId} via ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async logoutInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Logging out instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.delete(`/instance/logout/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error logging out instance ${instanceName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async deleteInstance(instanceName: string, config?: EvolutionConfig) {
    try {
      this.logger.log(`Deleting instance: ${instanceName}`);
      const client = this.getClient(config);
      const response = await client.delete(`/instance/delete/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error deleting instance ${instanceName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendText(instanceName: string, number: string, text: string, options?: any, config?: EvolutionConfig) {
    try {
      const client = this.getClient(config);
      const response = await client.post(`/message/sendText/${instanceName}`, {
        number,
        options: {
          delay: 1200,
          presence: 'composing',
          ...options
        },
        textMessage: {
          text
        }
      });
      return response.data;
    } catch (error) {
       this.logger.error(`Error sending text to ${number} via ${instanceName}: ${error.message}`);
       throw error;
    }
  }
}

