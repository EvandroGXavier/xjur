export type AtendimentoStatus = 'OPEN' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type AtendimentoStatusFilter = AtendimentoStatus | 'ALL';
export type AtendimentoChannel =
  | 'WHATSAPP'
  | 'WEBCHAT'
  | 'EMAIL'
  | 'TELEGRAM'
  | 'INSTAGRAM'
  | 'PHONE'
  | 'INTERNAL';

export interface ContactSummary {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
}

export interface ProcessSummary {
  id: string;
  title?: string;
  code?: string;
  cnj?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface InboxMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  content: string;
  contentType: string;
  status: string;
  senderName?: string;
  mediaUrl?: string | null;
  createdAt: string;
  links?: Array<{ id: string }>;
}

export interface AtendimentoConversation {
  id: string;
  title: string;
  channel: string;
  status: string;
  priority?: string;
  queue?: string | null;
  unreadCount: number;
  waitingReply: boolean;
  contact?: ContactSummary | null;
  assignee?: UserSummary | null;
  process?: ProcessSummary | null;
  connection?: ConnectionSummary | null;
  messages?: InboxMessage[];
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
}

export const ATENDIMENTO_STATUS_OPTIONS = ['OPEN', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
export const ATENDIMENTO_STATUS_FILTERS = ['ALL', ...ATENDIMENTO_STATUS_OPTIONS] as const;

export const ATENDIMENTO_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Triagem',
  WAITING: 'Em atendimento',
  RESOLVED: 'Convertidos',
  CLOSED: 'Encerrados',
  ALL: 'Todos',
  SENT: 'Enviada',
  PENDING: 'Pendente',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  FAILED: 'Falhou',
};

export const ATENDIMENTO_CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WEBCHAT: 'Webchat',
  EMAIL: 'E-mail',
  TELEGRAM: 'Telegram',
  INSTAGRAM: 'Instagram',
  PHONE: 'Telefone',
  INTERNAL: 'Interno',
};

export const ATENDIMENTO_STAGE_BUTTONS: Array<{
  value: AtendimentoStatus;
  helper: string;
}> = [
  { value: 'OPEN', helper: 'Entrada, leitura e triagem inicial' },
  { value: 'WAITING', helper: 'Conversa em atendimento ativo' },
  { value: 'RESOLVED', helper: 'Assunto convertido ou concluido' },
  { value: 'CLOSED', helper: 'Encerrado e fora da fila operacional' },
];

export const getStatusLabel = (status?: string | null) =>
  ATENDIMENTO_STATUS_LABELS[(status || '').toUpperCase()] || status || '--';

export const getChannelLabel = (channel?: string | null) =>
  ATENDIMENTO_CHANNEL_LABELS[(channel || '').toUpperCase()] || channel || 'Canal';

export const getContactIdentifier = (contact?: ContactSummary | null) =>
  contact?.whatsapp || contact?.phone || contact?.email || '';

export const getConversationDisplayName = (conversation?: AtendimentoConversation | null) =>
  conversation?.contact?.name?.trim() ||
  getContactIdentifier(conversation?.contact) ||
  conversation?.title ||
  'Contato sem identificacao';

export const getConversationMeta = (conversation?: AtendimentoConversation | null) => {
  const parts = [
    getChannelLabel(conversation?.channel),
    conversation?.queue?.trim() || 'Fila geral',
    getContactIdentifier(conversation?.contact) || null,
  ].filter(Boolean);

  return parts.join(' - ');
};

export const getConversationContext = (conversation?: AtendimentoConversation | null) => {
  const parts = [
    conversation?.process?.cnj || conversation?.process?.title || 'Sem processo',
    conversation?.assignee?.name || 'Sem responsavel',
  ].filter(Boolean);

  return parts.join(' - ');
};
