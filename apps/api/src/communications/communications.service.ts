import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { IncomingCommunicationDto } from './dto/incoming-communication.dto';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

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

  async processIncoming(dto: IncomingCommunicationDto) {
    this.logger.log(`Capturando Inbound bruto channel=${dto.channel} from=${dto.from}`);

    const normalizedChannel = (dto.channel || '').trim().toUpperCase();
    const externalMessageId = dto.externalMessageId || null;

    // 1. DEDUPLICATION (IDEMPOTENCY)
    // Se temos um ID de mensagem externa, verificamos se já foi capturado para esta conexão
    if (externalMessageId && dto.connectionId) {
      const existing = await this.prisma.incomingEvent.findFirst({
        where: {
          connectionId: dto.connectionId,
          externalMessageId: externalMessageId,
        },
        select: { id: true }
      });

      if (existing) {
        this.logger.debug(`Mensagem externa ${externalMessageId} já capturada. Pulando.`);
        return { status: 'ALREADY_CAPTURED', id: existing.id };
      }
    }

    // 2. Persist Raw Incoming Event - UNIFED BRUTE CAPTURE
    await this.prisma.incomingEvent.create({
      data: {
        tenantId: dto.tenantId,
        connectionId: dto.connectionId || null,
        channel: normalizedChannel,
        provider: dto.metadata?.provider || 'GENERIC',
        eventType: 'inbound.message',
        direction: 'INBOUND',
        sourceAddress: dto.from,
        externalThreadId: dto.externalThreadId || dto.from,
        externalParticipantId: dto.from,
        externalMessageId: dto.externalMessageId || null,
        externalPhone: normalizedChannel === 'WHATSAPP' ? this.extractWhatsappDigits(dto.from) : null,
        payload: {
          ...dto,
          raw: true,
          capturedBy: 'CommunicationsService'
        },
        normalizedPayload: {
          content: dto.content,
          contentType: dto.contentType || 'TEXT',
          senderName: dto.name,
          senderAddress: dto.from,
          metadata: dto.metadata,
        },
        status: 'PENDING', // Will be treated by EventProcessorService
        receivedAt: new Date(),
      },
    });

    // 2. Backward Compatibility / Legacy Audit
    try {
      await this.prisma.communicationLog.create({
        data: {
          tenantId: dto.tenantId,
          channel: dto.channel,
          direction: 'INBOUND',
          content: dto.content,
          status: 'RECEIVED',
          processedBy: 'EVENT_PROCESSOR_PENDING'
        }
      });
    } catch (e) {
      this.logger.error(`Falha ao gravar CommunicationLog: ${e.message}`);
    }

    return {
      status: 'CAPTURED_BRUTE',
      channel: dto.channel,
      from: dto.from,
    };
  }
}
