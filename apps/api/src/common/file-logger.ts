
import * as fs from 'fs';
import * as path from 'path';

export class FileLogger {
  private logPath: string;

  constructor() {
    this.logPath = path.resolve(process.cwd(), 'whatsapp-debug.log');
  }

  log(message: string) {
    this.write('INFO', message);
  }

  error(message: string, trace?: string) {
    this.write('ERROR', `${message} ${trace || ''}`);
  }

  warn(message: string) {
    this.write('WARN', message);
  }

  debug(message: string) {
    this.write('DEBUG', message);
  }

  private write(level: string, message: string) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logPath, line);
  }
}
