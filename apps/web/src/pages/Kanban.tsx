import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock3, MessageCircle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../services/api';
import {
  AtendimentoConversation,
  AtendimentoStatus,
  getChannelLabel,
  getConversationDisplayName,
  getStatusLabel,
} from './atendimento/atendimento.shared';

interface KanbanProps {
  onOpenConversation?: (conversationId: string) => void;
}

const COLUMNS: Array<{
  id: AtendimentoStatus;
  title: string;
  description: string;
  color: string;
  icon: typeof AlertCircle;
}> = [
  {
    id: 'OPEN',
    title: 'Triagem',
    description: 'Novas entradas e primeira leitura',
    color: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
    icon: AlertCircle,
  },
  {
    id: 'WAITING',
    title: 'Em Atendimento',
    description: 'Operação ativa da equipe',
    color: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    icon: MessageCircle,
  },
  {
    id: 'RESOLVED',
    title: 'Convertidos',
    description: 'Concluídos ou encaminhados',
    color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    icon: CheckCircle,
  },
  {
    id: 'CLOSED',
    title: 'Encerrados',
    description: 'Fora da fila operacional',
    color: 'bg-slate-500/10 border-slate-500/20 text-slate-300',
    icon: Clock3,
  },
];

export const Kanban: React.FC<KanbanProps> = ({ onOpenConversation }) => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AtendimentoConversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inbox/conversations');
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar os atendimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const conversationsByStatus = useMemo(() => {
    return COLUMNS.reduce<Record<AtendimentoStatus, AtendimentoConversation[]>>(
      (accumulator, column) => {
        accumulator[column.id] = conversations
          .filter((conversation) => conversation.status === column.id)
          .sort((left, right) => {
            const leftTime = new Date(left.lastMessageAt || left.messages?.at(-1)?.createdAt || 0).getTime();
            const rightTime = new Date(right.lastMessageAt || right.messages?.at(-1)?.createdAt || 0).getTime();
            return rightTime - leftTime;
          });
        return accumulator;
      },
      { OPEN: [], WAITING: [], RESOLVED: [], CLOSED: [] },
    );
  }, [conversations]);

  const handleOpenConversation = (conversationId: string) => {
    if (onOpenConversation) {
      onOpenConversation(conversationId);
      return;
    }

    navigate(`/atendimento?view=console&conversationId=${conversationId}`);
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const movedConversation = conversations.find((conversation) => conversation.id === draggableId);
    if (!movedConversation) return;

    const newStatus = destination.droppableId as AtendimentoStatus;

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === draggableId ? { ...conversation, status: newStatus } : conversation,
      ),
    );

    try {
      await api.patch(`/inbox/conversations/${draggableId}`, { status: newStatus });
      toast.success(`Atendimento movido para ${getStatusLabel(newStatus)}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar etapa do atendimento');
      fetchConversations();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 p-6 text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">Quadro operacional</p>
          <h2 className="mt-2 text-2xl font-semibold">Kanban do Atendimento</h2>
          <p className="mt-2 text-sm text-slate-400">
            Esta visão usa a mesma base do Inbox principal. Mover um card aqui altera a etapa real da conversa.
          </p>
        </div>
        <button
          onClick={fetchConversations}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="flex min-w-[320px] flex-1 flex-col rounded-[28px] border border-white/10 bg-white/[0.03]"
            >
              <div className={clsx('border-b border-white/10 p-4', column.color)}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <column.icon size={18} />
                      {column.title}
                    </div>
                    <p className="mt-1 text-xs text-slate-300/80">{column.description}</p>
                  </div>
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-black/20 px-2 py-1 text-xs">
                    {conversationsByStatus[column.id].length}
                  </span>
                </div>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={clsx(
                      'flex-1 space-y-3 overflow-y-auto p-3 transition-colors',
                      snapshot.isDraggingOver ? 'bg-white/[0.04]' : '',
                    )}
                  >
                    {conversationsByStatus[column.id].map((conversation, index) => (
                      <Draggable key={conversation.id} draggableId={conversation.id} index={index}>
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            onClick={() => handleOpenConversation(conversation.id)}
                            className={clsx(
                              'cursor-pointer rounded-3xl border border-white/10 bg-slate-900/90 p-4 transition hover:border-emerald-400/40 hover:bg-slate-900',
                              draggableSnapshot.isDragging && 'rotate-1 border-emerald-400/50 shadow-2xl',
                            )}
                            style={draggableProvided.draggableProps.style}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">
                                  {getConversationDisplayName(conversation)}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {getChannelLabel(conversation.channel)}
                                  {conversation.queue ? ` • ${conversation.queue}` : ''}
                                </p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                                {getStatusLabel(conversation.status)}
                              </span>
                            </div>

                            <p className="mt-3 line-clamp-3 text-sm text-slate-300">
                              {conversation.lastMessagePreview ||
                                conversation.messages?.at(-1)?.content ||
                                'Sem mensagens recentes.'}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {conversation.waitingReply && (
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                                  aguardando cliente
                                </span>
                              )}
                              {conversation.unreadCount > 0 && (
                                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                                  {conversation.unreadCount} não lida(s)
                                </span>
                              )}
                              {!conversation.process?.id && (
                                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                                  sem processo
                                </span>
                              )}
                            </div>

                            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                              <span>{conversation.assignee?.name || 'Sem responsavel'}</span>
                              <span>
                                {conversation.lastMessageAt
                                  ? new Date(conversation.lastMessageAt).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '--:--'}
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};
