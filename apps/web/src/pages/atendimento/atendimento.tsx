
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Paperclip, 
  Send, 
  Mic, 
  CheckCheck, 
  User,
  Gavel,
  FileText,
  Clock,
  Sparkles,
  Archive,
  MessageSquare,
  Zap,
  Kanban as KanbanIcon,
  Tags,
  QrCode,
  Sliders,
  Bot,
  Plus,
  Loader2,
  Trash2,
  ExternalLink,
  Shield,
  Calendar,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../../components/ui/Badge';
import { QuickReplies } from './components/QuickReplies';
import { KanbanBoard } from './components/Kanban';
import { Connections } from './components/Connections';
import { TagsManager } from './components/Tags';
import { AtendimentoSettings } from './components/Settings';
import { ConfiguracoesWhatsapp } from './components/ConfiguracoesWhatsapp';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTicketSocket } from '../../hooks/useTicketSocket';
import { NewTicketModal } from './components/NewTicketModal';
import { AudioRecorder } from './components/AudioRecorder';
// =========================
// INTERFACES
// =========================
interface Ticket {
  id: string;
  code: number;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  channel: 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEBCHAT';
  contactId?: string;
  contact?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    category?: string;
    profilePicUrl?: string;
  };
  assigneeId?: string;
  queue?: string;
  messages?: TicketMessage[];
  _count?: { messages: number };
  updatedAt: string;
  createdAt: string;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: 'USER' | 'CONTACT' | 'SYSTEM';
  senderId?: string;
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';
  mediaUrl?: string;
  readAt?: string;
  createdAt: string;
}

interface ContactProcess {
  id: string;
  title?: string;
  code?: string;
  cnj?: string;
  status: string;
  area?: string;
  category: string;
}

type Module = 'chats' | 'quick_replies' | 'kanban' | 'tags' | 'connections' | 'settings' | 'bot' | 'security';
type TabFilter = 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

// =========================
// MAIN COMPONENT
// =========================
const getMediaUrl = (path: string | null) => {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('http')) return path;
  return `http://localhost:3000/${path.replace(/\\/g, '/')}`;
};

export function AtendimentoPage() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<Module>('chats');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [contactProcesses, setContactProcesses] = useState<ContactProcess[]>([]);
  
  // Loading States
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  // =========================
  // DERIVED STATE
  // =========================
  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || null;

  const filteredTickets = tickets.filter(t => {
    // If we have a selected ticket, we might want to ensure it's visible? Or not necessarily.
    // For now, simple search.
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    
    return (
      (t.contact?.name || '').toLowerCase().includes(term) ||
      (t.title || '').toLowerCase().includes(term) ||
      (t.contact?.phone || '').includes(term) ||
      (t.contact?.whatsapp || '').includes(term) ||
      (String(t.code) || '').includes(term)
    );
  });

  // Audio Handler
  const handleSendAudio = useCallback(async (blob: Blob) => {
    if (!selectedTicket) return;
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}`;
    const newMessage: TicketMessage = {
        id: tempId,
        ticketId: selectedTicket.id,
        senderType: 'USER',
        senderId: 'ME',
        content: '',
        contentType: 'AUDIO',
        mediaUrl: URL.createObjectURL(blob),
        createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setIsRecording(false);
    
    // Upload logic
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('contentType', 'AUDIO');
    
    try {
        await api.post(`/tickets/${selectedTicket.id}/messages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    } catch (error) {
        console.error("Failed to send audio", error);
        toast.error("Falha ao enviar áudio");
        setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [selectedTicket]);

  const handleDeleteMessage = async (messageId: string) => {
      if (!window.confirm('Apagar mensagem para todos?')) return;

      try {
          setMessages(prev => prev.filter(m => m.id !== messageId));
          // Assuming endpoint exists. If not, it will fail silently in optimistic UI but log error.
          await api.delete(`/tickets/messages/${messageId}`); 
      } catch (error) {
          console.error("Erro ao apagar", error);
          toast.error("Erro ao apagar mensagem");
          // fetchMessages(); // Can't easily call fetchMessages here due to deps, but socket should sync.
      }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // WebSocket hook — replaces polling
  const { isConnected: socketConnected, on: onSocketEvent } = useTicketSocket();
  // =========================
  // DATA FETCHING
  // =========================
  const fetchTickets = useCallback(async () => {
    try {
      const params: any = {};
      if (activeTab !== 'all') params.status = activeTab;
      
      const res = await api.get('/tickets', { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setTickets(data);
      
      // If selected ticket no longer exists in list, clear
      if (selectedTicketId && !data.find((t: Ticket) => t.id === selectedTicketId)) {
        // Keep selection, it may be in another tab
      }
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  }, [activeTab, selectedTicketId]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      setLoadingMessages(true);
      const res = await api.get(`/tickets/${ticketId}`);
      setMessages(res.data.messages || []);
      
      // Also fetch contact processes if contact has data
      if (res.data.contact?.id) {
        fetchContactProcesses(res.data.contact.id);
      }
      
      // 📨 Mark messages as read in WhatsApp
      api.post(`/tickets/${ticketId}/read`).catch(() => {});

    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar conversa');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchContactProcesses = async (contactId: string) => {
    try {
      const res = await api.get('/processes', { params: { contactId } });
      setContactProcesses(Array.isArray(res.data) ? res.data : []);
    } catch {
      setContactProcesses([]);
    }
  };

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {
    fetchTickets();
  }, [activeTab]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchMessages(selectedTicketId);
    } else {
      setMessages([]);
      setContactProcesses([]);
    }
  }, [selectedTicketId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // =========================
  // WEBSOCKET: Real-time events (replaces polling)
  // =========================
  useEffect(() => {
    // 🆕 New ticket created (by any user in the same tenant)
    const unsubNew = onSocketEvent('ticket:new', (ticket: Ticket) => {
      setTickets(prev => {
        // Avoid duplicates
        if (prev.find(t => t.id === ticket.id)) return prev;
        return [ticket, ...prev];
      });
    });

    // 🔄 Ticket updated (status, assignment, new message count, etc)
    const unsubUpdated = onSocketEvent('ticket:updated', (ticket: Ticket) => {
      setTickets(prev =>
        prev.map(t => (t.id === ticket.id ? { ...t, ...ticket } : t))
      );
    });

    // 💬 New message on a ticket
    const unsubMessage = onSocketEvent(
      'ticket:message',
      (data: { ticketId: string; message: TicketMessage }) => {
        if (data.ticketId === selectedTicketId) {
          setMessages(prev => {
            // Avoid duplicates & replace temp messages
            const filtered = prev.filter(
              m => m.id !== data.message.id && !m.id.startsWith('temp-'),
            );
            // Only add if not already present
            if (filtered.find(m => m.id === data.message.id)) return filtered;
            return [...filtered, data.message];
          });
        }
      },
    );

    // ⚠️ Error on ticket (e.g. WhatsApp failed)
    const unsubError = onSocketEvent('ticket:error', (error: any) => {
      // Only show if relevant to current user (global toast is fine too, but filter by ticket is better context)
      if (!selectedTicketId || error.ticketId === selectedTicketId) {
         toast.error(error.message, { duration: 5000 });
         
         // If send error, remove temp message or mark as failed (advanced)
         if (error.code === 'SEND_ERROR') {
            setMessages(prev => prev.map(m => 
                m.ticketId === error.ticketId ? { ...m, status: 'FAILED' } : m
            ));
         }
      }
    });

    // ✅ Message Status Update (Blue Ticks)
    const unsubStatus = onSocketEvent('message:status', (data: { ticketId: string; messageId: string; status: string }) => {
        if (data.ticketId === selectedTicketId) {
            setMessages(prev => prev.map(m => {
                if (m.id === data.messageId) {
                    return { ...m, status: data.status, readAt: data.status === 'READ' ? new Date().toISOString() : m.readAt };
                }
                return m;
            }));
        }
    });

    // 🗑️ Message Deleted (Remote)
    const unsubDeleted = onSocketEvent('message:deleted', (data: { ticketId: string; messageId: string }) => {
        if (data.ticketId === selectedTicketId) {
             setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
    });

    return () => {
      unsubNew();
      unsubUpdated();
      unsubMessage();
      unsubError();
      unsubDeleted();
    };
  }, [onSocketEvent, selectedTicketId]);

  // =========================
  // ACTIONS
  // =========================
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !selectedTicketId) return;

    const content = messageInput.trim();
    const tempId = 'temp-' + Date.now();

    // Optimistic update
    const tempMsg: TicketMessage = {
      id: tempId,
      ticketId: selectedTicketId,
      senderType: 'USER',
      content: selectedFile ? (content || selectedFile.name) : content,
      contentType: selectedFile ? (selectedFile.type.startsWith('image/') ? 'IMAGE' : 'FILE') : 'TEXT',
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setMessageInput('');
    setSelectedFile(null); // Clear file immediately from UI
    setSendingMessage(true);

    try {
      if (selectedFile) {
          const formData = new FormData();
          formData.append('content', content);
          formData.append('file', selectedFile);
          if (scheduledAt) formData.append('scheduledAt', scheduledAt);
          
          await api.post(`/tickets/${selectedTicketId}/messages`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
      } else {
          await api.post(`/tickets/${selectedTicketId}/messages`, { 
              content,
              scheduledAt: scheduledAt || undefined
          });
      }

      if (scheduledAt) {
          toast.success(`Mensagem agendada para ${new Date(scheduledAt).toLocaleString()}`);
          setScheduledAt(null);
      }

      // WebSocket will deliver the real message via ticket:message event.
      // Only fetch as fallback if socket is disconnected.
      if (!socketConnected) {
        await fetchMessages(selectedTicketId);
        fetchTickets();
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar mensagem');
      // Rollback
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setMessageInput(content);
      if (tempMsg.contentType !== 'TEXT') toast.error('Falha no envio do arquivo');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);
          // Optional: Auto-send or show preview. For now, just focus input expecting user to type caption or send.
          // But to make it obvious, let's just toast
          toast.info(`Arquivo selecionado: ${e.target.files[0].name}`);
      }
  };

  const handleCreateTicket = async () => {
    const title = prompt('Nome do atendimento:');
    if (!title) return;

    try {
      const res = await api.post('/tickets', {
        title,
        channel: 'WHATSAPP',
        priority: 'MEDIUM',
        queue: 'COMERCIAL',
      });
      toast.success('Atendimento criado!');
      await fetchTickets();
      setSelectedTicketId(res.data.id);
    } catch (error: any) {
      toast.error('Erro ao criar atendimento: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status });
      toast.success('Status atualizado');
      fetchTickets();
      if (ticketId === selectedTicketId) {
        fetchMessages(ticketId);
      }
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };



  // =========================
  // HELPERS
  // =========================
  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffHours < 48) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'OPEN': return 'Aberto';
      case 'IN_PROGRESS': return 'Em Atendimento';
      case 'WAITING': return 'Aguardando';
      case 'RESOLVED': return 'Resolvido';
      case 'CLOSED': return 'Fechado';
      default: return s;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'WHATSAPP': return <MessageSquare size={12} className="text-emerald-400" />;
      case 'EMAIL': return <MessageSquare size={12} className="text-blue-400" />;
      default: return <MessageSquare size={12} className="text-slate-400" />;
    }
  };



  // =========================
  // RENDER: Module Content (Left Panel)
  // =========================
  const renderModuleContent = () => {
    switch (activeModule) {
      case 'chats':
        return (
          <div className="w-80 md:w-96 flex flex-col border-r border-slate-800 bg-slate-900/50">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="text-indigo-500" size={24} />
                  Atendimentos
                  <span
                    title={socketConnected ? 'Tempo real ativo' : 'Reconectando...'}
                    className={clsx(
                      "w-2 h-2 rounded-full inline-block ml-1",
                      socketConnected
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-red-400"
                    )}
                  />
                </h2>
                <button 
                  onClick={() => setShowNewTicketModal(true)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition"
                  title="Novo Atendimento"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, telefone..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                />
              </div>

              <div className="flex mt-4 gap-1 p-1 bg-slate-800 rounded-lg">
                {([
                  { value: 'all' as TabFilter, label: 'Todos' },
                  { value: 'OPEN' as TabFilter, label: 'Fila' },
                  { value: 'IN_PROGRESS' as TabFilter, label: 'Ativos' },
                  { value: 'RESOLVED' as TabFilter, label: 'Feitos' },
                ]).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={clsx(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all uppercase tracking-wide",
                      activeTab === tab.value
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loadingTickets && tickets.length === 0 && (
                <div className="p-8 flex flex-col items-center justify-center text-slate-500">
                  <Loader2 size={24} className="animate-spin mb-2" />
                  <span className="text-sm">Carregando...</span>
                </div>
              )}

              {!loadingTickets && filteredTickets.length === 0 && (
                <div className="p-8 flex flex-col items-center text-center text-slate-500">
                  <MessageSquare size={32} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium">Nenhum atendimento encontrado</p>
                  <p className="text-xs mt-1">Clique em + para iniciar um novo.</p>
                </div>
              )}

              {filteredTickets.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={clsx(
                    "p-4 border-b border-slate-800 cursor-pointer transition-colors relative group",
                    selectedTicketId === ticket.id 
                      ? "bg-slate-800/80 border-l-4 border-l-indigo-500" 
                      : "hover:bg-slate-800/30 border-l-4 border-l-transparent"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold overflow-hidden border border-slate-700">
                          {ticket.contact?.profilePicUrl ? (
                            <img src={ticket.contact.profilePicUrl} alt={ticket.contact.name} className="w-full h-full object-cover" />
                          ) : ticket.contact?.name ? (
                            <span className="text-sm">{ticket.contact.name.substring(0, 2).toUpperCase()}</span>
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        {/* Priority dot */}
                        <div className={clsx("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900", getPriorityColor(ticket.priority))} />
                      </div>
                      <div className="min-w-0">
                        <h3 className={clsx("font-semibold text-sm truncate", selectedTicketId === ticket.id ? "text-white" : "text-slate-200")}>
                          {ticket.contact?.name || ticket.title}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getChannelIcon(ticket.channel)}
                          <span className="text-[10px] text-slate-500 font-mono">#{ticket.code || ticket.id.substring(0, 6)}</span>
                          {ticket.queue && (
                            <span className="text-[9px] bg-slate-700/50 text-slate-400 px-1 py-0.5 rounded uppercase">{ticket.queue}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">{formatTime(ticket.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-2 pl-[52px]">
                    {ticket._count?.messages ? `${ticket._count.messages} mensagens` : 'Sem mensagens'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'quick_replies':
        return <QuickReplies />;
      case 'kanban':
        return <KanbanBoard />;
      case 'connections':
        return <Connections />;
      case 'tags':
        return <TagsManager />;
      case 'settings':
        return <AtendimentoSettings />;
      case 'security':
        return <ConfiguracoesWhatsapp />;
      case 'bot':
        return (
          <div className="flex-1 flex flex-col bg-slate-950 p-8 items-center justify-center text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
              <Bot size={40} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Chatbots & Automação</h3>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              Configure fluxos automáticos de atendimento, triagem por IA e respostas inteligentes baseadas no contexto jurídico.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">0</div>
                <div className="text-xs text-slate-400 mt-1">Bots Ativos</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-400">0</div>
                <div className="text-xs text-slate-400 mt-1">Fluxos Criados</div>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-6">🚧 Módulo em desenvolvimento — Em breve!</p>
          </div>
        );
      default:
        return null;
    }
  };

  // =========================
  // RENDER: MAIN
  // =========================
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-slate-950 overflow-hidden text-slate-200">
      
      {/* Mini Sidebar (Module Nav) */}
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-2 z-20 shadow-xl">
        <ModuleButton active={activeModule === 'chats'} icon={MessageSquare} label="Atendimentos" onClick={() => setActiveModule('chats')} />
        <ModuleButton active={activeModule === 'quick_replies'} icon={Zap} label="Respostas Rápidas" onClick={() => setActiveModule('quick_replies')} />
        <ModuleButton active={activeModule === 'kanban'} icon={KanbanIcon} label="Kanban" onClick={() => setActiveModule('kanban')} />
        <div className="h-px w-8 bg-slate-800 my-2"></div>
        <ModuleButton active={activeModule === 'tags'} icon={Tags} label="Etiquetas" onClick={() => setActiveModule('tags')} color="text-pink-400" />
        <ModuleButton active={activeModule === 'bot'} icon={Bot} label="Chatbots" onClick={() => setActiveModule('bot')} color="text-cyan-400" />
        <ModuleButton active={activeModule === 'connections'} icon={QrCode} label="Conexões" onClick={() => setActiveModule('connections')} color="text-emerald-400" />
        <ModuleButton active={activeModule === 'security'} icon={Shield} label="Segurança WhatsApp" onClick={() => setActiveModule('security')} color="text-blue-400" />
        <div className="flex-1"></div>
        <ModuleButton active={activeModule === 'settings'} icon={Sliders} label="Configurações" onClick={() => setActiveModule('settings')} />
      </div>

      {/* Module Content (List or Full Page) */}
      {activeModule === 'chats' ? (
        renderModuleContent()
      ) : (
        <div className="flex-1 overflow-hidden h-full">
           {renderModuleContent()}
        </div>
      )}

      {/* Center: Chat Area - Only visible in Chat Module */}
      {activeModule === 'chats' && (
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          {selectedTicket ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-200 font-bold border border-indigo-500/30 overflow-hidden">
                  {selectedTicket.contact?.profilePicUrl ? (
                    <img src={selectedTicket.contact.profilePicUrl} alt={selectedTicket.contact.name} className="w-full h-full object-cover" />
                  ) : selectedTicket.contact?.name ? (
                    <span className="text-sm">{selectedTicket.contact.name.substring(0, 2).toUpperCase()}</span>
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white">{selectedTicket.contact?.name || selectedTicket.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                      selectedTicket.status === 'OPEN' ? "bg-emerald-500/10 text-emerald-400" :
                      selectedTicket.status === 'IN_PROGRESS' ? "bg-indigo-500/10 text-indigo-400" :
                      selectedTicket.status === 'WAITING' ? "bg-amber-500/10 text-amber-400" :
                      selectedTicket.status === 'RESOLVED' ? "bg-slate-500/10 text-slate-400" :
                      "bg-slate-500/10 text-slate-400"
                    )}>
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                    {selectedTicket.contact?.phone && (
                      <span className="text-xs text-slate-500">{selectedTicket.contact.phone}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                {/* Status Actions */}
                {selectedTicket.status === 'OPEN' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition font-medium"
                  >
                    Atender
                  </button>
                )}
                {selectedTicket.status === 'IN_PROGRESS' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition font-medium"
                  >
                    Resolver
                  </button>
                )}
                <button className="hover:text-white transition p-2 hover:bg-slate-800 rounded-full"><Phone size={20} /></button>
                <button className="hover:text-white transition p-2 hover:bg-slate-800 rounded-full"><Video size={20} /></button>
                <button className="hover:text-white transition p-2 hover:bg-slate-800 rounded-full"><MoreVertical size={20} /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" 
              style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundBlendMode: 'overlay', backgroundSize: '200px' }}
            >
              {loadingMessages && messages.length === 0 && (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-slate-500" />
                </div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <MessageSquare size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma mensagem nesta conversa.</p>
                  <p className="text-xs mt-1">Seja o primeiro a enviar!</p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.senderType === 'USER';
                const isSystem = msg.senderType === 'SYSTEM';
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="text-[10px] text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={clsx("flex gap-3", isMe ? "justify-end" : "justify-start items-end")}>
                    {!isMe && (
                       <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-700">
                          {selectedTicket.contact?.profilePicUrl ? (
                            <img src={selectedTicket.contact.profilePicUrl} alt="Foto" className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-slate-500" />
                          )}
                       </div>
                    )}
                    <div className={clsx(
                      "max-w-[70%] rounded-2xl p-4 shadow-md relative group transition-all hover:shadow-lg",
                      isMe 
                        ? "bg-indigo-600 text-white rounded-br-none" 
                        : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700",
                      msg.id.startsWith('temp-') && "opacity-70"
                    )}>
                      {isMe && !isSystem && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1.5 shadow-md transition-all hover:bg-red-600 scale-75 hover:scale-100 z-10"
                              title="Apagar para todos"
                          >
                              <Trash2 size={12} />
                          </button>
                      )}

                      {/* Content Renderer */}
                      {msg.contentType === 'AUDIO' ? (
                          <div className="flex items-center gap-2 min-w-[200px]">
                              <audio controls src={getMediaUrl(msg.mediaUrl)} className="w-full h-8 accent-indigo-500" />
                          </div>
                      ) : msg.contentType === 'IMAGE' ? (
                          <div className="space-y-2">
                              {msg.mediaUrl && (
                                <img src={getMediaUrl(msg.mediaUrl)} alt="Imagem" className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition border border-white/10" onClick={() => window.open(getMediaUrl(msg.mediaUrl), '_blank')} />
                              )}
                              {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                          </div>
                      ) : (msg.contentType === 'FILE' || msg.contentType === 'DOCUMENT') ? (
                           <div className="flex items-center gap-2 bg-black/20 p-3 rounded-lg cursor-pointer hover:bg-black/30 transition border border-white/10" onClick={() => window.open(getMediaUrl(msg.mediaUrl), '_blank')}>
                               <FileText size={24} className="text-indigo-300" />
                               <div className="overflow-hidden">
                                  <span className="text-sm font-medium truncate block max-w-[200px]">{msg.content || 'Arquivo Anexo'}</span>
                                  <span className="text-xs text-indigo-300 opacity-70">Clique para baixar</span>
                               </div>
                           </div>
                      ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}

                      <div className={clsx("flex items-center justify-end gap-1 mt-1", isMe ? "text-indigo-200" : "text-slate-500")}>
                        <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <CheckCheck size={14} className={clsx(
                            msg.id.startsWith('temp-') ? 'text-indigo-300' : 'text-emerald-300'
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
              {isRecording ? (
                  <AudioRecorder 
                      onSend={handleSendAudio}
                      onCancel={() => setIsRecording(false)}
                  />
              ) : (
                  <>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileSelect} 
                      />
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className={clsx(
                              "p-2 rounded-full transition",
                              selectedFile ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                          )}
                          title="Anexar arquivo"
                      >
                        <Paperclip size={20} />
                      </button>
                      
                      <div className="flex-1 bg-slate-800 rounded-xl flex items-center px-4 py-2 border border-slate-700 focus-within:border-indigo-500 transition-colors">
                        <input 
                          type="text" 
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder={selectedFile ? `Arquivo: ${selectedFile.name} (Adicione uma legenda...)` : "Digite sua mensagem..."}
                          className="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 text-sm focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={sendingMessage}
                        />
                        
                        {(messageInput.trim() || selectedFile) && (
                            <div className="flex items-center gap-1">
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                                        className={clsx(
                                            "p-1.5 rounded-lg transition hover:bg-slate-700",
                                            scheduledAt ? "text-amber-400" : "text-slate-400 hover:text-indigo-400"
                                        )}
                                        title="Agendar Mensagem"
                                    >
                                        <Calendar size={18} />
                                    </button>

                                    {showSchedulePicker && (
                                        <div className="absolute bottom-full right-0 mb-4 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2 w-72">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Clock size={14} className="text-indigo-400" />
                                                    Agendar Envio
                                                </h4>
                                                <button onClick={() => setShowSchedulePicker(false)}>
                                                    <X size={16} className="text-slate-500 hover:text-white" />
                                                </button>
                                            </div>
                                            <input 
                                                type="datetime-local" 
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 mb-3"
                                                min={new Date().toISOString().slice(0, 16)}
                                                onChange={(e) => setScheduledAt(e.target.value)}
                                            />
                                            <p className="text-[10px] text-slate-500 mb-3 leading-tight">
                                                A mensagem será disparada após o horário selecionado.
                                            </p>
                                            <button 
                                                onClick={() => setShowSchedulePicker(false)}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition"
                                            >
                                                Confirmar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleSendMessage}
                                    disabled={sendingMessage}
                                    className={clsx(
                                        "p-1.5 rounded-lg transition text-indigo-400 hover:bg-slate-700",
                                        sendingMessage && "opacity-50 cursor-wait"
                                    )}
                                >
                                    {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                        )}
                      </div>

                      {scheduledAt && (
                          <div className="absolute -top-10 left-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] px-2 py-1 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                              <Calendar size={10} /> Agendado: {new Date(scheduledAt).toLocaleString()}
                              <button onClick={() => setScheduledAt(null)} className="hover:text-amber-400">
                                  <X size={10} />
                              </button>
                          </div>
                      )}

                      {(!messageInput.trim() && !selectedFile) && (
                        <button 
                            onClick={() => setIsRecording(true)} 
                            className="text-slate-400 hover:text-red-400 p-2 hover:bg-slate-800 rounded-full transition transform active:scale-95"
                            title="Gravar áudio"
                        >
                            <Mic size={20} />
                        </button>
                      )}
                  </>
              )}
            </div>
          </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
              <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
                <MessageSquare size={48} className="text-slate-700" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">CRM DR.X</h3>
              <p className="text-slate-400 max-w-sm">Selecione uma conversa para iniciar o atendimento ou busque um contato.</p>
              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => setShowNewTicketModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={16} /> Novo Atendimento
                </button>
              </div>
              <div className="mt-8 flex gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Gavel size={12} /> Integração Jurídica Total</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right Panel: DR.X Intelligence */}
      {activeModule === 'chats' && selectedTicket && (
        <div className="w-72 hidden xl:flex flex-col border-l border-slate-800 bg-slate-900/30">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              DR.X Intelligence
            </h3>
          </div>


          <div className="p-4 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
            
            {/* Widget: Contexto do Cliente */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase">Contexto do Cliente</h4>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium truncate">
                    {selectedTicket.contact?.name || 'Contato não identificado'}
                  </span>
                  <Badge variant={selectedTicket.contact?.category === 'Cliente' ? "success" : "default"}>
                    {selectedTicket.contact?.category || 'N/D'}
                  </Badge>
                </div>
                {selectedTicket.contact?.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Phone size={12} /> {selectedTicket.contact.phone}
                  </div>
                )}
                {selectedTicket.contact?.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <MessageSquare size={12} /> {selectedTicket.contact.email}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock size={12} /> Ticket criado: {formatTime(selectedTicket.createdAt)}
                </div>
                {selectedTicket.contact?.id && (
                  <button 
                    onClick={() => navigate(`/contacts/${selectedTicket.contact!.id}`)}
                    className="mt-2 w-full py-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-md hover:bg-indigo-500/10 transition flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={12} /> Ver Ficha Completa
                  </button>
                )}
              </div>
            </div>

            {/* Widget: Resumo Inteligente */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
                Resumo Inteligente
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded">BETA</span>
              </h4>
              <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 rounded-lg p-3 border border-indigo-500/20 shadow-inner">
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  {messages.length > 0 
                    ? `"Conversa com ${messages.length} mensagen${messages.length !== 1 ? 's' : ''}. Canal: ${selectedTicket.channel}. Prioridade: ${selectedTicket.priority}. ${selectedTicket.queue ? `Departamento: ${selectedTicket.queue}.` : ''}"` 
                    : '"Conversa sem mensagens. Aguardando primeiro contato."'
                  }
                </p>
              </div>
            </div>

            {/* Widget: Processos Vinculados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase">Processos Ativos</h4>
                {contactProcesses.length > 0 && (
                  <button 
                    onClick={() => navigate('/processes')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                {contactProcesses.length > 0 ? (
                  contactProcesses.slice(0, 3).map(proc => (
                    <div 
                      key={proc.id} 
                      onClick={() => navigate(`/processes/${proc.id}`)}
                      className={clsx(
                        "bg-slate-800 rounded-lg p-3 border-l-2 hover:bg-slate-700 transition cursor-pointer group",
                        proc.category === 'JUDICIAL' ? "border-indigo-500" : "border-amber-500"
                      )}
                    >
                      <div className="text-xs font-bold text-slate-200 mb-1 group-hover:text-indigo-300 transition-colors">
                        {proc.title || proc.code || 'Processo'}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">{proc.cnj || proc.code || proc.id.substring(0, 8)}</span>
                        {proc.category === 'JUDICIAL' ? <Gavel size={10} /> : <FileText size={10} />}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">
                    {selectedTicket.contact?.id ? 'Nenhum processo vinculado.' : 'Contato não identificado.'}
                  </p>
                )}
              </div>
              
              <button 
                onClick={() => navigate('/processes/new')}
                className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 hover:text-white hover:border-slate-500 transition flex items-center justify-center gap-2"
              >
                <Gavel size={12} /> Vincular Processo
              </button>
            </div>

            {/* Widget: Quick Actions */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Ações Rápidas</h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => navigate('/agenda')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg text-xs flex flex-col items-center gap-1 transition"
                >
                  <Clock size={16} className="text-amber-400" /> Agendar
                </button>
                <button 
                  onClick={() => selectedTicket && handleUpdateStatus(selectedTicket.id, 'CLOSED')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg text-xs flex flex-col items-center gap-1 transition"
                >
                  <Archive size={16} className="text-emerald-400" /> Arquivar
                </button>
                <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg text-xs flex flex-col items-center gap-1 transition col-span-2">
                  <FileText size={16} className="text-indigo-400" /> Gerar Proposta
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      <NewTicketModal 
        open={showNewTicketModal} 
        onClose={() => setShowNewTicketModal(false)} 
        onSuccess={(id) => {
            fetchTickets();
            setSelectedTicketId(id);
        }} 
      />
    </div>
  );
}

// =========================
// SUB-COMPONENTS
// =========================
function ModuleButton({ icon: Icon, label, active, onClick, color }: { icon: any, label: string, active: boolean, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "p-3 rounded-xl transition-all group relative flex items-center justify-center",
        active ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
      title={label}
    >
      <Icon size={22} className={clsx(active ? "text-white" : (color || "text-slate-400 group-hover:text-white"))} />
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-r-lg"></div>}
    </button>
  );
}
