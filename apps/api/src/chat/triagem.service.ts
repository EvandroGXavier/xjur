import { Injectable } from '@nestjs/common';
import { PrismaService } from '@drx/database';

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

    // 2. Registra o Ticket e a Mensagem
    // Procura por um ticket ABERTO ou EM ANDAMENTO
    let ticket = await this.prisma.ticket.findFirst({
      where: {
        contactId: contact.id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Se não existir, cria um novo
    if (!ticket) {
      ticket = await this.prisma.ticket.create({
        data: {
          tenantId: contact.tenantId,
          contactId: contact.id,
          title: 'Atendimento via WhatsApp',
          status: 'OPEN',
          priority: 'MEDIUM',
          channel: 'WHATSAPP' // Deduzido do método
        }
      });
    }

    // Cria a mensagem no ticket
    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'CONTACT',
        senderId: contact.id,
        content,
        contentType: mediaUrl ? 'FILE' : 'TEXT', // Simplificação
        mediaUrl,
        readAt: null // Não lido ainda
      }
    });

    // 3. Verificação de Memória Contextual
    // Busca última mensagem do cliente neste ticket (exceto a atual)
    const lastInteraction = await this.prisma.ticketMessage.findFirst({
        where: { 
            ticketId: ticket.id, 
            id: { not: message.id },
            senderType: 'CONTACT'
        },
        orderBy: { createdAt: 'desc' }
    });

    let aiContext = "Saudação Padrão";
    if (lastInteraction) {
       aiContext = `Cliente retornando no mesmo ticket. Último assunto: ${lastInteraction.content}`; 
    }

    return {
      action: 'NOTIFY_AGENT',
      logId: message.id, // ID da mensagem agora
      ticketId: ticket.id,
      contact: contact.name,
      suggestion: aiContext
    };
  }

  /**
   * 3.1 Triagem de Mídia e Texto (Organização em 1 Clique)
   */
  async linkToProcess(messageId: string, processId: string) {
    const message = await this.prisma.ticketMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new Error('Message not found');

    const timelineEntry = await this.prisma.processTimeline.create({
      data: {
        processId,
        title: message.mediaUrl ? 'Nova Prova (Midia)' : 'Mensagem do Cliente',
        description: message.content,
        date: new Date(),
        type: message.mediaUrl ? 'FILE' : 'MESSAGE',
        metadata: { 
            originalMessageId: message.id, 
            ticketId: message.ticketId,
            source: 'Dr.X Triagem',
            mediaUrl: message.mediaUrl 
        }
      }
    });

    // Marca mensagem como Lida/Processada se necessário
    // E update status do Ticket se for o caso (opcional)
    await this.prisma.ticketMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() }
    });
    
    // Opcional: Atualizar status do Ticket para IN_PROGRESS
    await this.prisma.ticket.update({
        where: { id: message.ticketId },
        data: { status: 'IN_PROGRESS' }
    });

    return timelineEntry;
  }
}
