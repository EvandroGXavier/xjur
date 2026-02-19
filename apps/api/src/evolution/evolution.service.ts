import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly axios: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080';
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';

    this.axios = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
    });
  }

  async createInstance(instanceName: string) {
    try {
      this.logger.log(`Creating instance: ${instanceName}`);
      const response = await this.axios.post('/instance/create', {
        instanceName,
        token: instanceName, // Using name as token for simplicity locally
        qrcode: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating instance ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    try {
      this.logger.log(`Setting webhook for ${instanceName}: ${webhookUrl}`);
      const response = await this.axios.post(`/webhook/set/${instanceName}`, {
        url: webhookUrl,
        enabled: true,
        webhook_by_events: true,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'PRESENCE_UPDATE',
          'SEND_MESSAGE',
          'CONTACTS_UPSERT'
        ],
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error setting webhook for ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async getInstanceStatus(instanceName: string) {
    try {
      const response = await this.axios.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      return { instance: { state: 'DISCONNECTED' } };
    }
  }

  async connectInstance(instanceName: string) {
    try {
      const response = await this.axios.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error connecting instance ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async logoutInstance(instanceName: string) {
    try {
      const response = await this.axios.delete(`/instance/logout/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error logging out instance ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async deleteInstance(instanceName: string) {
    try {
      const response = await this.axios.delete(`/instance/delete/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error deleting instance ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async sendText(instanceName: string, number: string, text: string) {
    try {
      const response = await this.axios.post(`/message/sendText/${instanceName}`, {
        number,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: false,
        },
        textMessage: {
          text,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending text to ${number} via ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  async sendMedia(
    instanceName: string,
    number: string,
    type: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string,
    fileName?: string
  ) {
    try {
      // If mediaUrl is a local path, Evolution might need it as base64 or a reachable URL.
      // Since we are in Docker, we should probably pass it as a URL if reachable, or base64.
      // For now, let's assume it's a URL or Evolution can reach it.
      
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

      const response = await this.axios.post(`/message/${endpoint}/${instanceName}`, payload);
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending ${type} to ${number} via ${instanceName}: ${error.message}`);
      throw error;
    }
  }
}
