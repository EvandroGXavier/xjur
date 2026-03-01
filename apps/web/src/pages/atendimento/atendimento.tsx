import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Paperclip, 
  Send, 
  Mic, 
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
  ShieldCheck,
  X,
  Info,
  EyeOff,
  List,
  CheckSquare,
  VolumeX,
  ChevronDown,
  Clock,
  Calendar,
  Layout
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
import { MessageBubble } from './components/MessageBubble';
import { InfoPanel } from './components/InfoPanel';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpAtendimento } from '../../data/helpManuals';

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
  waitingReply?: boolean;
  lastMessageAt?: string;
  lastMessageAt?: string;
  scheduledTo?: string;
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
  status?: string;
  quotedId?: string;
  reactions?: any;
  externalId?: string;
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

// =========================
// UTILS
// =========================
const getMediaUrl = (path: string | null) => {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('http')) return path;
  
  // Normalizar barras para o browser
  const cleanPath = path.replace(/\\/g, '/');
  
  // Garantir que não comece com barra pois vamos concatenar com baseUrl que pode ou não ter slash
  const finalPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;

  // Limpar prefixo api/ se existir na baseURL para pegar a raiz do server
  const baseUrl = (api.defaults.baseURL || '').replace(/\/api\/?$/, '') || 'http://localhost:3000';
  
  const fullUrl = `${baseUrl}/${finalPath}`;
  // console.log('DEBUG Media URL:', fullUrl); // Útil para debugar no console do browser
  return fullUrl;
};

// =========================
// MAIN COMPONENT
// =========================
export function AtendimentoPage() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<Module>('chats');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'aberto' | 'atendendo' | 'agenda' | 'fechado' | 'todos'>('aberto');
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();

  // Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [contactProcesses, setContactProcesses] = useState<ContactProcess[]>([]);
  
  // UI States
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [typingContactIds, setTypingContactIds] = useState<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // WebSocket
  const { isConnected: socketConnected, on: onSocketEvent } = useTicketSocket();

  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || null;

  // =========================
  // LOGIC: Filter
  // =========================
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = (t.contact?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.contact?.phone || '').includes(searchTerm);
    
    if (!matchesSearch) return false;

    // Se "todos", retorna tudo (menos os search que já foram aplicados)
    if (filterCategory === 'todos') return true;

    // Se estiver agendado para o futuro
    const isScheduled = !!t.scheduledTo && new Date(t.scheduledTo) > new Date();

    if (filterCategory === 'agenda') {
        return isScheduled; // Só aceita os do futuro
    } else {
        // Se a aba não for agenda, obrigatoriamente data não chegou ou é nula
        if (isScheduled) return false;
    }

    if (filterCategory === 'atendendo') return t.status === 'IN_PROGRESS';
    if (filterCategory === 'aberto') return t.status === 'WAITING' || t.status === 'OPEN';
    if (filterCategory === 'fechado') return t.status === 'RESOLVED' || t.status === 'CLOSED';

    return true;
  });

  // =========================
  // ACTIONS
  // =========================
  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      setLoadingMessages(true);
      const res = await api.get(`/tickets/${ticketId}`);
      setMessages(res.data.messages || []);
      if (res.data.contact?.id) fetchContactProcesses(res.data.contact.id);
      api.post(`/tickets/${ticketId}/read`).catch(() => {});
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
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

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !selectedTicketId) return;

    const content = messageInput.trim();
    const tempId = 'temp-' + Date.now();
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
    setSelectedFile(null);
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
          await api.post(`/tickets/${selectedTicketId}/messages`, { content, scheduledAt: scheduledAt || undefined });
      }

      if (scheduledAt) {
          toast.success(`Agendado para ${new Date(scheduledAt).toLocaleString()}`);
          setScheduledAt(null);
      }
    } catch (error) {
      toast.error('Erro ao enviar');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendAudio = useCallback(async (blob: Blob) => {
    if (!selectedTicketId) return;
    const tempId = `temp-${Date.now()}`;
    
    // UI Optimistic
    setMessages(p => [...p, { 
      id: tempId, 
      ticketId: selectedTicketId, 
      senderType: 'USER', 
      content: '', 
      contentType: 'AUDIO', 
      mediaUrl: URL.createObjectURL(blob), 
      createdAt: new Date().toISOString() 
    } as TicketMessage]);
    
    setIsRecording(false);
    
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('contentType', 'AUDIO');
    formData.append('content', ''); // Campo obrigatório no DTO se validado

    try {
        await api.post(`/tickets/${selectedTicketId}/messages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    } catch (err) {
        console.error("Erro ao enviar áudio:", err);
        toast.error("Falha ao enviar áudio");
        setMessages(p => p.filter(m => m.id !== tempId));
    }
  }, [selectedTicketId]);

  const handleDeleteMessage = async (messageId: string) => {
      if (!window.confirm('Apagar para todos?')) return;
      try {
          setMessages(prev => prev.filter(m => m.id !== messageId));
          await api.delete(`/tickets/messages/${messageId}`); 
      } catch {
          toast.error("Erro ao apagar");
      }
  };

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status });
      toast.success('Status atualizado');
      fetchTickets();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleUpdateSchedule = async (ticketId: string, scheduledTo: string | null) => {
    try {
      await api.patch(`/tickets/${ticketId}`, { scheduledTo });
      toast.success(scheduledTo ? 'Atendimento Agendado' : 'Agendamento removido');
      fetchTickets();
    } catch {
      toast.error('Erro ao agendar atendimento');
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (selectedTicketId) fetchMessages(selectedTicketId);
    else { setMessages([]); setContactProcesses([]); }
  }, [selectedTicketId, fetchMessages]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const u1 = onSocketEvent('ticket:new', (ticket: Ticket) => setTickets(p => p.find(t => t.id === ticket.id) ? p : [ticket, ...p]));
    const u2 = onSocketEvent('ticket:updated', (ticket: Ticket) => setTickets(p => p.map(t => t.id === ticket.id ? { ...t, ...ticket } : t)));
    const u3 = onSocketEvent('ticket:message', (d: { ticketId: string; message: TicketMessage }) => {
        if (d.ticketId === selectedTicketId) {
            setMessages(p => {
                const filtered = p.filter(m => m.id !== d.message.id && !m.id.startsWith('temp-'));
                return [...filtered, d.message];
            });
        }
    });
    const u4 = onSocketEvent('ticket:error', (e: { ticketId?: string; message: string }) => (!selectedTicketId || e.ticketId === selectedTicketId) && toast.error(e.message));
    const u5 = onSocketEvent('message:status', (d: { ticketId: string; messageId: string; status: string }) => d.ticketId === selectedTicketId && setMessages(p => p.map(m => m.id === d.messageId ? { ...m, status: d.status } : m)));
    const u6 = onSocketEvent('message:deleted', (d: { ticketId: string; messageId: string }) => d.ticketId === selectedTicketId && setMessages(p => p.filter(m => m.id !== d.messageId)));
    const u7 = onSocketEvent('presence:update', (d: { contactId: string; presence: string }) => {
        if (d.presence === 'composing') {
            setTypingContactIds(p => new Set(p).add(d.contactId));
            setTimeout(() => setTypingContactIds(p => { const n = new Set(p); n.delete(d.contactId); return n; }), 5000);
        } else {
            setTypingContactIds(p => { const n = new Set(p); n.delete(d.contactId); return n; });
        }
    });

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [onSocketEvent, selectedTicketId]);

  // Helpers
  const formatTime = (date?: string) => {
    if (!date) return '--:--';
    const d = new Date(date);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / 3600000;
    if (diffHours < 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffHours < 48) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'OPEN': return 'Fila';
      case 'IN_PROGRESS': return 'Aberto';
      case 'WAITING': return 'Espera';
      case 'RESOLVED': return 'Feito';
      default: return s;
    }
  };

  // =========================
  // RENDER SECTIONS
  // =========================
  const renderTicketList = () => (
    <div className="w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shrink-0">
      <div className="p-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 mb-4 bg-slate-800/50 p-2 rounded-xl">
           <Search size={16} className="text-slate-500 shrink-0" />
           <input 
             type="text" placeholder="Buscar atendimento e mensagens" value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
             className="w-full bg-transparent text-sm outline-none text-white placeholder:text-slate-500"
           />
           <button className="text-slate-500 hover:text-white transition"><Sliders size={16} /></button>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto custom-scrollbar pb-1">
            <button className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Ocultar Atendimentos Internos"><EyeOff size={16} /></button>
            <button onClick={() => setShowNewTicketModal(true)} className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Novo Atendimento"><Plus size={16} /></button>
            <button className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Listagem em Grade/Lista"><List size={16} /></button>
            <div className="relative group/btn">
              <button className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition relative" title="Atendimentos Abertos"><Archive size={16} /></button>
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg opacity-0 group-hover/btn:opacity-100 transition whitespace-nowrap z-50 pointer-events-none">Abertos</div>
            </div>
            <button className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Selecionar Vários"><CheckSquare size={16} /></button>
            <button className="p-1.5 border border-slate-700 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Mudo"><VolumeX size={16} /></button>
            <div className="flex-1 min-w-[100px]">
                <button className="w-full flex items-center justify-between px-3 py-1.5 border border-slate-700 rounded text-sm text-slate-300 hover:bg-slate-800 transition">
                    Filas
                    <ChevronDown size={14} />
                </button>
            </div>
        </div>

        <div className="flex border-b border-slate-700 overflow-x-auto custom-scrollbar">
           {(['aberto', 'atendendo', 'agenda', 'fechado', 'todos'] as const).map(cat => (
             <button 
                key={cat} onClick={() => setFilterCategory(cat)}
                className={clsx(
                  "flex-1 min-w-[80px] py-3 text-xs font-bold transition-all relative shrink-0",
                  filterCategory === cat ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
                )}
             >
               <div className="flex items-center justify-center gap-1.5">
                 {cat === 'aberto' && <Clock size={14} />}
                 {cat === 'atendendo' && <MessageSquare size={14} />}
                 {cat === 'agenda' && <Calendar size={14} />}
                 {cat === 'fechado' && <CheckSquare size={14} />}
                 {cat === 'todos' && <Layout size={14} />}
                 <span className="capitalize">{cat}</span>
               </div>
               {filterCategory === cat && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredTickets.length === 0 && !loadingTickets && (
           <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <h3 className="text-white font-bold mb-1">Nada aqui!</h3>
              <p className="text-xs">Nenhum atendimento encontrado com esse status ou termo pesquisado</p>
           </div>
        )}
        {filteredTickets.map(ticket => (
          <div 
            key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}
            className={clsx(
              "p-4 border-b border-slate-800 cursor-pointer transition-all relative group",
              selectedTicketId === ticket.id ? "bg-slate-800/80" : "hover:bg-slate-800/20"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className={clsx(
                    "w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold overflow-hidden border border-slate-700",
                    selectedTicketId === ticket.id && "border-indigo-500 shadow-indigo-500/20 shadow-lg"
                )}>
                   {ticket.contact?.profilePicUrl ? <img src={ticket.contact.profilePicUrl} className="w-full h-full object-cover" /> : <span>{ticket.contact?.name?.substring(0, 2).toUpperCase() || '?'}</span>}
                </div>
                {ticket.waitingReply && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-slate-900 animate-pulse" />}
                {typingContactIds.has(ticket.contact?.id || '') && <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 animate-bounce" />}
              </div>
              <div className="min-w-0 flex-1 ml-1">
                <div className="flex justify-between gap-2">
                  <h3 className={clsx("font-bold text-sm truncate", selectedTicketId === ticket.id ? "text-white" : "text-slate-200")}>{ticket.contact?.name || ticket.title}</h3>
                  <span className="text-[9px] text-slate-500 shrink-0">{formatTime(ticket.lastMessageAt || ticket.updatedAt)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[11px] text-slate-500 truncate pr-4 italic">
                    {typingContactIds.has(ticket.contact?.id || '') ? 'Digitando...' : (ticket as any).lastMessageContent || 'Sem mensagens'}
                  </p>
                  {(ticket._count?.messages || 0) > 0 && <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{ticket._count?.messages}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCurrentModule = () => {
    switch (activeModule) {
      case 'chats':
        return (
          <>
            {renderTicketList()}
            <div className="flex-1 flex flex-col bg-slate-950 min-w-0 relative">
              {selectedTicket ? (
                <>
                  <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                         {selectedTicket.contact?.profilePicUrl ? <img src={selectedTicket.contact.profilePicUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{selectedTicket.contact?.name?.substring(0,2)}</div>}
                      </div>
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {selectedTicket.contact?.name || selectedTicket.title}
                          {typingContactIds.has(selectedTicket.contact?.id || '') && <span className="text-[10px] text-emerald-400 animate-pulse">digitando...</span>}
                        </h3>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">{getStatusLabel(selectedTicket.status)}</span>
                           <span className="text-xs text-slate-600 font-mono">{selectedTicket.contact?.whatsapp}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       {/* Input de Data nativo para agendar */}
                       <div className="flex items-center mr-2 relative group/agenda">
                         <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors">
                           <div className="bg-slate-700 p-2 flex items-center justify-center text-slate-300">
                             <Calendar size={14} />
                           </div>
                           <input 
                              type="datetime-local" 
                              title="Agendar Retorno / Lembrete"
                              value={selectedTicket.scheduledTo ? new Date(selectedTicket.scheduledTo).toISOString().slice(0, 16) : ''} 
                              onChange={(e) => handleUpdateSchedule(selectedTicket.id, e.target.value ? new Date(e.target.value).toISOString() : null)}
                              className="bg-transparent text-xs text-white p-1.5 outline-none custom-calendar-input"
                           />
                           {selectedTicket.scheduledTo && (
                             <button onClick={() => handleUpdateSchedule(selectedTicket.id, null)} className="p-1 px-2 text-slate-400 hover:text-red-400 bg-slate-800 transition">
                               <X size={12} />
                             </button>
                           )}
                         </div>
                       </div>

                       {(selectedTicket.status === 'WAITING' || selectedTicket.status === 'OPEN') && (
                           <button onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold mr-2 hover:bg-indigo-700 shadow-lg">Atender</button>
                       )}
                       {selectedTicket.status === 'IN_PROGRESS' && (
                           <>
                             <button onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold mr-2 hover:bg-emerald-700 shadow-lg">Finalizar</button>
                             <button onClick={() => handleUpdateStatus(selectedTicket.id, 'WAITING')} className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold mr-2 hover:bg-slate-600 shadow-lg">Devolver Aberto</button>
                           </>
                       )}
                       {(selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED') && (
                           <button onClick={() => handleUpdateStatus(selectedTicket.id, 'WAITING')} className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold mr-2 hover:bg-slate-600 shadow-lg">Reabrir</button>
                       )}
                       <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><Phone size={18} /></button>
                       <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><Video size={18} /></button>
                       <div className="w-px h-6 bg-slate-800 mx-1" />
                       <button onClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)} className={clsx("p-2 rounded-lg transition", isInfoPanelOpen ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800 hover:text-white")} title="Info Contato"><Info size={18} /></button>
                       <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><MoreVertical size={18} /></button>
                    </div>
                  </div>

                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/40 custom-scrollbar">
                    {loadingMessages && <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-700" /></div>}
                    {messages.map(msg => (
                      <MessageBubble 
                        key={msg.id} msg={msg} isMe={msg.senderType === 'USER'} isSystem={msg.senderType === 'SYSTEM'}
                        profilePicUrl={selectedTicket.contact?.profilePicUrl} formatTime={formatTime} getMediaUrl={getMediaUrl}
                        onDelete={handleDeleteMessage} onLinkToProcess={(m) => toast.info('Ação de processo...')}
                        quotedMsg={msg.quotedId ? messages.find(m => m.id === msg.quotedId || m.externalId === msg.quotedId) : null}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
                    {isRecording ? (
                        <AudioRecorder onSend={handleSendAudio} onCancel={() => setIsRecording(false)} />
                    ) : (
                        <>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                            <button onClick={() => fileInputRef.current?.click()} className={clsx("p-2 rounded-lg transition", selectedFile ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white")}><Paperclip size={20} /></button>
                            <input 
                                type="text" placeholder={selectedFile ? `Legenda para ${selectedFile.name}...` : "Digite..."} value={messageInput}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageInput(e.target.value)} disabled={sendingMessage}
                                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            {messageInput.trim() || selectedFile ? (
                                <button onClick={handleSendMessage} disabled={sendingMessage} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                                   {sendingMessage ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            ) : (
                                <button onClick={() => setIsRecording(true)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition"><Mic size={20} /></button>
                            )}
                        </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                   <Sparkles size={64} className="mb-4 opacity-10" />
                   <h3 className="text-xl font-bold">CRM Jurídico DR.X</h3>
                   <p className="text-sm mt-1">Selecione uma conversa para começar.</p>
                </div>
              )}
            </div>
            <InfoPanel ticket={selectedTicket} isOpen={isInfoPanelOpen} onClose={() => setIsInfoPanelOpen(false)} processes={contactProcesses} onLinkProcess={() => {}} />
          </>
        );
      case 'quick_replies': return <QuickReplies />;
      case 'kanban': return <KanbanBoard />;
      case 'connections': return <Connections />;
      case 'tags': return <TagsManager />;
      case 'settings': return <AtendimentoSettings />;
      case 'security': return <ConfiguracoesWhatsapp />;
      case 'bot': return <div className="flex-1 flex items-center justify-center text-slate-500">Módulo Bot em breve</div>;
      default: return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-slate-950 overflow-hidden text-slate-200">
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-2 z-20 shadow-xl shrink-0">
        <ModuleButton active={activeModule === 'chats'} icon={MessageSquare} label="Chats" onClick={() => setActiveModule('chats')} />
        <ModuleButton active={activeModule === 'quick_replies'} icon={Zap} label="Respostas" onClick={() => setActiveModule('quick_replies')} />
        <ModuleButton active={activeModule === 'kanban'} icon={KanbanIcon} label="Kanban" onClick={() => setActiveModule('kanban')} />
        <div className="h-px w-8 bg-slate-800 my-2" />
        <ModuleButton active={activeModule === 'tags'} icon={Tags} label="Tags" onClick={() => setActiveModule('tags')} color="text-pink-400" />
        <ModuleButton active={activeModule === 'bot'} icon={Bot} label="Bots" onClick={() => setActiveModule('bot')} color="text-cyan-400" />
        <ModuleButton active={activeModule === 'connections'} icon={QrCode} label="Conectar (QR)" onClick={() => setActiveModule('connections')} color="text-emerald-400" />
        <ModuleButton active={activeModule === 'security'} icon={ShieldCheck} label="Ajustes Instância" onClick={() => setActiveModule('security')} color="text-emerald-500" />
        <div className="flex-1" />
        <ModuleButton active={activeModule === 'settings'} icon={Sliders} label="Config" onClick={() => setActiveModule('settings')} />
      </div>
      {renderCurrentModule()}
      <NewTicketModal open={showNewTicketModal} onClose={() => setShowNewTicketModal(false)} onSuccess={(id) => { fetchTickets(); setSelectedTicketId(id); }} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Atendimento (Chat CRM)" sections={helpAtendimento} />
    </div>
  );
}

function ModuleButton({ icon: Icon, label, active, onClick, color }: { icon: any, label: string, active: boolean, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick} className={clsx("p-3 rounded-xl transition-all group relative", active ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white")} title={label}
    >
      <Icon size={22} className={clsx(active ? "text-white" : (color || "text-slate-400 group-hover:text-white"))} />
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-r-lg" />}
    </button>
  );
}
