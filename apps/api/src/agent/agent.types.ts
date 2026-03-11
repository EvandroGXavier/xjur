export type AgentChannel =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'INSTAGRAM'
  | 'TELEGRAM'
  | 'WEBCHAT'
  | 'PHONE';

export type AgentMessageDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';

export interface CaptureChannelMessageInput {
  tenantId: string;
  channel: string;
  content: string;
  ticketId?: string | null;
  ticketMessageId?: string | null;
  contactId?: string | null;
  connectionId?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  externalParticipantId?: string | null;
  title?: string | null;
  direction?: AgentMessageDirection;
  role?: string;
  contentType?: string | null;
  senderName?: string | null;
  senderAddress?: string | null;
  mediaUrl?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}
