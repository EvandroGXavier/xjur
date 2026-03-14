import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  CheckCheck,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api, getApiUrl } from '../../services/api';
import { useInboxSocket } from '../../hooks/useInboxSocket';
import { Connections } from './components/Connections';

interface ContactSummary {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
}

interface ProcessSummary {
  id: string;
  title?: string;
  code?: string;
  cnj?: string;
}

interface UserSummary {
  id: string;
  name: string;
  email?: string;
}

interface ConnectionSummary {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface InboxMessage {
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

interface Conversation {
  id: string;
  title: string;
  channel: string;
  status: string;
  queue?: string | null;
  unreadCount: number;
  waitingReply: boolean;
  contact?: ContactSummary | null;
  assignee?: UserSummary | null;
  process?: ProcessSummary | null;
  connection?: ConnectionSummary | null;
  messages?: InboxMessage[];
}

interface SendDiagnostics {
  endpoint: string;
  mode: 'json' | 'multipart';
  contentLength: number;
  hasFile: boolean;
  fileName?: string | null;
  status?: number;
  error?: string;
  timestamp: string;
}

const statusOptions = ['OPEN', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
const statusFilters = ['OPEN', 'WAITING', 'RESOLVED', 'CLOSED', 'ALL'] as const;
type StatusFilter = (typeof statusFilters)[number];

const statusLabels: Record<string, string> = {
  OPEN: 'Abertos',
  WAITING: 'Atendidos',
  RESOLVED: 'Resolvidos',
  CLOSED: 'Agenda',
  ALL: 'Todos',
  SENT: 'Enviada',
  PENDING: 'Pendente',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  FAILED: 'Falhou',
};

const channelLabels: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WEBCHAT: 'Webchat',
  EMAIL: 'E-mail',
  TELEGRAM: 'Telegram',
  INSTAGRAM: 'Instagram',
};

const stageButtonMeta: Array<{ value: typeof statusOptions[number]; helper: string }> = [
  { value: 'OPEN', helper: 'Entrada e triagem' },
  { value: 'WAITING', helper: 'Em atendimento' },
  { value: 'RESOLVED', helper: 'Concluido' },
  { value: 'CLOSED', helper: 'Mover para agenda' },
];

const getMediaUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  const cleanPath = path.replace(/\\/g, '/').replace(/^\//, '');
  const baseUrl = (api.defaults.baseURL || '').replace(/\/api\/?$/, '') || 'http://localhost:3000';
  return `${baseUrl}/${cleanPath}`;
};

const getStatusLabel = (status?: string | null) => statusLabels[(status || '').toUpperCase()] || status || '--';

const getChannelLabel = (channel?: string | null) =>
  channelLabels[(channel || '').toUpperCase()] || channel || 'Canal';

const getContactIdentifier = (contact?: ContactSummary | null) =>
  contact?.whatsapp || contact?.phone || contact?.email || '';

const getConversationDisplayName = (conversation?: Conversation | null) =>
  conversation?.contact?.name?.trim() ||
  getContactIdentifier(conversation?.contact) ||
  conversation?.title ||
  'Contato sem identificacao';

const getConversationMeta = (conversation?: Conversation | null) => {
  const parts = [
    getChannelLabel(conversation?.channel),
    conversation?.queue?.trim() || 'Geral',
    getContactIdentifier(conversation?.contact) || null,
  ].filter(Boolean);

  return parts.join(' - ');
};

const getConversationContext = (conversation?: Conversation | null) => {
  const parts = [
    conversation?.process?.cnj || conversation?.process?.title || 'Sem processo',
    conversation?.assignee?.name || 'Sem responsavel',
  ].filter(Boolean);

  return parts.join(' - ');
};

const getStoredUser = (): UserSummary | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.name) return null;
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
    };
  } catch {
    return null;
  }
};

const mergeAssignableUsers = (users: UserSummary[], assignee?: UserSummary | null) => {
  const merged = [assignee || null, ...users, getStoredUser()].filter(Boolean) as UserSummary[];
  const byId = new Map<string, UserSummary>();

  for (const user of merged) {
    if (!byId.has(user.id)) {
      byId.set(user.id, user);
    }
  }

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => typeof item === 'string').join(', ') || fallback;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.filter((item) => typeof item === 'string').join(', ') || fallback;
    }
    if (typeof message === 'string') {
      return message;
    }
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') {
      return error;
    }
  }

  return fallback;
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const getMessageTimestamp = (message?: Pick<InboxMessage, 'createdAt'> | null) =>
  message?.createdAt ? new Date(message.createdAt).getTime() : 0;

const sortMessages = (messages: InboxMessage[]) =>
  [...messages].sort((left, right) => {
    const diff = getMessageTimestamp(left) - getMessageTimestamp(right);
    return diff !== 0 ? diff : left.id.localeCompare(right.id);
  });

const mergeMessages = (current?: InboxMessage[], incoming?: InboxMessage[]) => {
  if (incoming === undefined) {
    return current;
  }

  if (incoming.length === 0) {
    return [];
  }

  if (!current || current.length === 0) {
    return sortMessages(incoming);
  }

  const byId = new Map<string, InboxMessage>();

  for (const message of current) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    const existing = byId.get(message.id);
    byId.set(message.id, existing ? { ...existing, ...message } : message);
  }

  return sortMessages([...byId.values()]);
};

const getConversationLastMessageTime = (conversation: Conversation) =>
  getMessageTimestamp(conversation.messages?.at(-1));

const sortConversations = (items: Conversation[]) =>
  [...items].sort((left, right) => getConversationLastMessageTime(right) - getConversationLastMessageTime(left));

const mergeConversationState = (current: Conversation | undefined, incoming: Conversation): Conversation => {
  if (!current) {
    return {
      ...incoming,
      messages: incoming.messages ? sortMessages(incoming.messages) : incoming.messages,
    };
  }

  return {
    ...current,
    ...incoming,
    messages: mergeMessages(current.messages, incoming.messages),
  };
};

export function AtendimentoPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendDiagnostics, setSendDiagnostics] = useState<SendDiagnostics | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactSummary[]>([]);
  const [processSearch, setProcessSearch] = useState('');
  const [processResults, setProcessResults] = useState<ProcessSummary[]>([]);
  const [newConversation, setNewConversation] = useState({
    channel: 'WHATSAPP',
    contactId: '',
    connectionId: '',
    title: '',
    initialMessage: '',
  });
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const { on } = useInboxSocket();

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) || null;
  const filteredConversations = conversations.filter((conversation) =>
    statusFilter === 'ALL' ? true : conversation.status === statusFilter,
  );
  const statusCounts = statusFilters.reduce<Record<StatusFilter, number>>((accumulator, currentStatus) => {
    accumulator[currentStatus] =
      currentStatus === 'ALL'
        ? conversations.length
        : conversations.filter((conversation) => conversation.status === currentStatus).length;
    return accumulator;
  }, { OPEN: 0, WAITING: 0, RESOLVED: 0, CLOSED: 0, ALL: 0 });
  const canSendMessage = Boolean(selectedConversationId && (messageInput.trim() || selectedFile) && !sendingMessage);
  const assigneeOptions = mergeAssignableUsers(users, selectedConversation?.assignee);

  const upsertConversation = (incoming: Conversation) => {
    setConversations((current) => {
      const existingConversation = current.find((conversation) => conversation.id === incoming.id);
      const mergedConversation = mergeConversationState(existingConversation, incoming);
      const remaining = current.filter((conversation) => conversation.id !== incoming.id);
      return sortConversations([mergedConversation, ...remaining]);
    });
  };

  const fetchConversations = async () => {
    try {
      setLoadingList(true);
      const response = await api.get('/inbox/conversations', {
        params: {
          search: search.trim() || undefined,
        },
      });
      const payload = Array.isArray(response.data) ? response.data : [];
      setConversations((current) =>
        sortConversations(
          payload.map((conversation) =>
            mergeConversationState(
              current.find((existingConversation) => existingConversation.id === conversation.id),
              conversation,
            ),
          ),
        ),
      );
      if (!selectedConversationId && payload.length > 0) {
        setSelectedConversationId(payload[0].id);
      }
    } catch {
      toast.error('Falha ao carregar as conversas.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchConversation = async (conversationId: string) => {
    try {
      setLoadingConversation(true);
      const response = await api.get(`/inbox/conversations/${conversationId}`);
      upsertConversation(response.data);
    } catch {
      toast.error('Falha ao carregar a conversa.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const fetchSupportData = async () => {
    const [usersResponse, connectionsResponse] = await Promise.allSettled([api.get('/users'), api.get('/connections')]);
    if (usersResponse.status === 'fulfilled') {
      setUsers(Array.isArray(usersResponse.value.data) ? usersResponse.value.data : []);
    } else {
      const storedUser = getStoredUser();
      setUsers(storedUser ? [storedUser] : []);
    }
    if (connectionsResponse.status === 'fulfilled') {
      const all = Array.isArray(connectionsResponse.value.data) ? connectionsResponse.value.data : [];
      setConnections(all.filter((connection: ConnectionSummary) => connection.type === 'WHATSAPP'));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) setSelectedFile(event.target.files[0]);
  };

  const sendConversationMessage = async (conversationId: string, content: string, file: File | null) => {
    const endpoint = `${getApiUrl()}/inbox/conversations/${conversationId}/messages`;
    const textEndpoint = `${getApiUrl()}/inbox/conversations/${conversationId}/messages/text`;
    const baseDiagnostics = {
      contentLength: content.length,
      hasFile: Boolean(file),
      fileName: file?.name || null,
      timestamp: new Date().toISOString(),
    };

    const request = async (
      body: FormData | { content: string },
      requestEndpoint: string,
      mode: SendDiagnostics['mode'],
    ) => {
      const requestDiagnostics: SendDiagnostics = {
        endpoint: requestEndpoint,
        mode,
        ...baseDiagnostics,
      };
      setSendDiagnostics(requestDiagnostics);
      console.info('[Atendimento] Enviando mensagem', requestDiagnostics);

      try {
        const response =
          body instanceof FormData
            ? await api.post(requestEndpoint, body, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              })
            : await api.post(requestEndpoint, body);

        return response.data;
      } catch (error: any) {
        const payload = error?.response?.data;
        const failedDiagnostics: SendDiagnostics = {
          ...requestDiagnostics,
          status: error?.response?.status,
          error: getErrorMessage(payload?.message || payload || error?.message, 'Falha ao enviar a mensagem.'),
        };
        setSendDiagnostics(failedDiagnostics);
        console.error('[Atendimento] Falha ao enviar mensagem', failedDiagnostics, payload || error);
        throw new Error(failedDiagnostics.error);
      }
    };

    if (file) {
      const formData = new FormData();
      if (content) formData.append('content', content);
      formData.append('file', file);
      return request(formData, endpoint, 'multipart');
    }

    try {
      return await request({ content }, textEndpoint, 'json');
    } catch (error) {
      if (error instanceof Error && error.message === 'Mensagem vazia.' && content) {
        const fallback = new FormData();
        fallback.append('content', content);
        return request(fallback, endpoint, 'multipart');
      }
      throw error;
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();

    if (!selectedConversationId || (!trimmedMessage && !selectedFile)) return;

    setSendingMessage(true);

    const tempMessageId = `temp-${Date.now()}`;
    const tempMediaUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
    const optimisticMessage: InboxMessage = {
      id: tempMessageId,
      direction: 'OUTBOUND',
      content: trimmedMessage || selectedFile?.name || '',
      contentType: selectedFile
        ? selectedFile.type.startsWith('image/')
          ? 'IMAGE'
          : 'FILE'
        : 'TEXT',
      status: 'PENDING',
      senderName: 'Equipe DR.X',
      mediaUrl: tempMediaUrl,
      createdAt: new Date().toISOString(),
    };

    setConversations((current) =>
      sortConversations(
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                waitingReply: false,
                unreadCount: 0,
                messages: mergeMessages(conversation.messages, [optimisticMessage]),
              }
            : conversation,
        ),
      ),
    );

    try {
      setMessageInput('');
      setSelectedFile(null);
      const response = await sendConversationMessage(selectedConversationId, trimmedMessage, selectedFile);

      setConversations((current) =>
        sortConversations(
          current.map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  messages: sortMessages(
                    (conversation.messages || []).map((message) =>
                      message.id === tempMessageId
                        ? { ...message, ...(response || {}), id: response?.id || tempMessageId }
                        : message,
                    ),
                  ),
                }
              : conversation,
          ),
        ),
      );
      setSendDiagnostics(null);
      await fetchConversation(selectedConversationId);
    } catch (error: any) {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                messages: (conversation.messages || []).map((message) =>
                  message.id === tempMessageId ? { ...message, status: 'FAILED' } : message,
                ),
              }
            : conversation,
        ),
      );
      setMessageInput(trimmedMessage);
      setSelectedFile(selectedFile);
      toast.error(getErrorMessage(error?.response?.data?.message || error?.message, 'Falha ao enviar a mensagem.'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateConversation = async (payload: Record<string, any>) => {
    if (!selectedConversationId) return;
    try {
      const response = await api.patch(`/inbox/conversations/${selectedConversationId}`, payload);
      upsertConversation(response.data);
    } catch {
      toast.error('Falha ao atualizar a conversa.');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || !selectedConversation) return;
    if (!window.confirm(`Excluir o atendimento "${getConversationDisplayName(selectedConversation)}" e todas as mensagens?`)) {
      return;
    }

    try {
      await api.delete(`/inbox/conversations/${selectedConversationId}`);
      setConversations((current) => current.filter((conversation) => conversation.id !== selectedConversationId));
      const nextConversation = filteredConversations.find((conversation) => conversation.id !== selectedConversationId);
      setSelectedConversationId(nextConversation?.id || null);
      toast.success('Atendimento apagado com sucesso.');
    } catch {
      toast.error('Falha ao apagar o atendimento.');
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSendMessage) {
        handleSendMessage();
      }
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversation.contactId) {
      toast.error('Selecione um contato.');
      return;
    }
    try {
      const response = await api.post('/inbox/conversations', newConversation);
      upsertConversation(response.data);
      setSelectedConversationId(response.data.id);
      setShowNewConversation(false);
      setContactSearch('');
      setContactResults([]);
      setNewConversation({ channel: 'WHATSAPP', contactId: '', connectionId: '', title: '', initialMessage: '' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Falha ao criar atendimento.');
    }
  };

  const handleLinkMessage = async (messageId: string) => {
    if (!selectedConversation?.process?.id) {
      toast.error('Defina primeiro o processo principal.');
      return;
    }
    try {
      await api.post(`/inbox/messages/${messageId}/link-process`, { processId: selectedConversation.process.id });
      fetchConversation(selectedConversation.id);
      toast.success('Mensagem vinculada ao processo.');
    } catch {
      toast.error('Falha ao vincular a mensagem.');
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    fetchSupportData();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;
    fetchConversation(selectedConversationId);
    api.post(`/inbox/conversations/${selectedConversationId}/read`).catch(() => undefined);
  }, [selectedConversationId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchConversations(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }

    const stillVisible = filteredConversations.some((conversation) => conversation.id === selectedConversationId);
    if (!stillVisible) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversationId]);

  useEffect(() => {
    if (!showNewConversation) return;
    const timer = setTimeout(async () => {
      if (!contactSearch.trim()) {
        setContactResults([]);
        return;
      }
      try {
        const response = await api.get('/contacts', { params: { search: contactSearch.trim() } });
        setContactResults(Array.isArray(response.data) ? response.data.slice(0, 8) : []);
      } catch {
        setContactResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [contactSearch, showNewConversation]);

  useEffect(() => {
    if (!selectedConversation || !processSearch.trim()) {
      setProcessResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/processes', { params: { search: processSearch.trim() } });
        setProcessResults(Array.isArray(response.data) ? response.data.slice(0, 6) : []);
      } catch {
        setProcessResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [processSearch, selectedConversation?.id]);

  useEffect(() => {
    const unsubscribeNew = on('conversation:new', (conversation: Conversation) => upsertConversation(conversation));
    const unsubscribeUpdated = on('conversation:updated', (conversation: Conversation) => upsertConversation(conversation));
    const unsubscribeMessage = on(
      'conversation:message',
      ({ conversationId, message }: { conversationId: string; message: InboxMessage }) => {
        setConversations((current) =>
          sortConversations(
            current.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    messages: mergeMessages(conversation.messages, [message]),
                  }
                : conversation,
            ),
          ),
        );
      },
    );
    const unsubscribeStatus = on(
      'conversation:message-status',
      ({ conversationId, messageId, status }: { conversationId: string; messageId: string; status: string }) => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: (conversation.messages || []).map((message) =>
                    message.id === messageId ? { ...message, status } : message,
                  ),
                }
              : conversation,
          ),
        );
      },
    );
    const unsubscribeError = on('conversation:error', (payload: { message: string }) => toast.error(payload.message));

    return () => {
      unsubscribeNew();
      unsubscribeUpdated();
      unsubscribeMessage();
      unsubscribeStatus();
      unsubscribeError();
    };
  }, [on]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth',
    });
  }, [selectedConversationId, selectedConversation?.messages?.length]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-950 text-white">
      <aside className="flex min-h-0 w-full max-w-[340px] flex-col border-r border-white/10 bg-slate-950/80">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">Inbox DR.X</p>
              <h1 className="text-xl font-semibold">Atendimento</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConnections(true)} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"><Settings2 size={16} /></button>
              <button onClick={() => setShowNewConversation(true)} className="rounded-xl bg-emerald-400 p-2 text-slate-950 hover:bg-emerald-300"><Plus size={16} /></button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Search size={15} className="text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
          </div>
          <div className="mt-4 grid gap-2">
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  'flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition',
                  statusFilter === status
                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10',
                )}
              >
                <span>{getStatusLabel(status)}</span>
                <span className={clsx('inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs', statusFilter === status ? 'bg-emerald-300 text-slate-950' : 'bg-white/10 text-slate-200')}>
                  {statusCounts[status]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loadingList ? (
            <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
              Nenhum atendimento encontrado para {getStatusLabel(statusFilter).toLowerCase()}.
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={clsx('mb-2 w-full rounded-3xl border px-4 py-3 text-left transition', selectedConversationId === conversation.id ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/5 bg-white/[0.03] hover:border-white/15')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{getConversationDisplayName(conversation)}</p>
                    <p className="mt-1 text-xs text-slate-400">{getConversationMeta(conversation)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{formatTime(conversation.messages?.at(-1)?.createdAt || null)}</p>
                    {conversation.unreadCount > 0 && <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-slate-950">{conversation.unreadCount}</span>}
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-300">{conversation.messages?.at(-1)?.content || 'Sem mensagens ainda.'}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        {!selectedConversation ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center">
              <MessageCircle className="mx-auto mb-4 text-emerald-300" size={40} />
              <p className="text-lg font-semibold">Selecione uma conversa ou crie um novo atendimento.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-white/10 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{getConversationDisplayName(selectedConversation)}</p>
                  <p className="text-sm text-slate-400">{getConversationMeta(selectedConversation)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getConversationContext(selectedConversation)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => fetchConversation(selectedConversation.id)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"><RefreshCcw size={16} /></button>
                  <button onClick={handleDeleteConversation} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100 hover:bg-red-500/20">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <section className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
                <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  {loadingConversation ? (
                    <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
                  ) : (
                    <div className="space-y-4">
                      {(selectedConversation.messages || []).map((message) => {
                        const isMine = message.direction !== 'INBOUND';
                        return (
                          <div key={message.id} className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}>
                            <div className={clsx('max-w-[78%] rounded-3xl px-4 py-3', isMine ? 'bg-emerald-400 text-slate-950' : 'border border-white/10 bg-white/5')}>
                              {message.mediaUrl && message.contentType === 'IMAGE' && <img src={getMediaUrl(message.mediaUrl)} alt="midia" className="mb-3 max-h-72 rounded-2xl object-cover" />}
                              {message.mediaUrl && message.contentType !== 'IMAGE' && <a href={getMediaUrl(message.mediaUrl)} target="_blank" rel="noreferrer" className="mb-3 block rounded-2xl border border-black/10 bg-black/10 px-3 py-2 text-sm">Abrir anexo</a>}
                              <p className="whitespace-pre-wrap text-sm">{message.content || '[sem texto]'}</p>
                              <div className={clsx('mt-3 flex items-center justify-between gap-3 text-[11px]', isMine ? 'text-slate-800/80' : 'text-slate-400')}>
                                <span>{message.senderName || (isMine ? 'Equipe DR.X' : 'Contato')}</span>
                                <div className="flex items-center gap-2">
                                  {selectedConversation.process?.id && <button onClick={() => handleLinkMessage(message.id)} className="rounded-full bg-black/10 px-2 py-1 hover:bg-black/20">Vincular</button>}
                                  <span>{formatTime(message.createdAt)}</span>
                                  <span>{getStatusLabel(message.status)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/10 px-6 py-4">
                  {selectedFile && <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">{selectedFile.name}</div>}
                  {sendDiagnostics && (
                    <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      Diagnostico de envio: rota `{sendDiagnostics.endpoint.split('/api').pop() || sendDiagnostics.endpoint}`, modo `{sendDiagnostics.mode}`, texto `{sendDiagnostics.contentLength}` caractere(s), arquivo `{sendDiagnostics.hasFile ? sendDiagnostics.fileName || 'sim' : 'nao'}`{sendDiagnostics.status ? `, status ${sendDiagnostics.status}` : ''}{sendDiagnostics.error ? `, erro: ${sendDiagnostics.error}` : ''}.
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <label className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
                      <Paperclip size={18} />
                      <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                    <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={handleComposerKeyDown} rows={3} placeholder="Digite uma mensagem. Enter envia, Shift + Enter quebra linha." className="min-h-[84px] flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-slate-500" />
                    <button onClick={handleSendMessage} disabled={!canSendMessage} className="rounded-3xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
                      {sendingMessage ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="hidden w-[320px] shrink-0 border-l border-white/10 bg-slate-950/60 xl:flex xl:min-h-0 xl:flex-col">
                <div className="space-y-4 p-5">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Responsavel</p>
                    <select value={selectedConversation.assignee?.id || ''} onChange={(event) => handleUpdateConversation({ assignedUserId: event.target.value || null })} className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none">
                      <option value="">Sem responsavel</option>
                      {assigneeOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Situacao</p>
                    <select value={selectedConversation.status} onChange={(event) => handleUpdateConversation({ status: event.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none">
                      {statusOptions.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
                    </select>
                    <div className="mt-3 grid gap-2">
                      {stageButtonMeta.map((stage) => (
                        <button
                          key={stage.value}
                          onClick={() => handleUpdateConversation({ status: stage.value })}
                          className={clsx(
                            'flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition',
                            selectedConversation.status === stage.value
                              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10',
                          )}
                        >
                          <div>
                            <p className="text-sm font-semibold">{getStatusLabel(stage.value)}</p>
                            <p className="text-[11px] text-slate-400">{stage.helper}</p>
                          </div>
                          <CheckCheck size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Fila</p>
                    <input value={selectedConversation.queue || ''} onChange={(event) => handleUpdateConversation({ queue: event.target.value })} placeholder="Fila / departamento" className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Contato</p>
                    <p className="mt-3 text-sm font-medium">{getConversationDisplayName(selectedConversation)}</p>
                    <p className="mt-2 text-xs text-slate-400">{getContactIdentifier(selectedConversation.contact) || selectedConversation.title || 'Sem identificacao'}</p>
                    {selectedConversation.contact?.email && (
                      <p className="mt-1 text-xs text-slate-500">{selectedConversation.contact.email}</p>
                    )}
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Processo principal</p>
                    <p className="mt-3 text-sm">{selectedConversation.process?.cnj || selectedConversation.process?.title || 'Nao vinculado'}</p>
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <Search size={14} className="text-slate-500" />
                      <input value={processSearch} onChange={(event) => setProcessSearch(event.target.value)} placeholder="Buscar processo" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
                    </div>
                    {processResults.map((process) => (
                      <button key={process.id} onClick={() => { handleUpdateConversation({ processId: process.id }); setProcessSearch(''); setProcessResults([]); }} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10">
                        <p>{process.title || 'Processo sem titulo'}</p>
                        <p className="text-xs text-slate-400">{process.cnj || process.code}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      {showConnections && (
        <div className="fixed inset-0 z-40 bg-slate-950/85 p-4 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full max-w-[1500px] flex-col rounded-[32px] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/5">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <p className="font-semibold">Conexoes omnichannel</p>
              <button onClick={() => setShowConnections(false)} className="rounded-2xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto"><Connections /></div>
          </div>
        </div>
      )}

      {showNewConversation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-950 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Novo atendimento</p>
                <p className="text-xs text-slate-400">Criado direto no modelo principal.</p>
              </div>
              <button onClick={() => setShowNewConversation(false)} className="rounded-2xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <select value={newConversation.channel} onChange={(event) => setNewConversation((current) => ({ ...current, channel: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">E-mail</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="WEBCHAT">Webchat</option>
              </select>
              <select value={newConversation.connectionId} onChange={(event) => setNewConversation((current) => ({ ...current, connectionId: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none">
                <option value="">Escolher instancia depois</option>
                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} - {getStatusLabel(connection.status)}</option>)}
              </select>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-slate-500" />
                  <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar contato..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
                </div>
                {contactResults.length > 0 && (
                  <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                    {contactResults.map((contact) => (
                      <button key={contact.id} onClick={() => setNewConversation((current) => ({ ...current, contactId: contact.id, title: current.title || contact.name }))} className={clsx('w-full rounded-2xl border px-3 py-2 text-left text-sm', newConversation.contactId === contact.id ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-slate-900')}>
                        <p>{contact.name}</p>
                        <p className="text-xs text-slate-400">{contact.whatsapp || contact.phone || contact.email || '-'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input value={newConversation.title} onChange={(event) => setNewConversation((current) => ({ ...current, title: event.target.value }))} placeholder="Titulo interno" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none md:col-span-2" />
              <textarea value={newConversation.initialMessage} onChange={(event) => setNewConversation((current) => ({ ...current, initialMessage: event.target.value }))} rows={4} placeholder="Mensagem inicial opcional" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none md:col-span-2" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowNewConversation(false)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10">Cancelar</button>
              <button onClick={handleCreateConversation} className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300">Criar atendimento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

