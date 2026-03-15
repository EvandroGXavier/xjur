import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import { DrxClawConfig } from '../../drx-claw/drx-claw.types';

export class WhisperTranscription {
  private static readonly logger = new Logger('WhisperTranscription');

  static async transcribe(
    filePath: string,
    config: DrxClawConfig,
    provider: string = 'LOCAL'
  ): Promise<string> {
    try {
      const botConfig = config as any;
      const baseUrl = botConfig.local?.baseUrl || 'http://localhost:1234/v1';
      const apiKey = botConfig.apiKeys?.openai || botConfig.local?.apiKey || '';

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('model', 'base');
      form.append('language', 'pt');

      const response = await axios.post(`${baseUrl}/audio/transcriptions`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
        },
        timeout: 60000,
      });

      return response.data?.text || '';
    } catch (error: any) {
      this.logger.error(`Error transcribing audio: ${error.message}`);
      return '';
    }
  }
}
