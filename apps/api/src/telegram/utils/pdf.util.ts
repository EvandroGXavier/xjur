import { Logger } from '@nestjs/common';
import * as fs from 'fs';

export class PdfExtractor {
  private static readonly logger = new Logger('PdfExtractor');

  static async extract(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdf = require('pdf-parse');
      const data = await pdf(dataBuffer);
      return data.text || '';
    } catch (error: any) {
      this.logger.error(`Error extracting PDF: ${error.message}`);
      return '';
    }
  }
}
