import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import { FinancialService } from '../financial/financial.service';
import { InboxService } from '../inbox/inbox.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialService: FinancialService,
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
  ) {}

  @Cron('*/15 * * * * *')
  async processPendingIncomingEvents() {
    const now = new Date();
    const events = await this.prisma.incomingEvent.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: now } },
        ],
      },
      orderBy: { receivedAt: 'asc' },
      take: 20,
    });

    for (const event of events) {
      await this.processIncomingEvent(event.id);
    }
  }

  async processIncomingEvent(eventId: string) {
    const current = await this.prisma.incomingEvent.findUnique({
      where: { id: eventId },
    });

    if (!current || (current.status !== 'PENDING' && current.status !== 'FAILED')) {
      return null;
    }

    const event = await this.prisma.incomingEvent.update({
      where: { id: eventId },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    try {
      if (event.channel === 'WHATSAPP' && event.eventType === 'messages.upsert') {
        const result = await this.processWhatsappUpsert(event);
        await this.prisma.incomingEvent.update({
          where: { id: event.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
        return result;
      }

      // NOVO: Tratamento universal para outros canais capturados de forma bruta
      if (event.eventType === 'inbound.message') {
        const result = await this.processGenericInbound(event);
        await this.prisma.incomingEvent.update({
          where: { id: event.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
        return result;
      }
      // Fallback para eventos desconhecidos
      await this.prisma.incomingEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          processingError: 'EVENT_TYPE_NOT_HANDLED',
        },
      });

      return { skipped: true, eventType: event.eventType };
    } catch (error: any) {
      this.logger.error(`Falha ao processar IncomingEvent ${event.id}: ${error?.message || error}`);
      const nextAttemptAt = new Date(Date.now() + 30_000);
      await this.prisma.incomingEvent.update({
        where: { id: event.id },
        data: {
          status: event.retryCount >= 5 ? 'DEAD_LETTER' : 'FAILED',
          nextAttemptAt: event.retryCount >= 5 ? null : nextAttemptAt,
          processingError: error?.message || 'Falha desconhecida no processamento.',
        },
      });
      return null;
    }
  }

  private unwrapMessageContent(message: any): any {
    if (!message) return message;
    if (message.ephemeralMessage) return this.unwrapMessageContent(message.ephemeralMessage.message);
    if (message.viewOnceMessage) return this.unwrapMessageContent(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2) return this.unwrapMessageContent(message.viewOnceMessageV2.message);
    if (message.documentWithCaptionMessage) return this.unwrapMessageContent(message.documentWithCaptionMessage.message);
    if (message.editMessage) return this.unwrapMessageContent(message.editMessage.message);
    return message;
  }

  private normalizeWhatsappIdentity(value?: string | null) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(/:[0-9]+(?=@)/, '');
    return normalized.length > 0 ? normalized : null;
  }

  private extractWhatsappDigits(value?: string | null) {
    const normalized = this.normalizeWhatsappIdentity(value);
    if (!normalized) return '';
    if (normalized.includes('@lid') || normalized.includes('@g.us')) return '';
    if (normalized.includes('@s.whatsapp.net')) {
      return normalized.split('@')[0].replace(/\D/g, '');
    }
    return normalized.replace(/\D/g, '');
  }

  private isPlausibleWhatsappNumber(value?: string | null) {
    return typeof value === 'string' && /^\d{10,15}$/.test(value);
  }

  private getMediaNode(realContent: any): any {
    return (
      realContent?.imageMessage ||
      realContent?.videoMessage ||
      realContent?.audioMessage ||
      realContent?.documentMessage ||
      realContent?.stickerMessage ||
      null
    );
  }

  private extractMediaBase64(message: any, eventPayload?: any, realContent?: any): string | null {
    const mediaNode = this.getMediaNode(realContent);
    const candidates = [
      message?.base64,
      message?.data?.base64,
      eventPayload?.data?.base64,
      eventPayload?.base64,
      eventPayload?.data?.message?.base64,
      mediaNode?.base64,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 100) {
        return candidate;
      }
    }

    return null;
  }

  private extractMediaDetails(realContent: any) {
    const mediaNode = this.getMediaNode(realContent);
    return {
      mimeType: mediaNode?.mimetype || mediaNode?.mimeType || undefined,
      fileName: mediaNode?.fileName || mediaNode?.title || undefined,
    };
  }

  private resolveMediaExtension(type: string, mimeType?: string, fileName?: string): string {
    const originalExtension = fileName ? path.extname(fileName).replace('.', '').toLowerCase() : '';
    if (originalExtension) return originalExtension;

    const mimeMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/opus': 'ogg',
      'audio/webm': 'webm',
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };

    if (mimeType && mimeMap[mimeType.toLowerCase()]) {
      return mimeMap[mimeType.toLowerCase()];
    }

    switch (type) {
      case 'AUDIO':
        return 'ogg';
      case 'IMAGE':
        return 'jpg';
      case 'VIDEO':
        return 'mp4';
      case 'DOCUMENT':
        return 'pdf';
      case 'STICKER':
        return 'webp';
      default:
        return 'bin';
    }
  }

  private saveInboundMedia(type: string, base64Data: string, mimeType?: string, fileName?: string): string | null {
    try {
      let normalizedBase64 = base64Data;
      if (normalizedBase64.includes('base64,')) {
        normalizedBase64 = normalizedBase64.split('base64,')[1];
      }

      const buffer = Buffer.from(normalizedBase64, 'base64');
      const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileId = `${Date.now()}_${Math.round(Math.random() * 1000)}`;
      const extension = this.resolveMediaExtension(type, mimeType, fileName);
      const savedFileName = `${fileId}.${extension}`;
      const filePath = path.join(uploadsDir, savedFileName);
      fs.writeFileSync(filePath, buffer);
      return `storage/uploads/${savedFileName}`;
    } catch (error: any) {
      this.logger.error(`Falha ao salvar mídia do evento: ${error?.message || error}`);
      return null;
    }
  }

  private extractMessagePayload(event: any) {
    const normalizedPayload = (event.normalizedPayload && typeof event.normalizedPayload === 'object')
      ? (event.normalizedPayload as Record<string, any>)
      : {};
    const rawPayload = (event.payload && typeof event.payload === 'object')
      ? (event.payload as Record<string, any>)
      : {};

    const message = normalizedPayload.message || rawPayload.data || rawPayload.message || rawPayload;
    return {
      message,
      rawPayload,
    };
  }

  private buildWhatsappContent(realContent: any) {
    let type = 'TEXT';
    let text = '';
    const quotedId = realContent?.extendedTextMessage?.contextInfo?.stanzaId || null;

    if (realContent?.conversation) {
      text = realContent.conversation;
    } else if (realContent?.extendedTextMessage) {
      text = realContent.extendedTextMessage.text || '';
    } else if (realContent?.imageMessage) {
      type = 'IMAGE';
      text = realContent.imageMessage.caption || '';
    } else if (realContent?.videoMessage) {
      type = 'VIDEO';
      text = realContent.videoMessage.caption || '';
    } else if (realContent?.audioMessage) {
      type = 'AUDIO';
      text = '[Audio]';
    } else if (realContent?.documentMessage) {
      type = 'DOCUMENT';
      text = realContent.documentMessage.fileName || '[Documento]';
    } else if (realContent?.stickerMessage) {
      type = 'STICKER';
      text = '[Figurinha]';
    } else if (realContent?.pollCreationMessage) {
      text = `[Enquete] ${realContent.pollCreationMessage.name || ''}`;
    } else if (realContent?.contactMessage) {
      text = `[Contato] ${realContent.contactMessage.displayName || ''}`;
    } else if (realContent?.locationMessage) {
      text = '[Localizacao]';
    }

    return {
      type,
      text,
      quotedId,
      contentType:
        type === 'VIDEO' || type === 'DOCUMENT'
          ? 'FILE'
          : type === 'STICKER'
            ? 'IMAGE'
            : type,
    };
  }

  private async findOrCreateWhatsappContact(params: {
    tenantId: string;
    remoteJid?: string | null;
    participantId?: string | null;
    pushName?: string | null;
  }) {
    const identities = Array.from(
      new Set(
        [params.remoteJid, params.participantId]
          .map((value) => this.normalizeWhatsappIdentity(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const phoneDigits = identities
      .map((value) => this.extractWhatsappDigits(value))
      .find((value) => this.isPlausibleWhatsappNumber(value)) || null;
    const canonicalJid = phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null;

    let contact = null as any;

    if (identities.length > 0) {
      const alias = await this.prisma.contactChannelIdentity.findFirst({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          externalId: { in: [...identities, ...(canonicalJid ? [canonicalJid] : []), ...(phoneDigits ? [phoneDigits] : [])] },
        },
      });

      if (alias?.contactId) {
        contact = await this.prisma.contact.findFirst({
          where: { id: alias.contactId, tenantId: params.tenantId },
        });
      }
    }

    if (!contact) {
      contact = await this.prisma.contact.findFirst({
        where: {
          tenantId: params.tenantId,
          OR: [
            ...(canonicalJid ? [{ whatsappFullId: canonicalJid }] : []),
            ...(phoneDigits ? [{ whatsapp: phoneDigits }, { whatsappE164: phoneDigits }, { phone: phoneDigits }] : []),
            ...identities.map((identity) => ({ whatsappFullId: identity })),
          ],
        },
      });
    }

    const displayName = params.pushName?.trim() || phoneDigits || 'WhatsApp Contact';

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId: params.tenantId,
          name: displayName,
          whatsapp: phoneDigits || undefined,
          whatsappE164: phoneDigits || undefined,
          whatsappFullId: canonicalJid || identities.find((value) => value.includes('@')) || undefined,
          category: 'Lead',
          notes: `Criado automaticamente pelo processador de eventos. ${identities.join(' | ')}`,
        },
      });
    } else {
      const updateData: Record<string, any> = {};
      if (phoneDigits && (!contact.whatsapp || String(contact.whatsapp).includes('@lid'))) {
        updateData.whatsapp = phoneDigits;
      }
      if (phoneDigits && !contact.whatsappE164) {
        updateData.whatsappE164 = phoneDigits;
      }
      if (canonicalJid && !contact.whatsappFullId) {
        updateData.whatsappFullId = canonicalJid;
      }
      if (displayName && (!contact.name || contact.name === 'WhatsApp Contact')) {
        updateData.name = displayName;
      }

      if (Object.keys(updateData).length > 0) {
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: updateData,
        });
      }
    }

    for (const externalId of [...identities, ...(canonicalJid ? [canonicalJid] : []), ...(phoneDigits ? [phoneDigits] : [])]) {
      await this.prisma.contactChannelIdentity.upsert({
        where: {
          tenantId_channel_externalId: {
            tenantId: params.tenantId,
            channel: 'WHATSAPP',
            externalId,
          },
        },
        create: {
          tenantId: params.tenantId,
          contactId: contact.id,
          channel: 'WHATSAPP',
          provider: 'EVOLUTION',
          externalId,
        },
        update: {
          contactId: contact.id,
          provider: 'EVOLUTION',
        },
      });
    }

    return {
      contact,
      phoneDigits,
      canonicalJid,
    };
  }

  private async ensureOpenTicket(params: {
    tenantId: string;
    contactId: string;
    channel: string;
    title: string;
    waitingReply: boolean;
    occurredAt: Date;
  }) {
    const existing = await this.prisma.ticket.findFirst({
      where: {
        tenantId: params.tenantId,
        contactId: params.contactId,
        channel: params.channel,
        status: { notIn: ['CLOSED', 'RESOLVED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return this.prisma.ticket.update({
        where: { id: existing.id },
        data: {
          waitingReply: params.waitingReply,
          lastMessageAt: params.occurredAt,
          updatedAt: params.occurredAt,
        },
      });
    }

    return this.prisma.ticket.create({
      data: {
        tenantId: params.tenantId,
        title: params.title,
        status: 'OPEN',
        priority: 'MEDIUM',
        channel: params.channel,
        contactId: params.contactId,
        queue: 'DEFAULT',
        waitingReply: params.waitingReply,
        lastMessageAt: params.occurredAt,
      },
    });
  }

  private buildInitialAiAnalysis(textContent: string, contentType: string) {
    const normalized = (textContent || '').toLowerCase();
    const intents: string[] = [];
    const flags = {
      comprovantePagamento:
        normalized.includes('comprovante') ||
        normalized.includes('pix') ||
        normalized.includes('paguei') ||
        normalized.includes('pagamento'),
      saudacao:
        normalized.includes('bom dia') ||
        normalized.includes('boa tarde') ||
        normalized.includes('boa noite') ||
        normalized.includes('ola'),
    };

    if (flags.comprovantePagamento) intents.push('FINANCEIRO_COMPROVANTE');
    if (flags.saudacao) intents.push('SAUDACAO');
    if (contentType === 'AUDIO') intents.push('AGUARDANDO_TRANSCRICAO');

    return {
      status: contentType === 'AUDIO' ? 'PENDING' : 'READY',
      intents,
      resumo: textContent?.slice(0, 180) || null,
      flags,
      analisadoEm: new Date().toISOString(),
    };
  }

  private async processWhatsappUpsert(event: any) {
    const { message, rawPayload } = this.extractMessagePayload(event);
    if (!message?.key?.remoteJid || message.key.remoteJid === 'status@broadcast') {
      return { skipped: true, contactId: event.contactId || null };
    }

    const messageContent = message.message;
    if (!messageContent) {
      return { skipped: true, contactId: event.contactId || null };
    }

    const realContent = this.unwrapMessageContent(messageContent);
    if (!realContent) {
      return { skipped: true, contactId: event.contactId || null };
    }

    const remoteJid = this.normalizeWhatsappIdentity(message.key.remoteJid);
    const participantId = this.normalizeWhatsappIdentity(
      message.sender ||
      message.key.participantPn ||
      message.key.senderPn ||
      message.key.participant ||
      rawPayload?.data?.key?.participantPn ||
      rawPayload?.data?.key?.senderPn ||
      rawPayload?.data?.key?.participant ||
      remoteJid,
    );

    const { type, text, quotedId, contentType } = this.buildWhatsappContent(realContent);
    const { contact, phoneDigits, canonicalJid } = await this.findOrCreateWhatsappContact({
      tenantId: event.tenantId,
      remoteJid,
      participantId,
      pushName: message.pushName || null,
    });

    const occurredAt = new Date(
      message.messageTimestamp ? Number(message.messageTimestamp) * 1000 : event.receivedAt || Date.now(),
    );
    const isFromMe = Boolean(message.key.fromMe);
    const title = contact.name || `Atendimento WhatsApp - ${phoneDigits || remoteJid || 'sem identificacao'}`;
    const ticket = await this.ensureOpenTicket({
      tenantId: event.tenantId,
      contactId: contact.id,
      channel: 'WHATSAPP',
      title,
      waitingReply: !isFromMe,
      occurredAt,
    });

    const existingMessage = event.externalMessageId
      ? await this.prisma.ticketMessage.findFirst({
          where: {
            externalId: event.externalMessageId,
          },
        })
      : null;

    if (existingMessage) {
      await this.prisma.ticketMessage.update({
        where: { id: existingMessage.id },
        data: {
          incomingEventId: existingMessage.incomingEventId || event.id,
          tenantId: existingMessage.tenantId || event.tenantId,
          contactId: existingMessage.contactId || contact.id,
          ticketId: existingMessage.ticketId || ticket.id,
          connectionId: existingMessage.connectionId || event.connectionId || null,
        },
      });

      return { ticketId: ticket.id, ticketMessageId: existingMessage.id, contactId: contact.id };
    }

    const { mimeType, fileName } = this.extractMediaDetails(realContent);
    const mediaBase64 = type !== 'TEXT' ? this.extractMediaBase64(message, rawPayload, realContent) : null;
    const mediaUrl = mediaBase64 ? this.saveInboundMedia(type, mediaBase64, mimeType, fileName) : null;
    const externalThreadId = canonicalJid || remoteJid || participantId;
    const externalParticipantId = phoneDigits || participantId || externalThreadId;
    const textContent = type === 'AUDIO' ? null : text;
    const aiAnalysis = this.buildInitialAiAnalysis(text || '', contentType);

    // 4. SYNC WITH NEW INBOX (AGENT SYSTEM)
    // We now additionally capture this in the Agent system to support the new UI
    let agentCaptureResult = null;
    try {
      agentCaptureResult = await (this as any).inboxService.captureExternalMessage({
         tenantId: event.tenantId,
         channel: 'WHATSAPP',
         contactId: contact.id,
         connectionId: event.connectionId || null,
         direction: isFromMe ? 'OUTBOUND' : 'INBOUND',
         role: isFromMe ? 'operator' : 'contact',
         content: text || '',
         contentType: type as any,
         externalMessageId: event.externalMessageId,
         externalThreadId: remoteJid,
         externalParticipantId: participantId,
         senderName: message.pushName || contact.name || null,
         senderAddress: participantId || remoteJid || null,
         senderPhone: phoneDigits,
         senderFullId: canonicalJid,
         senderLid: remoteJid?.includes('@lid') ? remoteJid : null,
         mediaUrl,
         metadata: {
           source: 'event-processor',
           fromMe: isFromMe,
         },
      });
    } catch (inboxError) {
      this.logger.error(`Falha ao capturar no Inbox (Novo Projeto): ${inboxError.message}`);
    }

    // 5. LEGACY TICKET MESSAGE (Old System)
    const createdMessage = await this.prisma.ticketMessage.create({
      data: {
        tenantId: event.tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        connectionId: event.connectionId || null,
        incomingEventId: event.id,
        externalId: event.externalMessageId || null,
        externalThreadId: externalThreadId || null,
        externalParticipantId: externalParticipantId || null,
        channel: 'WHATSAPP',
        direction: isFromMe ? 'OUTBOUND' : 'INBOUND',
        status: isFromMe ? 'SENT' : 'DELIVERED',
        senderType: isFromMe ? 'USER' : 'CONTACT',
        senderId: isFromMe ? null : contact.id,
        content: text || '',
        textContent,
        contentType,
        mediaUrl,
        quotedId,
        sentAt: isFromMe ? occurredAt : null,
        deliveredAt: !isFromMe ? occurredAt : null,
        aiAnalysis,
        transcriptionStatus: contentType === 'AUDIO' ? 'PENDING' : 'NOT_REQUIRED',
        metadata: {
          source: 'incoming-event-processor',
          rawEventId: event.id,
          connectionId: event.connectionId || null,
          remoteJid: externalThreadId,
          participantId: externalParticipantId,
          mimeType: mimeType || null,
          fileName: fileName || null,
          agentConversationId: agentCaptureResult?.conversation?.id || null,
          agentMessageId: agentCaptureResult?.message?.id || null,
        },
        createdAt: occurredAt,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        waitingReply: !isFromMe,
        lastMessageAt: occurredAt,
        updatedAt: occurredAt,
      },
    });

    if (contentType !== 'AUDIO') {
      const currentAnalysis = (createdMessage.aiAnalysis || aiAnalysis) as Record<string, any>;
      if (currentAnalysis?.flags?.comprovantePagamento) {
        const sugestoes = await this.financialService.sugerirBaixaPorComprovante(event.tenantId, contact.id);
        await this.prisma.ticketMessage.update({
          where: { id: createdMessage.id },
          data: {
            aiAnalysis: {
              ...currentAnalysis,
              financeiro: {
                status: sugestoes.length > 0 ? 'SUGESTAO_GERADA' : 'SEM_CANDIDATOS',
                candidatos: sugestoes,
              },
            },
          },
        });
      }
    }

    return { 
      ticketId: ticket.id, 
      ticketMessageId: createdMessage.id, 
      contactId: contact.id,
      agentConversationId: agentCaptureResult?.conversation?.id || null 
    };
  }

  private async processGenericInbound(event: any) {
    this.logger.log(`Processando Generic Inbound Event: ${event.id} (${event.channel})`);

    const payload = event.normalizedPayload as any;
    const rawPayload = event.payload as any;

    if (!payload) {
      throw new Error(`Dados normalizados ausentes para o evento ${event.id}`);
    }
    // 1. Resolver Contato (Lookup Multicanal Robusto)
    let contact = null;

    // A. Busca por Identity (O padrão mais forte: IDs específicos de cada canal)
    if (event.externalMessageId || event.sourceAddress) {
        const identity = await this.prisma.contactChannelIdentity.findFirst({
            where: {
                tenantId: event.tenantId,
                channel: event.channel,
                externalId: event.sourceAddress || undefined,
            },
            include: { contact: true }
        });
        if (identity?.contact) {
            contact = identity.contact;
        }
    }

    // B. Re-lookup por campos diretos (WhatsApp, Email, etc) se não achou identidade
    if (!contact) {
        contact = await this.prisma.contact.findFirst({
            where: {
                tenantId: event.tenantId,
                OR: [
                    { email: event.channel === 'EMAIL' ? event.sourceAddress : undefined },
                    { whatsappFullId: event.channel === 'WHATSAPP' ? event.sourceAddress : undefined },
                    { phone: event.externalPhone || undefined },
                ],
            },
        });
    }

    // C. Criação de LEAD se nada for encontrado
    if (!contact) {
      this.logger.log(`Criando contato para Inbound Bruto: ${event.channel}:${event.sourceAddress}`);
      contact = await this.prisma.contact.create({
        data: {
          tenantId: event.tenantId,
          name: payload.senderName || `Lead ${event.sourceAddress}`,
          personType: 'LEAD',
          email: event.channel === 'EMAIL' ? event.sourceAddress : undefined,
          phone: event.channel === 'PHONE' ? event.sourceAddress : event.externalPhone || undefined,
          whatsapp: event.channel === 'WHATSAPP' ? event.sourceAddress : undefined,
          whatsappFullId: event.channel === 'WHATSAPP' ? event.sourceAddress : undefined,
          category: 'LEAD',
        },
      });
    }

    // D. Registrar/Garantir Identity para futuras mensagens
    if (event.sourceAddress) {
        try {
            await this.prisma.contactChannelIdentity.upsert({
                where: {
                    tenantId_channel_externalId: {
                        tenantId: event.tenantId,
                        channel: event.channel,
                        externalId: event.sourceAddress
                    }
                },
                update: {},
                create: {
                    tenantId: event.tenantId,
                    contactId: contact.id,
                    channel: event.channel,
                    externalId: event.sourceAddress,
                    provider: rawPayload.metadata?.provider || 'GENERIC'
                }
            });
        } catch (e) {
            this.logger.debug(`Falha ao registrar identity (provavel corrida): ${e.message}`);
        }
    }

    // 2. Sincronizar com Novo Inbox (Agent System)
    const agentCapture = await this.inboxService.captureExternalMessage({
      tenantId: event.tenantId,
      channel: event.channel,
      contactId: contact.id,
      connectionId: event.connectionId,
      direction: 'INBOUND',
      role: 'contact',
      content: payload.content || '',
      contentType: payload.contentType || 'TEXT',
      externalThreadId: event.externalThreadId,
      externalMessageId: event.externalMessageId,
      externalParticipantId: event.externalParticipantId,
      senderName: payload.senderName || contact.name,
      senderAddress: event.sourceAddress,
      metadata: {
        ...rawPayload.metadata,
        capturedBy: 'event-processor',
        rawEventId: event.id,
      },
    });

    return {
      contactId: contact.id,
      agentConversationId: agentCapture.conversation.id,
      agentMessageId: agentCapture.message.id,
    };
  }
}
