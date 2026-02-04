import { Injectable } from '@nestjs/common';
<<<<<<< HEAD
import { PrismaService } from '@dr-x/database';
=======
import { PrismaService } from '@drx/database';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

@Injectable()
export class TriagemService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 3.2 Atendimento Proativo via IA e Onboarding
   */
  async handleIncomingMessage(phone: string, content: string, mediaUrl?: string) {
    // 1. Identifica o Contato
    let contact = await this.prisma.contact.findFirst({ where: { whatsapp: phone } });

    if (!contact) {
      // Fluxo de Novo Lead (Caso "Carlos")
      return {
        action: 'AI_HANDOFF',
        context: 'NEW_LEAD',
        reply: 'Olá, aqui é o Dr.X, inteligência jurídica. Não localizei seu contato. Para iniciarmos, poderia enviar seu CPF ou informar o número do processo?'
      };
    }

    // 2. Registra a Comunicação
    const log = await this.prisma.communicationLog.create({
      data: {
<<<<<<< HEAD
=======
        tenantId: contact.tenantId, // ID obrigatório do Tenant
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
        contactId: contact.id,
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        content,
        mediaUrl,
        status: 'RECEIVED',
      },
    });

    // 3. Verificação de Memória Contextual
    const lastInteraction = await this.prisma.communicationLog.findFirst({
        where: { contactId: contact.id, id: { not: log.id } },
        orderBy: { createdAt: 'desc' }
    });

    let aiContext = "Saudação Padrão";
    if (lastInteraction) {
       aiContext = `Cliente retornando. Último assunto: ${lastInteraction.content}`; 
    }

    return {
      action: 'NOTIFY_AGENT',
      logId: log.id,
      contact: contact.name,
      suggestion: aiContext
    };
  }

  /**
   * 3.1 Triagem de Mídia e Texto (Organização em 1 Clique)
   */
  async linkToProcess(messageId: string, processId: string) {
    const log = await this.prisma.communicationLog.findUnique({ where: { id: messageId } });
    if (!log) throw new Error('Message not found');

    const timelineEntry = await this.prisma.processTimeline.create({
      data: {
        processId,
        title: log.mediaUrl ? 'Nova Prova (Midia)' : 'Mensagem do Cliente',
        description: log.content,
        date: new Date(),
        type: log.mediaUrl ? 'FILE' : 'MESSAGE',
        metadata: { 
            originalLogId: log.id, 
            source: 'Dr.X Triagem',
            mediaUrl: log.mediaUrl 
        }
      }
    });

    // Marca como Triado
    await this.prisma.communicationLog.update({
      where: { id: messageId },
      data: { status: 'TRIAGED' }
    });

    return timelineEntry;
  }
}