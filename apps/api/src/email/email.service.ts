import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import { CommunicationsService } from '../communications/communications.service';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async onModuleInit() {
    this.logger.log('EmailService inicializado. Aguardando primeiro ciclo de polling...');
  }

  async onModuleDestroy() {
    this.logger.log('EmailService finalizando...');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pollEmails() {
    if (this.isPolling) {
      this.logger.debug('Polling de e-mail já em execução. Pulando ciclo.');
      return;
    }

    this.isPolling = true;
    try {
      const connections = await this.prisma.connection.findMany({
        where: {
          type: 'EMAIL',
          status: 'CONNECTED',
        },
      });

      for (const connection of connections) {
        try {
          await this.processConnection(connection);
        } catch (error) {
          this.logger.error(`Erro ao processar conexão de e-mail ${connection.id}: ${error.message}`);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async processConnection(connection: any) {
    const config = connection.config as any;
    if (!config?.imapHost) {
      this.logger.warn(`Conexão ${connection.id} sem configuração IMAP válida.`);
      return;
    }

    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort || 993,
      secure: config.secure !== false,
      auth: {
        user: config.imapUser,
        pass: config.imapPass,
      },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // --- POLÍTICA DE HISTÓRICO ---
        const fetchHistoryDays = Number(config.fetchHistoryDays || 0);
        const historyFetchedAt = config.historyFetchedAt;
        
        let searchCriteria: any = { seen: false };
        
        // Se nunca buscou histórico e tem dias configurados, expande a busca
        if (fetchHistoryDays > 0 && !historyFetchedAt) {
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - fetchHistoryDays);
          searchCriteria = { since: sinceDate };
          this.logger.log(`Buscando histórico retroativo (${fetchHistoryDays} dias) para conexão ${connection.id}`);
        }

        for await (const message of client.fetch(searchCriteria, { source: true, envelope: true })) {
          try {
            const parsed = await simpleParser(message.source);
            
            // --- POLÍTICA DE ANEXOS ---
            const downloadAttachments = config.downloadAttachments === true || config.downloadAttachments === 'true';
            const processedAttachments = [];

            if (parsed.attachments && parsed.attachments.length > 0) {
                const baseDir = path.join(process.cwd(), 'uploads', 'events', 'attachments', connection.id);
                if (downloadAttachments && !fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }

                for (const att of parsed.attachments) {
                    const attInfo: any = {
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size,
                    };

                    if (downloadAttachments) {
                        const safeFilename = `${Date.now()}_${att.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                        const filePath = path.join(baseDir, safeFilename);
                        fs.writeFileSync(filePath, att.content);
                        attInfo.localPath = `/uploads/events/attachments/${connection.id}/${safeFilename}`;
                        attInfo.downloaded = true;
                    }

                    processedAttachments.push(attInfo);
                }
            }

            // 2. CAPTURA BRUTA - Encaminhar para o CommunicationsService
            await this.communicationsService.processIncoming({
              tenantId: connection.tenantId,
              connectionId: connection.id,
              channel: 'EMAIL',
              from: parsed.from?.text || (parsed as any).envelope?.from?.[0]?.address || message.envelope.from[0]?.address,
              name: parsed.from?.value[0]?.name || (parsed as any).envelope?.from?.[0]?.name || null,
              content: parsed.text || parsed.html || '',
              contentType: parsed.html ? 'HTML' : 'TEXT',
              externalThreadId: parsed.messageId || null,
              externalMessageId: parsed.messageId || null,
              subject: parsed.subject,
              metadata: {
                provider: 'IMAP',
                hasAttachments: processedAttachments.length > 0,
                attachments: processedAttachments,
                rawHeaders: parsed.headerLines,
                to: parsed.to,
              }
            });

            // Se for e-mail novo (visto: false), marca como lido
            // Se for histórico, depende da política (aqui marcamos como lido para não re-capturar se o critério mudar)
            await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);
            this.logger.debug(`E-mail capturado: ${parsed.subject || '(sem assunto)'}`);

          } catch (msgError) {
            this.logger.error(`Erro ao processar mensagem individual na conexão ${connection.id}: ${msgError.message}`);
          }
        }

        // Se terminamos de buscar histórico com sucesso, marcamos no config
        if (fetchHistoryDays > 0 && !historyFetchedAt) {
          await this.prisma.connection.update({
            where: { id: connection.id },
            data: {
              config: {
                ...config,
                historyFetchedAt: new Date().toISOString()
              }
            }
          });
          this.logger.log(`Histórico retroativo finalizado para conexão ${connection.id}`);
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (connError) {
      throw new Error(`Falha na conexão IMAP: ${connError.message}`);
    }
  }

  /**
   * Método manual para testar a conexão antes de ativar o polling
   */
  async validateConnection(config: any) {
    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort || 993,
      secure: config.secure !== false,
      auth: {
        user: config.imapUser,
        pass: config.imapPass,
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
