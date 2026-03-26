import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TriagemService {
  private readonly logger = new Logger(TriagemService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Realiza a triagem inicial de uma mensagem recebida.
   * Identifica se é um novo lead ou cliente existente e sugere uma ação.
   */
  async triageMessage(tenantId: string, phone: string, content: string, mediaUrl?: string) {
    // 1. Identifica o Contato
    let contact = await this.prisma.contact.findFirst({ 
      where: { 
        tenantId,
        OR: [
          { whatsapp: phone },
          { phone: phone }
        ]
      } 
    });

    if (!contact) {
      return {
        action: 'ONBOARDING',
        category: 'NEW_LEAD',
        reply: 'Olá! Sou o Dr.X, assistente jurídico inteligente. Não encontrei seu cadastro no nosso sistema. Para começarmos, você já é nosso cliente ou deseja iniciar uma nova consulta?',
        shouldHandoff: true
      };
    }

    // 2. Busca conversas ou processos ativos
    const activeConversation = await this.prisma.agentConversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: { not: 'CLOSED' }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const processCount = await this.prisma.process.count({
      where: {
        tenantId,
        processParties: {
          some: { contactId: contact.id }
        }
      }
    });

    let suggestion = "Atendimento padrão.";
    let category = "SUPPORTE";

    if (processCount > 0) {
      suggestion = `Cliente possui ${processCount} processo(s) vinculado(s). Provável dúvida sobre andamento.`;
      category = "PROCESSO";
    }

    if (activeConversation?.processId) {
      const process = await this.prisma.process.findUnique({
        where: { id: activeConversation.processId }
      });
      suggestion = `Conversa vinculada ao processo ${process?.cnj || process?.code}. Alinhando contexto.`;
    }

    return {
      action: 'CONTINUE',
      category,
      contact: {
        id: contact.id,
        name: contact.name,
      },
      suggestion,
      shouldHandoff: false
    };
  }

  /**
   * Vincula uma mensagem a um processo, criando uma entrada na timeline.
   */
  async linkToProcess(tenantId: string, messageId: string, processId: string) {
    const message = await this.prisma.agentMessage.findFirst({ 
      where: { id: messageId, tenantId } 
    });
    if (!message) throw new Error('Mensagem não encontrada');

    const timelineEntry = await this.prisma.processTimeline.create({
      data: {
        processId,
        title: message.mediaUrl ? 'Mídia recebida via WhatsApp' : 'Mensagem do Cliente (WhatsApp)',
        description: message.content,
        date: new Date(),
        type: message.mediaUrl ? 'FILE' : 'MESSAGE',
        source: 'DRX_TRIAGEM',
        metadata: { 
            agentMessageId: message.id, 
            conversationId: message.conversationId,
            mediaUrl: message.mediaUrl 
        }
      }
    });

    // Registra o link formal
    await this.prisma.agentMessageLink.create({
      data: {
        tenantId,
        messageId: message.id,
        processId,
        timelineId: timelineEntry.id,
        kind: 'PROCESS_TIMELINE'
      }
    });

    return timelineEntry;
  }
}
