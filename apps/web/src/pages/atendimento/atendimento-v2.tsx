import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  CircleDot,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  PenSquare,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { useInboxSocket } from '../../hooks/useInboxSocket';
import { getUser } from '../../auth/authStorage';
import { useProtectedMediaUrl } from '../../hooks/useProtectedMediaUrl';
import { openProtectedMedia } from '../../services/protectedMedia';
import {
  ATENDIMENTO_CHANNEL_LABELS,
  ATENDIMENTO_STAGE_BUTTONS,
  ATENDIMENTO_STATUS_FILTERS,
  ATENDIMENTO_STATUS_OPTIONS,
  AtendimentoConversation,
  ConnectionSummary,
  ContactSummary,
  InboxMessage,
  ProcessSummary,
  UserSummary,
  getAdditionalContactIdentifier,
  getChannelLabel,
  getContactIdentifier,
  getConversationContext,
  getConversationDisplayName,
  getConversationMeta,
  getStatusLabel,
} from './atendimento.shared';

const ProtectedInlineImage = ({ mediaUrl }: { mediaUrl: string }) => {
  const url = useProtectedMediaUrl(mediaUrl);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="midia"
      className="mb-3 max-h-72 rounded-2xl object-cover"
      onClick={() =>
        openProtectedMedia(mediaUrl).catch(() =>
          toast.error('Sem permissão para baixar ou abrir este arquivo.'),
        )
      }
    />
  );
};

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

interface AtendimentoPageProps {
  selectedConversationId?: string | null;
  onSelectConversation?: (conversationId: string | null) => void;
  onOpenConnections?: () => void;
}

type OwnershipFilter = 'ALL' | 'MINE' | 'UNASSIGNED';

const getStoredUser = (): UserSummary | null => {
  if (typeof window === 'undefined') return null;

  const stored = getUser();
  if (!stored?.id || !stored?.name) return null;
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
  };
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

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-teal-600',
];

const ConversationAvatar = ({ name }: { name: string }) => {
  const initial = name.trim()[0]?.toUpperCase() || '?';
  const colorIdx =
    name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${AVATAR_COLORS[colorIdx]}`}
    >
      {initial}
    </div>
  );
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const normalizeWhatsappDigits = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
};

const getContactWhatsappTarget = (contact?: ContactSummary | null) => {
  const additionalValues = Array.isArray(contact?.additionalContacts)
    ? contact.additionalContacts.map((item) => item.value)
    : [];
  const preferredAdditional =
    additionalValues.find((value) => /^\d{10,15}$/.test((value || '').replace(/\D/g, '')))
    || additionalValues.find((value) => value.includes('@s.whatsapp.net'))
    || additionalValues.find((value) => value.includes('@lid'))
    || '';

  const canonicalDigits = normalizeWhatsappDigits(preferredAdditional);
  if (canonicalDigits) return canonicalDigits;

  const fullId = (preferredAdditional || '').trim();
  return fullId || '';
};

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

const getConversationLastMessageTime = (conversation: AtendimentoConversation) =>
  getMessageTimestamp(conversation.messages?.at(-1)) ||
  (conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0);

const sortConversations = (items: AtendimentoConversation[]) =>
  [...items].sort(
    (left, right) => getConversationLastMessageTime(right) - getConversationLastMessageTime(left),
  );

const mergeConversationState = (
  current: AtendimentoConversation | undefined,
  incoming: AtendimentoConversation,
): AtendimentoConversation => {
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

export function AtendimentoPage({
  selectedConversationId: selectedConversationIdProp,
  onSelectConversation,
  onOpenConnections,
}: AtendimentoPageProps) {
  const storedUser = useMemo(() => getStoredUser(), []);
  const [conversations, setConversations] = useState<AtendimentoConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    selectedConversationIdProp || null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<(typeof ATENDIMENTO_STATUS_FILTERS)[number]>('ALL');
  const [channelFilter, setChannelFilter] = useState<
    'ALL' | keyof typeof ATENDIMENTO_CHANNEL_LABELS
  >('ALL');
  const [queueFilter, setQueueFilter] = useState('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('ALL');
  const [waitingReplyOnly, setWaitingReplyOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [withoutProcessOnly, setWithoutProcessOnly] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendDiagnostics, setSendDiagnostics] = useState<SendDiagnostics | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactSummary[]>([]);
  const [associateSearch, setAssociateSearch] = useState('');
  const [associateResults, setAssociateResults] = useState<ContactSummary[]>([]);
  const [assigningContact, setAssigningContact] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [processResults, setProcessResults] = useState<ProcessSummary[]>([]);
  const [queueDraft, setQueueDraft] = useState('');
  const [newConversation, setNewConversation] = useState({
    channel: 'WHATSAPP',
    contactId: '',
    connectionId: '',
    title: '',
    initialMessage: '',
    externalThreadId: '',
  });

  const filteredConnectionsModal = useMemo(() => {
    if (!newConversation.channel) return connections;
    return connections.filter(
      (connection) =>
        connection.type.toUpperCase() === newConversation.channel.toUpperCase(),
    );
  }, [connections, newConversation.channel]);

  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const { on } = useInboxSocket();

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) || null;

  const statusCounts = useMemo(
    () =>
      ATENDIMENTO_STATUS_FILTERS.reduce<
        Record<(typeof ATENDIMENTO_STATUS_FILTERS)[number], number>
      >(
        (accumulator, currentStatus) => {
          accumulator[currentStatus] =
            currentStatus === 'ALL'
              ? conversations.length
              : conversations.filter((conversation) => conversation.status === currentStatus).length;
          return accumulator;
        },
        { ALL: 0, OPEN: 0, WAITING: 0, RESOLVED: 0, CLOSED: 0 },
      ),
    [conversations],
  );

  const channelOptions = useMemo(() => {
    const fromData = conversations
      .map((conversation) => conversation.channel?.toUpperCase())
      .filter((value): value is keyof typeof ATENDIMENTO_CHANNEL_LABELS => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index);

    return ['ALL' as const, ...fromData.sort()];
  }, [conversations]);

  const queueOptions = useMemo(() => {
    const fromData = conversations
      .map((conversation) => conversation.queue?.trim())
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index);

    return ['ALL', ...fromData.sort((left, right) => left.localeCompare(right, 'pt-BR'))];
  }, [conversations]);

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (statusFilter !== 'ALL' && conversation.status !== statusFilter) return false;
        if (channelFilter !== 'ALL' && conversation.channel !== channelFilter) return false;
        if (queueFilter !== 'ALL' && (conversation.queue?.trim() || '') !== queueFilter)
          return false;
        if (ownershipFilter === 'MINE' && conversation.assignee?.id !== storedUser?.id)
          return false;
        if (ownershipFilter === 'UNASSIGNED' && conversation.assignee?.id) return false;
        if (waitingReplyOnly && !conversation.waitingReply) return false;
        if (unreadOnly && conversation.unreadCount <= 0) return false;
        if (withoutProcessOnly && conversation.process?.id) return false;
        return true;
      }),
    [
      channelFilter,
      conversations,
      ownershipFilter,
      queueFilter,
      statusFilter,
      storedUser?.id,
      unreadOnly,
      waitingReplyOnly,
      withoutProcessOnly,
    ],
  );

  const canSendMessage = Boolean(
    selectedConversationId && (messageInput.trim() || selectedFile) && !sendingMessage,
  );
  const assigneeOptions = mergeAssignableUsers(users, selectedConversation?.assignee);

  const selectConversation = (conversationId: string | null) => {
    setSelectedConversationId(conversationId);
    onSelectConversation?.(conversationId);
  };

  const upsertConversation = (incoming: AtendimentoConversation) => {
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
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          channel: channelFilter === 'ALL' ? undefined : channelFilter,
          search: search.trim() || undefined,
          assignedUserId:
            ownershipFilter === 'MINE' && storedUser?.id ? storedUser.id : undefined,
          waitingReply: waitingReplyOnly ? true : undefined,
        },
      });
      const payload = Array.isArray(response.data) ? response.data : [];
      setConversations((current) =>
        sortConversations(
          payload.map((conversation) =>
            mergeConversationState(
              current.find(
                (existingConversation) => existingConversation.id === conversation.id,
              ),
              conversation,
            ),
          ),
        ),
      );
      if (!selectedConversationId && payload.length > 0) {
        selectConversation(payload[0].id);
      }
    } catch {
      toast.error('Falha ao carregar os atendimentos.');
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
    const [usersResponse, connectionsResponse] = await Promise.allSettled([
      api.get('/users'),
      api.get('/connections'),
    ]);
    if (usersResponse.status === 'fulfilled') {
      setUsers(Array.isArray(usersResponse.value.data) ? usersResponse.value.data : []);
    } else {
      setUsers(storedUser ? [storedUser] : []);
    }
    if (connectionsResponse.status === 'fulfilled') {
      const all = Array.isArray(connectionsResponse.value.data)
        ? connectionsResponse.value.data
        : [];
      setConnections(all);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const sendConversationMessage = async (
    conversationId: string,
    content: string,
    file: File | null,
  ) => {
    const endpoint = `/inbox/conversations/${conversationId}/messages`;
    const textEndpoint = `/inbox/conversations/${conversationId}/messages/text`;
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
          error: getErrorMessage(
            payload?.message || payload || error?.message,
            'Falha ao enviar a mensagem.',
          ),
        };
        setSendDiagnostics(failedDiagnostics);
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
      const fileToSend = selectedFile;
      setMessageInput('');
      setSelectedFile(null);
      const response = await sendConversationMessage(
        selectedConversationId,
        trimmedMessage,
        fileToSend,
      );

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
      toast.error(
        getErrorMessage(
          error?.response?.data?.message || error?.message,
          'Falha ao enviar a mensagem.',
        ),
      );
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
      toast.error('Falha ao atualizar o atendimento.');
    }
  };

  const handleAssignContact = async (contactId: string) => {
    if (!selectedConversationId) return;
    setAssigningContact(true);
    try {
      const response = await api.post(
        `/inbox/conversations/${selectedConversationId}/assign-contact`,
        { contactId },
      );
      upsertConversation(response.data);
      setAssociateSearch('');
      setAssociateResults([]);
      toast.success('Contato associado com sucesso.');
    } catch {
      toast.error('Falha ao associar o contato.');
    } finally {
      setAssigningContact(false);
    }
  };

  const handleCreateAndAssignContact = async () => {
    if (!selectedConversationId || !selectedConversation) return;
    const meta = selectedConversation.metadata || {};
    const name = (meta.pushName as string | undefined)?.trim() || 'Contato WhatsApp';
    const rawId =
      (meta.rawParticipantId as string | undefined) ||
      (meta.rawRemoteJid as string | undefined) ||
      '';

    setAssigningContact(true);
    try {
      const contactResponse = await api.post('/contacts', { name });
      const newContactId = contactResponse.data?.id;
      if (!newContactId) throw new Error('ID do contato não retornado');

      if (rawId) {
        await api.post(`/contacts/${newContactId}/additional-contacts`, {
          type: rawId.includes('@lid') ? 'WHATSAPP_LID' : 'WHATSAPP_JID',
          value: rawId,
          nomeContatoAdicional: 'WhatsApp',
        }).catch(() => undefined);
      }

      const response = await api.post(
        `/inbox/conversations/${selectedConversationId}/assign-contact`,
        { contactId: newContactId },
      );
      upsertConversation(response.data);
      toast.success(`Contato "${name}" criado e associado.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Falha ao criar e associar o contato.');
    } finally {
      setAssigningContact(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || !selectedConversation) return;
    if (
      !window.confirm(
        `Excluir o atendimento "${getConversationDisplayName(selectedConversation)}" e todas as mensagens?`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/inbox/conversations/${selectedConversationId}`);
      const nextConversations = conversations.filter(
        (conversation) => conversation.id !== selectedConversationId,
      );
      setConversations(nextConversations);
      const nextConversation =
        filteredConversations.find(
          (conversation) => conversation.id !== selectedConversationId,
        ) || nextConversations[0];
      selectConversation(nextConversation?.id || null);
      toast.success('Atendimento apagado com sucesso.');
    } catch {
      toast.error('Falha ao apagar o atendimento.');
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
      selectConversation(response.data.id);
      setShowNewConversation(false);
      setContactSearch('');
      setContactResults([]);
      setNewConversation({
        channel: 'WHATSAPP',
        contactId: '',
        connectionId: '',
        title: '',
        initialMessage: '',
        externalThreadId: '',
      });
      toast.success('Atendimento criado no Inbox principal.');
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
      await api.post(`/inbox/messages/${messageId}/link-process`, {
        processId: selectedConversation.process.id,
      });
      fetchConversation(selectedConversation.id);
      toast.success('Mensagem vinculada ao processo.');
    } catch {
      toast.error('Falha ao vincular a mensagem.');
    }
  };

  const handleQueueSubmit = async () => {
    if (!selectedConversation) return;
    const normalizedDraft = queueDraft.trim();
    const currentQueue = selectedConversation.queue?.trim() || '';
    if (normalizedDraft === currentQueue) return;
    await handleUpdateConversation({ queue: normalizedDraft || null });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSendMessage) {
        handleSendMessage();
      }
    }
  };

  useEffect(() => {
    fetchSupportData();
  }, []);

  useEffect(() => {
    if (selectedConversationIdProp === undefined) return;
    setSelectedConversationId(selectedConversationIdProp || null);
  }, [selectedConversationIdProp]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations();
    }, search.trim() ? 260 : 0);
    return () => clearTimeout(timer);
  }, [channelFilter, ownershipFilter, search, statusFilter, storedUser?.id, waitingReplyOnly]);

  useEffect(() => {
    if (!selectedConversationId) return;
    fetchConversation(selectedConversationId);
    api.post(`/inbox/conversations/${selectedConversationId}/read`).catch(() => undefined);
    setAssociateSearch('');
    setAssociateResults([]);
  }, [selectedConversationId]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      if (
        selectedConversationId &&
        !conversations.some((conversation) => conversation.id === selectedConversationId)
      ) {
        selectConversation(null);
      }
      return;
    }

    const stillVisible = filteredConversations.some(
      (conversation) => conversation.id === selectedConversationId,
    );
    if (!selectedConversationId || !stillVisible) {
      selectConversation(filteredConversations[0].id);
    }
  }, [conversations, filteredConversations, selectedConversationId]);

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
    if (!associateSearch.trim()) {
      setAssociateResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/contacts', { params: { search: associateSearch.trim() } });
        setAssociateResults(Array.isArray(response.data) ? response.data.slice(0, 8) : []);
      } catch {
        setAssociateResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [associateSearch]);

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
    const unsubscribeNew = on('conversation:new', (conversation: AtendimentoConversation) =>
      upsertConversation(conversation),
    );
    const unsubscribeUpdated = on(
      'conversation:updated',
      (conversation: AtendimentoConversation) => upsertConversation(conversation),
    );
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
      ({
        conversationId,
        messageId,
        status,
      }: {
        conversationId: string;
        messageId: string;
        status: string;
      }) => {
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
    const unsubscribeError = on('conversation:error', (payload: { message: string }) =>
      toast.error(payload.message),
    );

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

  useEffect(() => {
    setQueueDraft(selectedConversation?.queue || '');
  }, [selectedConversation?.id, selectedConversation?.queue]);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden text-white">
      {/* Conversation list sidebar */}
      <aside className="flex min-h-0 w-[320px] shrink-0 flex-col border-r border-white/10 bg-slate-900/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/60">Console</p>
            <h2 className="text-base font-semibold">Atendimento</h2>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              title="Filtros"
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-xl transition',
                showFilters
                  ? 'bg-emerald-400/20 text-emerald-400'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              onClick={onOpenConnections}
              title="Conexões"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Settings2 size={16} />
            </button>
            <button
              onClick={() => setShowNewConversation(true)}
              title="Nova conversa"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-400 transition hover:bg-emerald-400/30"
            >
              <PenSquare size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 pt-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversa..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Filter panel (collapsible) */}
        {showFilters && (
          <div className="space-y-3 border-t border-white/10 px-3 py-3">
            {/* Status */}
            <div className="grid grid-cols-3 gap-1.5">
              {ATENDIMENTO_STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={clsx(
                    'rounded-xl border px-2 py-1.5 text-left transition',
                    statusFilter === status
                      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                  )}
                >
                  <p className="text-[11px] font-semibold leading-tight">{getStatusLabel(status)}</p>
                  <p className="text-[10px] text-slate-400">{statusCounts[status]}</p>
                </button>
              ))}
            </div>

            {/* Channel + Ownership */}
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={channelFilter}
                onChange={(event) =>
                  setChannelFilter(
                    event.target.value as 'ALL' | keyof typeof ATENDIMENTO_CHANNEL_LABELS,
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
              >
                {channelOptions.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel === 'ALL' ? 'Todos canais' : getChannelLabel(channel)}
                  </option>
                ))}
              </select>
              <select
                value={ownershipFilter}
                onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
              >
                <option value="ALL">Toda a equipe</option>
                <option value="MINE">Meus atendimentos</option>
                <option value="UNASSIGNED">Sem responsavel</option>
              </select>
            </div>

            {/* Queue + Refresh */}
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={queueFilter}
                onChange={(event) => setQueueFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
              >
                {queueOptions.map((queue) => (
                  <option key={queue} value={queue}>
                    {queue === 'ALL' ? 'Todas as filas' : queue}
                  </option>
                ))}
              </select>
              <button
                onClick={() => fetchConversations()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              >
                <RefreshCcw size={12} />
                Atualizar
              </button>
            </div>

            {/* Toggle filters */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setWaitingReplyOnly((current) => !current)}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                  waitingReplyOnly
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                )}
              >
                Aguardando
              </button>
              <button
                onClick={() => setUnreadOnly((current) => !current)}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                  unreadOnly
                    ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                )}
              >
                Não lidos
              </button>
              <button
                onClick={() => setWithoutProcessOnly((current) => !current)}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                  withoutProcessOnly
                    ? 'border-violet-400/50 bg-violet-400/15 text-violet-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                )}
              >
                Sem processo
              </button>
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              Nenhum atendimento encontrado.
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const displayName = getConversationDisplayName(conversation);
              const lastMsg =
                conversation.messages?.at(-1)?.content ||
                conversation.lastMessagePreview ||
                '';
              const lastTime =
                conversation.messages?.at(-1)?.createdAt ||
                conversation.lastMessageAt ||
                null;
              const isSelected = selectedConversationId === conversation.id;

              return (
                <button
                  key={conversation.id}
                  onClick={() => selectConversation(conversation.id)}
                  className={clsx(
                    'flex w-full items-center gap-3 border-l-[3px] px-3 py-3 text-left transition',
                    isSelected
                      ? 'border-emerald-400 bg-white/[0.06]'
                      : 'border-transparent hover:bg-white/[0.04]',
                  )}
                >
                  <ConversationAvatar name={displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatTime(lastTime)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <p className="truncate text-xs text-slate-400">
                        {lastMsg || getConversationMeta(conversation)}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-bold text-slate-950">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!selectedConversation ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-xl rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center">
              <MessageCircle className="mx-auto mb-4 text-emerald-300" size={40} />
              <p className="text-lg font-semibold">
                Selecione uma conversa ou crie um novo atendimento.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                O console principal concentra triagem, resposta, responsável, fila e vínculo com
                processo em uma única superfície.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">
                      {getConversationDisplayName(selectedConversation)}
                    </p>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
                      {getStatusLabel(selectedConversation.status)}
                    </span>
                    {selectedConversation.waitingReply && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                        aguardando cliente
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {getConversationMeta(selectedConversation)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {getConversationContext(selectedConversation)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchConversation(selectedConversation.id)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
                  >
                    <RefreshCcw size={16} />
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100 hover:bg-red-500/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  {loadingConversation ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(selectedConversation.messages || []).map((message) => {
                        const isMine = message.direction !== 'INBOUND';
                        return (
                          <div
                            key={message.id}
                            className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={clsx(
                                'max-w-[78%] rounded-3xl px-4 py-3',
                                isMine
                                  ? 'bg-emerald-400 text-slate-950'
                                  : 'border border-white/10 bg-white/5',
                              )}
                            >
                              {message.mediaUrl && message.contentType === 'IMAGE' && (
                                <ProtectedInlineImage mediaUrl={message.mediaUrl} />
                              )}
                              {message.mediaUrl && message.contentType !== 'IMAGE' && (
                                <button
                                  onClick={() =>
                                    message.mediaUrl &&
                                    openProtectedMedia(message.mediaUrl).catch(() =>
                                      toast.error(
                                        'Sem permissão para baixar ou abrir este arquivo.',
                                      ),
                                    )
                                  }
                                  className="mb-3 block w-full rounded-2xl border border-black/10 bg-black/10 px-3 py-2 text-left text-sm hover:bg-black/15"
                                >
                                  Abrir anexo
                                </button>
                              )}
                              <p className="whitespace-pre-wrap text-sm">
                                {message.content || '[sem texto]'}
                              </p>
                              <div
                                className={clsx(
                                  'mt-3 flex items-center justify-between gap-3 text-[11px]',
                                  isMine ? 'text-slate-800/80' : 'text-slate-400',
                                )}
                              >
                                <span>
                                  {message.senderName || (isMine ? 'Equipe DR.X' : 'Contato')}
                                </span>
                                <div className="flex items-center gap-2">
                                  {selectedConversation.process?.id && (
                                    <button
                                      onClick={() => handleLinkMessage(message.id)}
                                      className="rounded-full bg-black/10 px-2 py-1 hover:bg-black/20"
                                    >
                                      Vincular
                                    </button>
                                  )}
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
                  {selectedFile && (
                    <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      {selectedFile.name}
                    </div>
                  )}
                  {sendDiagnostics && (
                    <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      Diagnóstico de envio: rota `
                      {sendDiagnostics.endpoint.split('/api').pop() || sendDiagnostics.endpoint}`,
                      modo `{sendDiagnostics.mode}`, texto `{sendDiagnostics.contentLength}`
                      caractere(s), arquivo `
                      {sendDiagnostics.hasFile ? sendDiagnostics.fileName || 'sim' : 'nao'}`
                      {sendDiagnostics.status ? `, status ${sendDiagnostics.status}` : ''}
                      {sendDiagnostics.error ? `, erro: ${sendDiagnostics.error}` : ''}.
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <label className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
                      <Paperclip size={18} />
                      <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                    <textarea
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      rows={3}
                      placeholder="Digite uma mensagem. Enter envia, Shift + Enter quebra linha."
                      className="min-h-[84px] flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-slate-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!canSendMessage}
                      className="rounded-3xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {sendingMessage ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="hidden w-[340px] shrink-0 border-l border-white/10 bg-slate-950/60 xl:flex xl:min-h-0 xl:flex-col">
                <div className="space-y-4 overflow-y-auto p-5">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      <UserCircle2 size={12} />
                      Responsavel
                    </div>
                    <select
                      value={selectedConversation.assignee?.id || ''}
                      onChange={(event) =>
                        handleUpdateConversation({
                          assignedUserId: event.target.value || null,
                        })
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Sem responsavel</option>
                      {assigneeOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      <CircleDot size={12} />
                      Etapa do funil
                    </div>
                    <select
                      value={selectedConversation.status}
                      onChange={(event) =>
                        handleUpdateConversation({ status: event.target.value })
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    >
                      {ATENDIMENTO_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 grid gap-2">
                      {ATENDIMENTO_STAGE_BUTTONS.map((stage) => (
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

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      <ShieldCheck size={12} />
                      Operacao
                    </div>

                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="mb-2 text-xs text-slate-400">Fila / departamento</p>
                        <input
                          value={queueDraft}
                          onChange={(event) => setQueueDraft(event.target.value)}
                          onBlur={handleQueueSubmit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleQueueSubmit();
                            }
                          }}
                          placeholder="Ex.: Comercial, Jurídico, Financeiro"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <button
                        onClick={() =>
                          handleUpdateConversation({
                            waitingReply: !selectedConversation.waitingReply,
                          })
                        }
                        className={clsx(
                          'rounded-2xl border px-3 py-2 text-left text-sm transition',
                          selectedConversation.waitingReply
                            ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                        )}
                      >
                        {selectedConversation.waitingReply
                          ? 'Marcado como aguardando cliente'
                          : 'Marcar como aguardando cliente'}
                      </button>
                    </div>
                  </div>

                  {selectedConversation.contact ? (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Contato</p>
                      <p className="mt-3 text-sm font-medium">
                        {getConversationDisplayName(selectedConversation)}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {getContactIdentifier(selectedConversation.contact) ||
                          selectedConversation.title ||
                          'Sem identificacao'}
                      </p>
                      {getAdditionalContactIdentifier(selectedConversation.contact, 'EMAIL') && (
                        <p className="mt-1 text-xs text-slate-500">
                          {getAdditionalContactIdentifier(selectedConversation.contact, 'EMAIL')}
                        </p>
                      )}
                      {selectedConversation.connection?.name && (
                        <p className="mt-4 text-xs text-slate-500">
                          Conexão ativa: {selectedConversation.connection.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-amber-400">
                        Contato não identificado
                      </p>
                      {selectedConversation.metadata?.pushName && (
                        <p className="mt-2 text-sm font-medium text-slate-300">
                          {selectedConversation.metadata.pushName as string}
                        </p>
                      )}
                      {(selectedConversation.metadata?.rawLid ||
                        selectedConversation.metadata?.rawRemoteJid) && (
                        <p className="mt-1 text-xs text-slate-500 break-all">
                          {(selectedConversation.metadata.rawLid ||
                            selectedConversation.metadata.rawRemoteJid) as string}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Nenhum cadastro encontrado para esta identidade. Associe manualmente.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleCreateAndAssignContact}
                          disabled={assigningContact}
                          className="flex-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          {assigningContact ? 'Aguarde...' : 'Criar Contato'}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <Search size={14} className="shrink-0 text-slate-500" />
                        <input
                          value={associateSearch}
                          onChange={(e) => setAssociateSearch(e.target.value)}
                          placeholder="Associar a contato existente..."
                          className="w-full bg-transparent text-xs outline-none placeholder:text-slate-500"
                        />
                      </div>
                      {associateResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleAssignContact(result.id)}
                          disabled={assigningContact}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                        >
                          <p className="text-xs font-medium">{result.name}</p>
                          <p className="text-xs text-slate-400">
                            {getContactIdentifier(result) ||
                              result.whatsapp ||
                              result.phone ||
                              result.email ||
                              ''}
                          </p>
                        </button>
                      ))}
                      {selectedConversation.connection?.name && (
                        <p className="mt-3 text-xs text-slate-500">
                          Conexão ativa: {selectedConversation.connection.name}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      Processo principal
                    </p>
                    <p className="mt-3 text-sm">
                      {selectedConversation.process?.cnj ||
                        selectedConversation.process?.title ||
                        'Nao vinculado'}
                    </p>
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <Search size={14} className="text-slate-500" />
                      <input
                        value={processSearch}
                        onChange={(event) => setProcessSearch(event.target.value)}
                        placeholder="Buscar processo"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                      />
                    </div>
                    {processResults.map((process) => (
                      <button
                        key={process.id}
                        onClick={() => {
                          handleUpdateConversation({ processId: process.id });
                          setProcessSearch('');
                          setProcessResults([]);
                        }}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                      >
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

      {showNewConversation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-950 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Novo atendimento</p>
                <p className="text-xs text-slate-400">Criado direto no Inbox oficial do módulo.</p>
              </div>
              <button
                onClick={() => setShowNewConversation(false)}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
              >
                Fechar
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <select
                value={newConversation.channel}
                onChange={(event) =>
                  setNewConversation((current) => ({
                    ...current,
                    channel: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
              >
                <option value="WHATSAPP" className="text-slate-900">WhatsApp</option>
                <option value="EMAIL" className="text-slate-900">E-mail</option>
                <option value="TELEGRAM" className="text-slate-900">Telegram</option>
                <option value="INSTAGRAM" className="text-slate-900">Instagram</option>
                <option value="WEBCHAT" className="text-slate-900">Webchat</option>
              </select>
              <select
                value={newConversation.connectionId}
                onChange={(event) =>
                  setNewConversation((current) => ({
                    ...current,
                    connectionId: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
              >
                <option value="" className="text-slate-900">Escolher instância depois</option>
                {filteredConnectionsModal.map((connection) => (
                  <option key={connection.id} value={connection.id} className="text-slate-900">
                    {connection.name} ({connection.status})
                  </option>
                ))}
                {filteredConnectionsModal.length === 0 && (
                  <option value="" disabled className="text-slate-900 italic">Nenhuma instância de {newConversation.channel.toLowerCase()} encontrada</option>
                )}
              </select>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-slate-500" />
                  <input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Buscar contato..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                </div>
                {contactResults.length > 0 && (
                  <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                    {contactResults.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() =>
                            setNewConversation((current) => ({
                              ...current,
                              contactId: contact.id,
                              title: current.title || contact.name,
                              externalThreadId:
                                current.channel === 'WHATSAPP'
                                  ? getContactWhatsappTarget(contact)
                                  : current.externalThreadId,
                            }))
                        }
                        className={clsx(
                          'w-full rounded-2xl border px-3 py-2 text-left text-sm',
                          newConversation.contactId === contact.id
                            ? 'border-emerald-400/60 bg-emerald-400/10'
                            : 'border-white/10 bg-slate-900',
                        )}
                      >
                        <p>{contact.name}</p>
                        <p className="text-xs text-slate-400">
                          {Array.isArray(contact.additionalContacts) && contact.additionalContacts.length > 0
                            ? contact.additionalContacts[0]?.value || '-'
                            : '-'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                value={newConversation.title}
                onChange={(event) =>
                  setNewConversation((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Titulo interno"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none md:col-span-2"
              />
              <textarea
                value={newConversation.initialMessage}
                onChange={(event) =>
                  setNewConversation((current) => ({
                    ...current,
                    initialMessage: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Mensagem inicial opcional"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none md:col-span-2"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowNewConversation(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateConversation}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Criar atendimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
