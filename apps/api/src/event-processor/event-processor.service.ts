import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import { FinancialService } from '../financial/financial.service';
import { InboxService } from '../inbox/inbox.service';
import { EvolutionConfig, EvolutionService } from '../evolution/evolution.service';
import {
  construirContatosAdicionaisPorCanal,
  construirValoresBuscaIdentificadores,
  normalizarDigitosDDI,
} from '../common/contact-identifiers';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialService: FinancialService,
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
    private readonly evolutionService: EvolutionService,
    private readonly configService: ConfigService,
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
      return normalizarDigitosDDI(normalized.split('@')[0]);
    }
    return normalizarDigitosDDI(normalized);
  }

  private isPlausibleWhatsappNumber(value?: string | null) {
    if (typeof value !== 'string') return false;
    const digits = value.replace(/\D/g, '');
    
    // Regra Dr.X: Telefones brasileiros válidos (ou identificadores canônicos conhecidos)
    // 10-11: DDD + Numero (sem DDI)
    // 12-13: DDI 55 + DDD + Numero
    // Outros valores entre 10-15 podem ser LIDs americanos ou IDs técnicos
    // que não devem ser usados como 'Telefone' para criar contatos sem resolução prévia.
    const isBrazilPattern = digits.length >= 10 && digits.length <= 13 && (digits.length <= 11 || digits.startsWith('55'));
    const isGenericInternational = digits.length >= 10 && digits.length <= 15;
    
    return isBrazilPattern || isGenericInternational;
  }

  private async getEvolutionConfig(connectionId: string): Promise<EvolutionConfig | undefined> {
    try {
      const connection = await this.prisma.connection.findUnique({
        where: { id: connectionId },
        select: { config: true },
      });

      const config = connection?.config as any || {};
      const settings = config.evolutionSettings || {};
      if (config.evolutionVersion) {
        settings.whatsappVersion = config.evolutionVersion;
      }

      return {
        apiUrl: config.evolutionUrl || this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080',
        apiKey: config.evolutionApiKey || this.configService.get<string>('EVOLUTION_API_KEY') || '',
        settings,
      };
    } catch (error: any) {
      this.logger.debug(`Falha ao carregar config Evolution da conexao ${connectionId}: ${error?.message || error}`);
      return undefined;
    }
  }

  private extractPossibleWhatsappNumbers(candidate: any): string[] {
    const values = [
      candidate?.remoteJid,
      candidate?.jid,
      candidate?.id,
      candidate?.remoteJidAlt,
      candidate?.participant,
      candidate?.owner,
      candidate?.user,
      candidate?.number,
      candidate?.phone,
      candidate?.mobile,
      candidate?.contact?.phone,
      candidate?.contact?.number,
      candidate?.contact?.jid,
      candidate?.contact?.remoteJid,
      candidate?.participantPn,
      candidate?.senderPn,
    ].filter(Boolean);

    return Array.from(
      new Set(
        values
          .map((value) => this.extractWhatsappDigits(String(value)))
          .filter((value) => this.isPlausibleWhatsappNumber(value)),
      ),
    );
  }

  private async resolveWhatsappPhoneByLid(
    connectionId?: string | null,
    identities?: Array<string | null | undefined>,
    tenantId?: string | null,
  ) {
    const lidIds = Array.from(
      new Set(
        (identities || [])
          .map((value) => this.normalizeWhatsappIdentity(value))
          .filter((value): value is string => Boolean(value && value.endsWith('@lid'))),
      ),
    );

    if (lidIds.length === 0) {
      return null;
    }

    // 1. Tentar resolver via Evolution API (Cache das instâncias do Tenant)
    // Buscamos em TODAS as conexões conectadas do tenant, pois um contato pode estar
    // no cache de uma conexão (ex: Linha Principal) mas não de outra (ex: Linha Campanha).
    const connections = tenantId 
      ? await this.prisma.connection.findMany({ 
          where: { tenantId, type: 'WHATSAPP', status: 'CONNECTED' },
          select: { id: true, config: true }
        })
      : connectionId 
        ? [await this.prisma.connection.findUnique({ where: { id: connectionId } })]
        : [];

    for (const conn of connections) {
      if (!conn?.id) continue;
      try {
        const evolutionConfig = await this.getEvolutionConfig(conn.id);
        if (!evolutionConfig) continue;

        const contactsData = await this.evolutionService.findContacts(conn.id, evolutionConfig);
        const contactsList = Array.isArray(contactsData)
          ? contactsData
          : Array.isArray((contactsData as any)?.contacts)
            ? (contactsData as any).contacts
            : Array.isArray((contactsData as any)?.data)
              ? (contactsData as any).data
              : [];

        for (const candidate of contactsList) {
          const candidateIds = [
            candidate?.remoteJid,
            candidate?.jid,
            candidate?.id,
            candidate?.remoteJidAlt,
            candidate?.participant,
            candidate?.participantPn,
            candidate?.senderPn,
          ]
            .map((value) => this.normalizeWhatsappIdentity(value))
            .filter((value): value is string => Boolean(value));

          if (!candidateIds.some((value) => lidIds.includes(value))) {
            continue;
          }

          const numbers = this.extractPossibleWhatsappNumbers(candidate);
          if (numbers.length > 0) {
            this.logger.log(
              `LID ${lidIds.join(', ')} resolvido para o número ${numbers[0]} via conexão ${conn.id}`,
            );
            return numbers[0];
          }
        }
      } catch (error: any) {
        this.logger.debug(`Falha ao carregar contatos da conexao ${conn.id}: ${error?.message}`);
      }
    }

    // 2. Fallback via contactChannelIdentity (índice único — mais confiável que notas)
    if (tenantId) {
      try {
        const identityMatch = await this.prisma.contactChannelIdentity.findFirst({
          where: {
            tenantId,
            channel: 'WHATSAPP',
            externalId: { in: lidIds },
          },
          include: {
            contact: {
              include: { additionalContacts: { select: { type: true, value: true } } },
            },
          },
        });

        const matchedContact = identityMatch?.contact;
        if (matchedContact) {
          const phone =
            matchedContact.whatsapp ||
            this.extractWhatsappDigits(
              matchedContact.whatsappFullId?.includes('@lid') ? undefined : matchedContact.whatsappFullId,
            ) ||
            this.extractWhatsappDigits(
              matchedContact.additionalContacts?.find(
                (ac) => ac.type === 'WHATSAPP' || ac.type === 'WHATSAPP_JID',
              )?.value,
            );
          if (phone) {
            this.logger.log(`LID resolvido via contactChannelIdentity: ${lidIds[0]} → ${phone} (${matchedContact.name})`);
            return phone;
          }
        }
      } catch (error: any) {
        this.logger.debug(`Falha ao resolver LID via contactChannelIdentity ${lidIds.join(', ')}: ${error?.message || error}`);
      }
    }

    // 3. Fallback via additionalContacts (sem busca frágil em notas)
    if (tenantId) {
      try {
        const contactWithLid = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            additionalContacts: { some: { value: { in: lidIds } } },
          },
          include: {
            additionalContacts: { select: { type: true, value: true } },
          },
        });

        if (contactWithLid) {
          const phone =
            contactWithLid.whatsapp ||
            this.extractWhatsappDigits(
              contactWithLid.whatsappFullId?.includes('@lid') ? undefined : contactWithLid.whatsappFullId,
            ) ||
            this.extractWhatsappDigits(
              contactWithLid.additionalContacts?.find(
                (ac) => ac.type === 'WHATSAPP' || ac.type === 'WHATSAPP_JID',
              )?.value,
            );
          if (phone) {
            this.logger.log(`LID resolvido via additionalContacts: ${lidIds[0]} → ${phone} (${contactWithLid.name})`);
            return phone;
          }
        }
      } catch (error: any) {
        this.logger.debug(`Falha ao resolver LID via additionalContacts ${lidIds.join(', ')}: ${error?.message || error}`);
      }
    }

    return null;
  }


  private async ensureAdditionalContactIdentifiers(params: {
    contactId: string;
    channel: string;
    tenantId?: string;
    identifiers: (string | null | undefined)[];
    provider?: string | null;
  }) {
    const channel = params.channel?.toUpperCase() || 'WHATSAPP';
    const items = construirContatosAdicionaisPorCanal(channel, params.identifiers);
    if (items.length === 0) return;

    // 1. Tabela Global de Identidades (Com Detecção de Colisão para Auto-Merge)
    if (params.tenantId) {
        for (const extId of items) {
            try {
                // Verificar se esta identidade pertence a OUTRO contato
                const existingIdentity = await this.prisma.contactChannelIdentity.findFirst({
                    where: {
                        tenantId: params.tenantId,
                        channel,
                        externalId: extId.value
                    }
                });

                if (existingIdentity && existingIdentity.contactId !== params.contactId) {
                    this.logger.log(`Colisão de identidade detectada: ${extId.value} pertence a ${existingIdentity.contactId}. Unificando para ${params.contactId}`);
                    
                    // Dispara o rebind (move conversas, etc)
                    await this.rebindWhatsappDuplicateContact({
                        tenantId: params.tenantId,
                        sourceContactId: existingIdentity.contactId,
                        targetContactId: params.contactId
                    });
                }

                await this.prisma.contactChannelIdentity.upsert({
                    where: {
                        tenantId_channel_externalId: {
                            tenantId: params.tenantId,
                            channel,
                            externalId: extId.value
                        }
                    },
                    update: { updatedAt: new Date(), contactId: params.contactId },
                    create: {
                        tenantId: params.tenantId,
                        contactId: params.contactId,
                        channel,
                        provider: params.provider || null,
                        externalId: extId.value
                    }
                });
            } catch (e) {
                this.logger.error(`Erro ao sincronizar identidade ${extId.value}: ${e.message}`);
            }
        }
        
        // Atualiza whatsappFullId apenas com JID de telefone (nunca com LID)
        const priorityId = items.find(i => i.value.includes('@s.whatsapp.net'))?.value;
        if (channel === 'WHATSAPP' && priorityId) {
             await this.prisma.contact.update({
                where: { id: params.contactId },
                data: { whatsappFullId: priorityId }
            });
        }
    }


    // 2. Contatos Adicionais (UI)
    const existing = await this.prisma.additionalContact.findMany({
      where: {
        contactId: params.contactId,
        value: { in: items.map((item) => item.value) },
      },
      select: { value: true },
    });

    const existingValues = new Set(existing.map((item) => item.value));
    const toCreate = items.filter((item) => !existingValues.has(item.value));
    if (toCreate.length === 0) return;

    await this.prisma.additionalContact.createMany({
      data: toCreate.map((item) => ({
        contactId: params.contactId,
        type: item.type,
        value: item.value,
        nomeContatoAdicional: item.nomeContatoAdicional,
      })),
    });
  }


  private async rebindWhatsappDuplicateContact(params: {
    tenantId: string;
    sourceContactId: string;
    targetContactId: string;
  }) {
    if (
      !params.sourceContactId ||
      !params.targetContactId ||
      params.sourceContactId === params.targetContactId
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.additionalContact.updateMany({
        where: { contactId: params.sourceContactId },
        data: { contactId: params.targetContactId },
      });

      await tx.agentConversation.updateMany({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          contactId: params.sourceContactId,
        },
        data: { contactId: params.targetContactId },
      });

      await tx.ticket.updateMany({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          contactId: params.sourceContactId,
        },
        data: { contactId: params.targetContactId },
      });

      await tx.ticketMessage.updateMany({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          contactId: params.sourceContactId,
        },
        data: { contactId: params.targetContactId },
      });

      await tx.incomingEvent.updateMany({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          contactId: params.sourceContactId,
        },
        data: { contactId: params.targetContactId },
      });

      await tx.contactChannelIdentity.updateMany({
        where: {
          tenantId: params.tenantId,
          contactId: params.sourceContactId,
        },
        data: { contactId: params.targetContactId },
      });


      const source = await tx.contact.findUnique({
        where: { id: params.sourceContactId },
        select: { notes: true },
      });

      await tx.contact.update({
        where: { id: params.sourceContactId },
        data: {
          whatsapp: null,
          whatsappE164: null,
          whatsappFullId: null,
          notes: [source?.notes, `Contato WhatsApp consolidado em ${params.targetContactId}.`]
            .filter(Boolean)
            .join('\n'),
        },
      });
    });
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
    resolvedPhoneDigits?: string | null;
    canonicalJidHint?: string | null;
    additionalIdentities?: Array<string | null | undefined>;
    /** Fallback contact ID from an existing conversation — used when the LID cannot be
     *  resolved to a phone and is not yet stored in additionalContacts. */
    preferredContactId?: string | null;
  }) {
    const identities = Array.from(
      new Set(
        [
          params.remoteJid,
          params.participantId,
          params.canonicalJidHint,
          ...(params.additionalIdentities || []),
        ]
          .map((value) => this.normalizeWhatsappIdentity(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let phoneDigits =
      (this.isPlausibleWhatsappNumber(params.resolvedPhoneDigits)
        ? params.resolvedPhoneDigits
        : null) ||
      identities
        .map((value) => this.extractWhatsappDigits(value))
        .find((value) => this.isPlausibleWhatsappNumber(value)) ||
      null;

    // Normalização Brasil: Garante que números de 11 dígitos (DDD + 9 + Número) sejam salvos com 55
    if (phoneDigits && phoneDigits.length === 11 && !phoneDigits.startsWith('55')) {
      phoneDigits = '55' + phoneDigits;
    }

    const canonicalJid = params.canonicalJidHint || (phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null);
    const rawLookupValues = construirValoresBuscaIdentificadores('WHATSAPP', [
      ...identities,
      canonicalJid,
      phoneDigits,
    ]);
    
    // Expansão Brasil: Inclui variantes com/sem 55 para garantir unificação de contatos manuais
    const lookupValues = Array.from(new Set(rawLookupValues));
    for (const val of rawLookupValues) {
      if (/^\d{10,15}$/.test(val)) {
        if (val.length === 11 && !val.startsWith('55')) lookupValues.push('55' + val);
        else if (val.length === 13 && val.startsWith('55')) lookupValues.push(val.substring(2));
      }
    }

    let contact = null as any;

    if (lookupValues.length > 0) {
      // 1. Tenta buscar via identidades registradas (novo fluxo unificado de aliases)
      const channelIdentities = await this.prisma.contactChannelIdentity.findMany({
        where: {
          tenantId: params.tenantId,
          channel: 'WHATSAPP',
          externalId: { in: lookupValues },
        },
        select: { contactId: true },
      });

      const foundIds = channelIdentities.map((ci) => ci.contactId);

      const matchedContacts = await this.prisma.contact.findMany({
        where: {
          tenantId: params.tenantId,
          OR: [
            { id: { in: foundIds } },
            { whatsapp: { in: lookupValues } },
            { whatsappE164: { in: lookupValues } },
            { whatsappFullId: { in: lookupValues } },
            {
              additionalContacts: {
                some: {
                  value: { in: lookupValues },
                },
              },
            },
          ],
        },
        include: {
          additionalContacts: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
      });

      if (matchedContacts.length > 0) {
        contact = matchedContacts[0];

        for (const duplicateContact of matchedContacts.slice(1)) {
          if (duplicateContact.id === contact.id) continue;
          this.logger.warn(
            `Contato WhatsApp duplicado detectado para ${phoneDigits || canonicalJid || identities.join(', ')}: ` +
            `mantendo ${contact.id} e rebinding ${duplicateContact.id}.`,
          );
          await this.rebindWhatsappDuplicateContact({
            tenantId: params.tenantId,
            sourceContactId: duplicateContact.id,
            targetContactId: contact.id,
          });
        }
      }
    }

    // Fallback: when LID cannot be resolved to a phone number and is not yet stored in
    // additionalContacts, use the preferred contact found via an existing conversation.
    // This prevents creating a duplicate contact on the first inbound reply.
    if (!contact && params.preferredContactId) {
      const preferred = await this.prisma.contact.findFirst({
        where: { id: params.preferredContactId, tenantId: params.tenantId },
        include: { additionalContacts: true },
      });
      if (preferred) {
        contact = preferred;
        this.logger.log(
          `Contato WhatsApp resolvido via conversa existente: ` +
          `${identities.join(', ')} -> ${preferred.name} (${preferred.id})`,
        );
      }
    }

    // Fallback: resolution by Name if everything else failed
    if (!contact && params.pushName && params.pushName.length > 2) {
      const byName = await this.prisma.contact.findFirst({
        where: {
          tenantId: params.tenantId,
          name: params.pushName.trim(),
        },
        include: { additionalContacts: true },
      });
      if (byName) {
        contact = byName;
        this.logger.log(
          `Contato WhatsApp resolvido via Name Fallback: ${params.pushName} -> ${contact.id}`,
        );
      }
    }

    const displayName = params.pushName?.trim() || phoneDigits || 'WhatsApp Contact';

    if (!contact) {
      // Quando não há dígitos de telefone, não é possível identificar o contato de forma
      // confiável — retorna sem criar para permitir associação manual pelo operador.
      if (!phoneDigits) {
        return { contact: null, phoneDigits, canonicalJid, unresolved: true };
      }
      contact = await this.prisma.contact.create({
        data: {
          tenantId: params.tenantId,
          name: displayName,
          whatsapp: phoneDigits,
          whatsappE164: phoneDigits,
          whatsappFullId: canonicalJid,
          category: 'Lead',
          notes: `Criado automaticamente pelo processador de eventos. ${identities.join(' | ')}`,
        },
      });
    } else {
      const updateData: Record<string, any> = {};
      if (displayName && (!contact.name || contact.name === 'WhatsApp Contact')) {
        updateData.name = displayName;
      }
      
      // Auto-popular campos se estiverem vazios e tivermos os dados agora
      if (phoneDigits && !contact.whatsapp) updateData.whatsapp = phoneDigits;
      if (phoneDigits && !contact.whatsappE164) updateData.whatsappE164 = phoneDigits;
      if (canonicalJid && !contact.whatsappFullId) updateData.whatsappFullId = canonicalJid;

      if (Object.keys(updateData).length > 0) {
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: updateData,
        });
      }
    }

    await this.ensureAdditionalContactIdentifiers({
      contactId: contact.id,
      tenantId: params.tenantId,
      channel: 'WHATSAPP',
      identifiers: [...identities, canonicalJid, phoneDigits],
    });

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

    const identities = [remoteJid, participantId, event.externalLid].filter(Boolean) as string[];

    const resolvedPhoneFromLid = await this.resolveWhatsappPhoneByLid(
      event.connectionId,
      identities.filter((id) => id.includes('@lid')),
      event.tenantId,
    );

    const resolvedPhoneDigits =
      event.externalPhone ||
      this.extractWhatsappDigits(participantId) ||
      this.extractWhatsappDigits(remoteJid) ||
      resolvedPhoneFromLid;

    const canonicalJid = resolvedPhoneDigits ? `${resolvedPhoneDigits}@s.whatsapp.net` : null;
    const canonicalThreadId = canonicalJid || remoteJid || participantId;
    const canonicalParticipantId = resolvedPhoneDigits || participantId || canonicalThreadId;

    const { type, text, quotedId, contentType } = this.buildWhatsappContent(realContent);

    // Contextual Contact Resolution: If this is a reply to a message sent from Dr.X,
    // we can identify the contact even if WhatsApp uses a different JID/LID.
    let preferredContactIdByContext: string | null = null;
    if (quotedId) {
      // Try finding the original message in both Agent (New Inbox) and Ticket (Legacy) systems
      const originalMessage = await this.prisma.agentMessage.findFirst({
        where: { tenantId: event.tenantId, externalMessageId: quotedId },
        select: { conversation: { select: { contactId: true } } }
      }) || await this.prisma.ticketMessage.findFirst({
        where: { tenantId: event.tenantId, externalId: quotedId },
        select: { contactId: true }
      });

      if ((originalMessage as any)?.conversation?.contactId || (originalMessage as any)?.contactId) {
        preferredContactIdByContext = (originalMessage as any)?.conversation?.contactId || (originalMessage as any)?.contactId;
        this.logger.log(`Mensagem de resposta identificada via quotedId ${quotedId} -> Contato ${preferredContactIdByContext}`);
      }
    }

    // Fallback: Se não houve resposta formal (quotedId), mas recebemos mensagem de um novo JID
    // logo após um disparo ativo para aquele tenant, podemos estar diante do mesmo fluxo.
    if (!preferredContactIdByContext && !resolvedPhoneDigits) {
       // Opcional: Implementar busca por janelas de tempo se necessário.
    }

    // When the LID cannot be resolved to a phone number, attempt to find the correct
    // contact through an existing AgentConversation on the same connection.
    // This prevents creating a duplicate contact when the first inbound reply arrives
    // with only a LID identifier that hasn't been stored in additionalContacts yet.
    let preferredContactId: string | null = preferredContactIdByContext;
    if (!preferredContactId && !resolvedPhoneDigits) {
      const lidJids = [remoteJid, participantId, event.externalLid]
        .filter((v): v is string => Boolean(v && v.includes('@lid')))
        .map((v) => this.normalizeWhatsappIdentity(v)!)
        .filter(Boolean);

      if (lidJids.length > 0) {
        // Primeiro tenta via conversas recentes
        const existingConvForLid = await this.prisma.agentConversation.findFirst({
          where: {
            tenantId: event.tenantId,
            contactId: { not: null },
            status: { notIn: ['CLOSED', 'ARCHIVED'] },
            OR: [
              { externalThreadId: { in: lidJids } },
              { externalParticipantId: { in: lidJids } },
            ],
          },
          select: { contactId: true },
          orderBy: { updatedAt: 'desc' },
        });

        if (existingConvForLid?.contactId) {
          preferredContactId = existingConvForLid.contactId;
          this.logger.log(
            `LID ${lidJids.join(', ')} mapeado ao contato existente via conversa: ${preferredContactId}`,
          );
        } else {
          // Se não achou conversa, tenta via identidades registradas (AdditionalContact) —
          // busca somente por value (sem filtro de type) pois LIDs são type='WHATSAPP_LID'
          const registeredLid = await this.prisma.additionalContact.findFirst({
            where: {
              contact: { tenantId: event.tenantId },
              value: { in: lidJids },
            },
            select: { contactId: true },
          });

          if (registeredLid?.contactId) {
            preferredContactId = registeredLid.contactId;
            this.logger.log(
              `LID ${lidJids.join(', ')} mapeado ao contato existente via AdditionalContact: ${preferredContactId}`,
            );
          }
        }
      }
    }

    const { contact, unresolved, phoneDigits, canonicalJid: resolvedCanonicalJid } = await this.findOrCreateWhatsappContact({
      tenantId: event.tenantId,
      remoteJid,
      participantId,
      pushName: message.pushName || null,
      resolvedPhoneDigits,
      canonicalJidHint: canonicalJid,
      additionalIdentities: identities,
      preferredContactId: preferredContactIdByContext || preferredContactId,
    });

    const occurredAt = new Date(
      message.messageTimestamp ? Number(message.messageTimestamp) * 1000 : event.receivedAt || Date.now(),
    );
    const isFromMe = Boolean(message.key.fromMe);

    // Contato não resolvido (LID sem telefone, sem correspondência em DB) →
    // captura a conversa sem contato para associação manual pelo operador.
    if (unresolved || !contact) {
      const { mimeType, fileName } = this.extractMediaDetails(realContent);
      const mediaBase64 = type !== 'TEXT' ? this.extractMediaBase64(message, rawPayload, realContent) : null;
      const mediaUrl = mediaBase64 ? this.saveInboundMedia(type, mediaBase64, mimeType, fileName) : null;
      const externalThreadId = canonicalJid || canonicalThreadId;
      const rawLid = ([remoteJid, participantId, event.externalLid] as Array<string | null | undefined>)
        .find((v) => typeof v === 'string' && v.includes('@lid')) || null;

      let agentCaptureResult: any = null;
      try {
        agentCaptureResult = await (this as any).inboxService.captureExternalMessage({
          tenantId: event.tenantId,
          channel: 'WHATSAPP',
          contactId: null,
          connectionId: event.connectionId || null,
          direction: isFromMe ? 'OUTBOUND' : 'INBOUND',
          role: isFromMe ? 'operator' : 'contact',
          content: text || '',
          contentType: type as any,
          externalMessageId: event.externalMessageId,
          externalThreadId,
          externalParticipantId: canonicalParticipantId,
          senderName: message.pushName || null,
          senderAddress: canonicalParticipantId || externalThreadId || null,
          senderPhone: null,
          senderFullId: null,
          senderLid: rawLid,
          mediaUrl,
          title: message.pushName || externalThreadId || 'Contato não identificado',
          metadata: {
            unresolved: true,
            rawRemoteJid: remoteJid || null,
            rawParticipantId: participantId || null,
            rawLid,
            pushName: message.pushName || null,
            source: 'event-processor',
            fromMe: isFromMe,
          },
          createdAt: occurredAt,
        });
        this.logger.log(
          `Mensagem WhatsApp capturada sem contato (identidade não resolvida): ` +
          `remoteJid=${remoteJid} → conversa=${agentCaptureResult?.conversation?.id || 'nova'}`,
        );
      } catch (inboxError: any) {
        this.logger.error(`Falha ao capturar mensagem sem contato no Inbox: ${inboxError?.message}`);
      }

      return {
        ticketId: null,
        ticketMessageId: null,
        contactId: null,
        agentConversationId: agentCaptureResult?.conversation?.id || null,
      };
    }

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
    const externalThreadId = canonicalJid || canonicalThreadId;
    const externalParticipantId = phoneDigits || canonicalParticipantId;
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
         externalThreadId,
         externalParticipantId,
         senderName: message.pushName || contact.name || null,
         senderAddress: externalParticipantId || externalThreadId || null,
         senderPhone: phoneDigits,
         senderFullId: canonicalJid,
         senderLid: [remoteJid, participantId].find((value) => value?.includes('@lid')) || null,
         mediaUrl,
         metadata: {
           source: 'event-processor',
           fromMe: isFromMe,
            remoteJid: remoteJid || null,
            participantId: participantId || null,
           resolvedPhone: phoneDigits || resolvedPhoneDigits || null,
           canonicalThreadId: externalThreadId || null,
         },
      });
    } catch (inboxError) {
      this.logger.error(`Falha ao capturar no Inbox (Novo Projeto): ${inboxError.message}`);
    }

    // 5. LEGACY TICKET MESSAGE (Old System)
    let createdMessage: any = null;
    try {
        createdMessage = await this.prisma.ticketMessage.create({
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
    } catch (msgError) {
        this.logger.debug(`Falha ao criar TicketMessage (provavelmente duplicada): ${msgError.message}`);
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        waitingReply: !isFromMe,
        lastMessageAt: occurredAt,
        updatedAt: occurredAt,
      },
    });

    if (contentType !== 'AUDIO' && createdMessage) {
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
      ticketId: ticket?.id || null, 
      ticketMessageId: createdMessage?.id || null, 
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
    const lookupValues = construirValoresBuscaIdentificadores(event.channel, [
      event.sourceAddress,
      event.externalParticipantId,
      event.externalThreadId,
      event.externalPhone,
      event.externalFullId,
      event.externalLid,
    ]);

    // A. Busca por additionalContacts (fonte primária de identificadores)
    if (lookupValues.length > 0) {
      contact = await this.prisma.contact.findFirst({
        where: {
          tenantId: event.tenantId,
          OR: [
            { whatsapp: { in: lookupValues } },
            { whatsappE164: { in: lookupValues } },
            { whatsappFullId: { in: lookupValues } },
            {
              additionalContacts: {
                some: {
                  value: { in: lookupValues },
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    // C. Criação de LEAD se nada for encontrado
    if (!contact) {
      this.logger.log(`Criando contato para Inbound Bruto: ${event.channel}:${event.sourceAddress}`);
      const cleanPhone = event.externalPhone || (event.channel === 'WHATSAPP' ? this.extractWhatsappDigits(event.sourceAddress) : null);
      
      contact = await this.prisma.contact.create({
        data: {
          tenantId: event.tenantId,
          name: payload.senderName || (cleanPhone ? cleanPhone : `Lead ${event.sourceAddress}`),
          whatsapp: cleanPhone || undefined,
          whatsappE164: cleanPhone || undefined,
          whatsappFullId: event.externalFullId || undefined,
          personType: 'LEAD',
          category: 'LEAD',
          notes: `Criado automaticamente por Inbound Bruto. Channel: ${event.channel}. Address: ${event.sourceAddress}.`,
        },
      });
    }

    await this.ensureAdditionalContactIdentifiers({
      contactId: contact.id,
      tenantId: event.tenantId,
      channel: event.channel,
      identifiers: lookupValues,
    });

    // 2. Sincronizar com Novo Inbox (Agent System)
    const agentCapture = await this.inboxService.captureExternalMessage({
      tenantId: event.tenantId,
      channel: event.channel,
      contactId: contact?.id || null,
      connectionId: event.connectionId,
      direction: 'INBOUND',
      role: 'contact',
      content: payload.content || '',
      contentType: payload.contentType || 'TEXT',
      externalThreadId: event.externalThreadId,
      externalMessageId: event.externalMessageId,
      externalParticipantId: event.externalParticipantId,
      senderName: payload.senderName || contact?.name || 'WhatsApp Contact',
      senderAddress: event.sourceAddress,
      senderPhone: payload.senderPhone || null,
      senderFullId: payload.senderFullId || null,
      senderLid: payload.senderLid || null,
      metadata: {
        ...rawPayload.metadata,
        capturedBy: 'event-processor',
        rawEventId: event.id,
        provider: rawPayload.metadata?.provider || 'GENERIC',
      },
    });

    return {
      contactId: contact?.id || null,
      agentConversationId: agentCapture?.conversation?.id || null,
      agentMessageId: agentCapture?.message?.id || null,
    };
  }
}
