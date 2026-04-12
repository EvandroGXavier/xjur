import { FormEvent, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Loader2, RefreshCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../services/api';
import { getChannelLabel } from '../atendimento.shared';

type AuditMessageRow = {
  id: string;
  tenantId?: string | null;
  ticketId?: string | null;
  contactId?: string | null;
  processId?: string | null;
  connectionId?: string | null;
  financialRecordId?: string | null;
  incomingEventId?: string | null;
  channel: string;
  direction: string;
  status: string;
  senderType: string;
  contentType: string;
  content: string;
  textContent?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  externalId?: string | null;
  externalThreadId?: string | null;
  externalParticipantId?: string | null;
  contact?: {
    id: string;
    name: string;
    phone?: string | null;
    whatsapp?: string | null;
  } | null;
  ticket?: {
    id: string;
    title?: string | null;
    status?: string | null;
    queue?: string | null;
  } | null;
  process?: {
    id: string;
    cnj?: string | null;
    code?: string | null;
    title?: string | null;
  } | null;
  connection?: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
};

type AuditResponse = {
  items: AuditMessageRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type FiltersState = {
  search: string;
  channel: string;
  direction: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  channel: 'ALL',
  direction: 'ALL',
  status: 'ALL',
  dateFrom: '',
  dateTo: '',
};

const PAGE_SIZE = 50;

const DIRECTION_LABELS: Record<string, string> = {
  INBOUND: 'Recebida',
  OUTBOUND: 'Enviada',
  INTERNAL: 'Interna',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  SCHEDULED: 'Agendada',
  SENT: 'Enviada',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  PLAYED: 'Ouvida',
  FAILED: 'Falhou',
  RECEIVED: 'Recebida',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const getPreview = (message: AuditMessageRow) => {
  const text = (message.textContent || message.content || '').trim();
  if (text) return text;
  if (message.contentType === 'AUDIO') return 'Mensagem de audio';
  if (message.contentType === 'IMAGE') return 'Imagem enviada';
  if (message.contentType === 'FILE') return 'Arquivo enviado';
  return 'Mensagem sem conteudo textual';
};

const renderTraceValue = (label: string, value?: string | null) => (
  <span
    key={`${label}-${value || 'empty'}`}
    className="inline-flex rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300"
    title={value || `${label} indisponivel`}
  >
    {label}: {value || '--'}
  </span>
);

const getStatusTone = (status: string) => {
  if (status === 'FAILED') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
  if (status === 'READ' || status === 'DELIVERED' || status === 'PLAYED') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  }
  if (status === 'SCHEDULED') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
};

const getDirectionTone = (direction: string) => {
  if (direction === 'INBOUND') return 'border-violet-500/40 bg-violet-500/10 text-violet-100';
  if (direction === 'OUTBOUND') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
};

export function AtendimentoMessagesAuditPage() {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [draftSearch, setDraftSearch] = useState('');
  const [messages, setMessages] = useState<AuditMessageRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  const loadMessages = async (nextPage = page, activeFilters = filters, silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get<AuditResponse>('/tickets/messages/audit', {
        params: {
          ...activeFilters,
          search: activeFilters.search.trim() || undefined,
          channel: activeFilters.channel === 'ALL' ? undefined : activeFilters.channel,
          direction: activeFilters.direction === 'ALL' ? undefined : activeFilters.direction,
          status: activeFilters.status === 'ALL' ? undefined : activeFilters.status,
          dateFrom: activeFilters.dateFrom || undefined,
          dateTo: activeFilters.dateTo || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        },
      });

      setMessages(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total) || 0);
      setPage(Number(response.data?.page) || nextPage);
    } catch {
      toast.error('Falha ao carregar a auditoria de mensagens.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages(1, filters);
  }, [filters]);

  const applySearch = (event?: FormEvent) => {
    event?.preventDefault();
    setPage(1);
    setFilters((current) => ({
      ...current,
      search: draftSearch,
    }));
  };

  const updateFilter = (field: keyof FiltersState, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    loadMessages(nextPage, filters, true);
  };

  const resetFilters = () => {
    setDraftSearch('');
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-cyan-300/70">Auditoria</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Mensagens</h2>
            <p className="mt-1 text-sm text-slate-400">
              Visao temporaria para conferir tudo o que entrou e saiu antes do modulo de atendimento
              assumir o fluxo completo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Total</div>
              <div className="mt-1 text-2xl font-semibold text-white">{total}</div>
            </div>

            <button
              type="button"
              onClick={() => loadMessages(page, filters, true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-400/40 hover:text-white"
            >
              {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Atualizar
            </button>
          </div>
        </div>

        <form onSubmit={applySearch} className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
            <Search size={16} className="text-slate-500" />
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Buscar por contato, ticket, numero, conteudo..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <select
            value={filters.channel}
            onChange={(event) => updateFilter('channel', event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os canais</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
            <option value="INTERNAL">Interno</option>
          </select>

          <select
            value={filters.direction}
            onChange={(event) => updateFilter('direction', event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todas as direcoes</option>
            <option value="INBOUND">Recebidas</option>
            <option value="OUTBOUND">Enviadas</option>
            <option value="INTERNAL">Internas</option>
          </select>

          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="SCHEDULED">Agendada</option>
            <option value="SENT">Enviada</option>
            <option value="DELIVERED">Entregue</option>
            <option value="READ">Lida</option>
            <option value="FAILED">Falhou</option>
            <option value="RECEIVED">Recebida</option>
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          />

          <div className="flex items-center justify-end gap-2 xl:col-span-6">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60">
          <div className="grid grid-cols-[180px_120px_140px_220px_220px_minmax(260px,1fr)_minmax(320px,1.2fr)] gap-4 border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.28em] text-slate-500">
            <span>Data</span>
            <span>Canal</span>
            <span>Direcao</span>
            <span>Contato</span>
            <span>Ticket</span>
            <span>Conteudo</span>
            <span>Rastreio</span>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center text-slate-400">
              <Loader2 className="mr-3 animate-spin" size={18} />
              Carregando mensagens...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-72 items-center justify-center px-6 text-center text-slate-400">
              Nenhuma mensagem encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="grid grid-cols-[180px_120px_140px_220px_220px_minmax(260px,1fr)_minmax(320px,1.2fr)] gap-4 px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="font-medium text-white">{formatDateTime(message.createdAt)}</div>
                    <div className="text-xs text-slate-500">Status: {STATUS_LABELS[message.status] || message.status}</div>
                    {message.sentAt && <div className="text-xs text-slate-500">Envio: {formatDateTime(message.sentAt)}</div>}
                    {message.deliveredAt && (
                      <div className="text-xs text-slate-500">Entrega: {formatDateTime(message.deliveredAt)}</div>
                    )}
                    {message.readAt && <div className="text-xs text-slate-500">Leitura: {formatDateTime(message.readAt)}</div>}
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-100">
                      {getChannelLabel(message.channel)}
                    </span>
                    {message.connection?.name && (
                      <div className="text-xs text-slate-500">{message.connection.name}</div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <span
                      className={clsx(
                        'inline-flex rounded-full border px-2.5 py-1 text-xs font-medium',
                        getDirectionTone(message.direction),
                      )}
                    >
                      {DIRECTION_LABELS[message.direction] || message.direction}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex rounded-full border px-2.5 py-1 text-xs font-medium',
                        getStatusTone(message.status),
                      )}
                    >
                      {STATUS_LABELS[message.status] || message.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="font-medium text-white">{message.contact?.name || 'Sem contato'}</div>
                    <div className="text-xs text-slate-500">
                      {message.contact?.whatsapp || message.contact?.phone || message.externalParticipantId || '--'}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="font-medium text-white">{message.ticket?.title || 'Sem ticket'}</div>
                    <div className="text-xs text-slate-500">
                      {message.ticket?.queue || 'Sem fila'}
                      {message.process?.cnj ? ` • ${message.process.cnj}` : ''}
                      {!message.process?.cnj && message.process?.title ? ` • ${message.process.title}` : ''}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-200">
                    <p className="line-clamp-3 leading-6 text-white">{getPreview(message)}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>ID: {message.id.slice(0, 8)}</span>
                      {message.externalId && <span>Externo: {message.externalId}</span>}
                      {message.contentType !== 'TEXT' && <span>Tipo: {message.contentType}</span>}
                      {message.mediaUrl && <span>Midia anexada</span>}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-200">
                    <div className="flex flex-wrap gap-2">
                      {renderTraceValue('Mensagem', message.id)}
                      {renderTraceValue('Tenant', message.tenantId)}
                      {renderTraceValue('Contato', message.contactId)}
                      {renderTraceValue('Ticket', message.ticketId)}
                      {renderTraceValue('Processo', message.processId)}
                      {renderTraceValue('Conexao', message.connectionId)}
                      {renderTraceValue('Evento', message.incomingEventId)}
                      {renderTraceValue('Financeiro', message.financialRecordId)}
                    </div>

                    <div className="space-y-2 text-xs text-slate-500">
                      <div>
                        Participante externo:{' '}
                        <span className="font-mono text-slate-300">
                          {message.externalParticipantId || '--'}
                        </span>
                      </div>
                      <div>
                        Thread externa:{' '}
                        <span className="font-mono text-slate-300">
                          {message.externalThreadId || '--'}
                        </span>
                      </div>
                      <div>
                        ID externo:{' '}
                        <span className="font-mono text-slate-300">{message.externalId || '--'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4">
        <div className="flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            Pagina {page} de {totalPages} • {total} mensagem(ns) auditadas
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || refreshing}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || refreshing}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
