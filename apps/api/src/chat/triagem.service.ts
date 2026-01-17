import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@dr-x/database';

@Injectable()
export class TriagemService {
  private prisma: PrismaClient;

  constructor(
      // In a real NestJS app these would be injected via constructor, but we're instantiating for the "scratchpad" mode
      // private financialService: FinancialService
  ) {
    this.prisma = new PrismaClient();
  }

  /**
   * 3.2 Atendimento Proativo via IA e Onboarding
   */
  async handleIncomingMessage(phone: string, content: string, mediaUrl?: string) {
    // 1. Identify Contact
    let contact = await this.prisma.contact.findFirst({ where: { whatsapp: phone } });

    if (!contact) {
      // New Lead Flow (Case "Carlos")
      // Logic: AI takes over, asks for CPF/DOC.
      // We return a flag for the frontend/bot engine to trigger AI mode.
      return {
        action: 'AI_HANDOFF',
        context: 'NEW_LEAD',
        reply: 'Olá, aqui é o Dr.X, inteligência jurídica. Não localizei seu contato. Para iniciarmos, poderia enviar seu CPF ou informar o número do processo?'
      };
    }

    // 2. Log Communication
    const log = await this.prisma.communicationLog.create({
      data: {
        contactId: contact.id,
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        content,
        mediaUrl,
        status: 'RECEIVED',
      },
    });

    // 3. Contextual Memory Check
    // "Após 45 dias, Carlos retorna..."
    const lastInteraction = await this.prisma.communicationLog.findFirst({
        where: { contactId: contact.id, id: { not: log.id } },
        orderBy: { createdAt: 'desc' }
    });

    let aiContext = "Saudação Padrão";
    if (lastInteraction) {
       // Simple RAG simulation
       aiContext = `Cliente retornando. Último assunto: ${lastInteraction.content}`; 
    }

    return {
      action: 'NOTIFY_AGENT',
      logId: log.id,
      contact: contact.name,
      suggestion: aiContext,
      // engagementScore: await this.financialService.calculateEngagementScore(contact.id) 
    };
  }

  /**
   * 3.1 Triagem de Mídia e Texto (Organização em 1 Clique)
   * Link a received message/file to a specific Process Timeline.
   */
  async linkToProcess(messageId: string, processId: string) {
    const log = await this.prisma.communicationLog.findUnique({ where: { id: messageId } });
    if (!log) throw new Error('Message not found');

    // Inject into Process Timeline (The "Xavier" Timeline)
    const timelineEntry = await this.prisma.processTimeline.create({
      data: {
        processId,
        title: log.mediaUrl ? 'Nova Prova (Midia)' : 'Mensagem do Cliente',
        description: log.content,
        date: new Date(), // Timeline sorts by this
        type: log.mediaUrl ? 'FILE' : 'MESSAGE',
        metadata: { 
            originalLogId: log.id, 
            source: 'Dr.X Triagem',
            mediaUrl: log.mediaUrl 
        }
      }
    });

    // Mark as Triaged
    await this.prisma.communicationLog.update({
      where: { id: messageId },
      data: { status: 'TRIAGED' }
    });

    return timelineEntry;
  }
}
