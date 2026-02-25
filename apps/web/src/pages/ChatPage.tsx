
import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, Plus, Filter, MessageCircle, Phone, Mail, 
    MoreVertical, Paperclip, Mic, Send, Check, CheckCheck,
    User, Archive, Clock, MoreHorizontal, X, ChevronLeft,
    Smile, Calendar, Reply, FileText, Download
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { WhatsAppConnection } from '../components/chat/WhatsAppConnection';
import { Badge } from '../components/ui/Badge';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';

// Types (should be shared)
interface Ticket {
    id: string;
    contactId?: string;
    contact?: {
        name: string;
        phone?: string;
        email?: string;
        id: string;
    };
    title: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    channel: 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEBCHAT';
    lastMessage?: string;
    unreadCount?: number;
    updatedAt: string;
    queue?: string;
}

interface Message {
    id: string;
    content: string;
    senderType: 'USER' | 'CONTACT' | 'SYSTEM';
    contentType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'FILE' | 'LOCATION' | 'STICKER';
    mediaUrl?: string | null;
    createdAt: string;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SCHEDULED';
    quotedId?: string | null;
    externalId?: string | null;
}

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  // State
  const [isConnected, setIsConnected] = useState(true); // TODO: Integrate with backend WA status
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New features state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (useEffects and functions unchanged down to line 155)
  // Load Tickets
  useEffect(() => {
    if (isConnected) fetchTickets();
  }, [isConnected]);

  // Load Messages when ticket selected
  useEffect(() => {
    if (selectedTicketId) fetchMessages(selectedTicketId);
  }, [selectedTicketId]);

  // Scroll to bottom
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTickets = async () => {
    try {
        setLoading(true);
        const res = await api.get('/tickets');
        setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar tickets');
    } finally {
        setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
      try {
          const res = await api.get(`/tickets/${ticketId}`);
          setMessages(res.data.messages || []);
      } catch (e) {
          console.error(e);
      }
  };

  const handleSendMessage = async () => {
      // Allow sending empty text if there is a file attached
      if (!inputValue.trim() && !selectedFile) return;
      if (!selectedTicketId) return;

      const isScheduled = showSchedule && scheduleDate;
      
      try {
          if (!isScheduled) {
             // Optimistic update for immediate messages text-only (omit optimistic updates for files to avoid complex states)
             if (!selectedFile) {
               const tempMsg: Message = {
                   id: 'temp-' + Date.now(),
                   content: inputValue,
                   senderType: 'USER',
                   contentType: 'TEXT',
                   createdAt: new Date().toISOString(),
                   status: 'SENT',
                   quotedId: replyingTo?.externalId || null
               };
               setMessages(prev => [...prev, tempMsg]);
             }
          }
          
          const formData = new FormData();
          if (inputValue.trim()) formData.append('content', inputValue.trim());
          if (replyingTo?.externalId) formData.append('quotedId', replyingTo.externalId);
          if (isScheduled) formData.append('scheduledAt', new Date(scheduleDate).toISOString());
          if (selectedFile) formData.append('file', selectedFile);

          const config = selectedFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
          
          // Reset states immediately to let UI feel responsive
          setInputValue('');
          setSelectedFile(null);
          setReplyingTo(null);
          setShowSchedule(false);
          setScheduleDate('');
          setShowEmojiPicker(false);

          await api.post(`/tickets/${selectedTicketId}/messages`, formData, config);
          
          if (isScheduled) {
             toast.success('Mensagem agendada com sucesso!');
          }
          fetchMessages(selectedTicketId); // Refresh
      } catch (e) {
          toast.error('Erro ao enviar mensagem');
          console.error(e);
      }
  };

  const onEmojiClick = (emojiData: any) => {
    setInputValue(prev => prev + emojiData.emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
       setSelectedFile(e.target.files[0]);
    }
  };

  const handleSimulateIncoming = async () => {
      if (!selectedTicketId) return;
      const content = prompt("Simular mensagem do cliente:");
      if (!content) return;
      
      try {
          await api.post(`/tickets/${selectedTicketId}/simulate`, { content });
          fetchMessages(selectedTicketId);
          toast.success('Mensagem recebida!');
          fetchTickets(); // Update list order
      } catch (e) {
         toast.error('Erro na simulação');
      }
  };

  const createTicket = async () => {
      const title = prompt("Título do Ticket:");
      if (!title) return;
      
      try {
          await api.post('/tickets', {
              title,
              channel: 'WHATSAPP',
              priority: 'MEDIUM',
              queue: 'COMERCIAL'
          });
          fetchTickets();
          toast.success('Ticket criado!');
      } catch (e: any) {
          console.error(e);
          toast.error('Erro ao criar ticket: ' + (e.response?.data?.message || e.message));
      }
  };

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Render Helpers
  const formatTime = (date: string) => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const getChannelIcon = (channel: string) => {
      switch(channel) {
          case 'WHATSAPP': return <MessageCircle size={14} className="text-green-400" />;
          case 'EMAIL': return <Mail size={14} className="text-blue-400" />;
          case 'PHONE': return <Phone size={14} className="text-amber-400" />;
          default: return <MessageCircle size={14} />;
      }
  };

  if (!isConnected) {
      return (
        <div className="h-full flex items-center justify-center p-8 bg-slate-900">
           <WhatsAppConnection onConnected={() => setIsConnected(true)} />
        </div>
      );
  }

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden animate-in fade-in">
      
      {/* 1. LEFT SIDEBAR: LIST */}
      <div className={clsx(
          "w-full md:w-80 border-r border-slate-800 bg-slate-900 flex-col",
          selectedTicket ? "hidden md:flex" : "flex"
      )}>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
             <h2 className="text-lg font-bold text-white">Tickets</h2>
             <div className="flex gap-2">
                 <button onClick={createTicket} title="Novo Ticket" className="p-2 hover:bg-slate-800 rounded-full text-indigo-400"><Plus size={20} /></button>
                 <button title="Filtros" className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><Filter size={18} /></button>
             </div>
          </div>
          
          {/* Search */}
          <div className="p-3">
              <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="Buscar..." />
              </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading && tickets.length === 0 && <div className="p-4 text-center text-slate-500">Carregando...</div>}
              {tickets.map(ticket => (
                  <div 
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={clsx(
                        "p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors relative group",
                        selectedTicketId === ticket.id && "bg-slate-800 border-l-2 border-l-indigo-500"
                    )}
                  >
                      <div className="flex justify-between mb-1">
                          <span className="font-medium text-white text-sm truncate">{ticket.contact?.name || ticket.title}</span>
                          <span className="text-xs text-slate-500">{formatTime(ticket.updatedAt)}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mb-2">{ticket.lastMessage || 'Nenhuma mensagem'}</div>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              {getChannelIcon(ticket.channel)}
                              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{ticket.queue || 'GERAL'}</span>
                          </div>
                          {ticket.unreadCount && ticket.unreadCount > 0 && (
                              <span className="bg-indigo-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">{ticket.unreadCount}</span>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* 2. CENTER: CHAT WINDOW */}
      <div className={clsx(
          "flex-1 flex-col bg-slate-950 relative",
          selectedTicket ? "flex" : "hidden md:flex"
      )}>
          {selectedTicket ? (
              <>
                  {/* Header */}
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                      <div className="flex items-center gap-2 sm:gap-3">
                          <button onClick={() => setSelectedTicketId(null)} className="md:hidden p-1.5 -ml-2 mr-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                              <ChevronLeft size={24} />
                          </button>
                          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {selectedTicket.contact?.name?.substring(0,2).toUpperCase() || 'CX'}
                          </div>
                          <div>
                              <h3 className="font-bold text-white">{selectedTicket.contact?.name || 'Visitante'}</h3>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                  {selectedTicket.channel} • Protocolo #{selectedTicket.id.substring(0,6)}
                              </p>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={handleSimulateIncoming} className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:text-white" title="Dev Tool">Simular Cliente</button>
                          <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><Phone size={20} /></button>
                          <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><MoreVertical size={20} /></button>
                      </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {messages.map((msg, idx) => {
                          const isUser = msg.senderType === 'USER';
                          const hasMedia = !!msg.mediaUrl;
                          
                          // Handle Reply finding (Display who we are replying to)
                          let quotedMsgText = null;
                          if (msg.quotedId) {
                             const quotedMsg = messages.find(m => m.externalId === msg.quotedId);
                             quotedMsgText = quotedMsg?.content || 'Mensagem anterior';
                          }

                          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                          const fullMediaUrl = msg.mediaUrl ? (msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${apiUrl.replace('/api', '')}/${msg.mediaUrl}`) : '';

                          return (
                              <div key={msg.id || idx} className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
                                  <div className={clsx(
                                      "max-w-[70%] rounded-2xl p-3 px-4 text-sm relative group shadow-sm",
                                      isUser 
                                        ? "bg-indigo-600 text-white rounded-br-none" 
                                        : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
                                  )}>
                                      
                                      {/* Replying Block */}
                                      {msg.quotedId && (
                                          <div className="mb-2 p-2 bg-black/20 rounded-lg text-xs border-l-4 border-indigo-400 opacity-80 line-clamp-2">
                                              {quotedMsgText}
                                          </div>
                                      )}

                                      {/* Media Rendering */}
                                      {hasMedia && fullMediaUrl && (
                                          <div className="mb-2">
                                             {msg.contentType === 'IMAGE' || msg.contentType === 'STICKER' ? (
                                                <img src={fullMediaUrl} alt="media" className="rounded-lg max-w-full max-h-60 object-contain" />
                                             ) : msg.contentType === 'VIDEO' ? (
                                                <video src={fullMediaUrl} controls className="rounded-lg max-w-full max-h-60" />
                                             ) : msg.contentType === 'AUDIO' ? (
                                                <audio src={fullMediaUrl} controls className="max-w-[250px]" />
                                             ) : (
                                                <a href={fullMediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition">
                                                   <FileText size={24} className={isUser ? "text-indigo-200" : "text-slate-400"} />
                                                   <span className="truncate flex-1 font-medium">{msg.content || 'Arquivo anexo'}</span>
                                                   <Download size={16} />
                                                </a>
                                             )}
                                          </div>
                                      )}

                                      {/* Text Content */}
                                      {msg.content && <p className="whitespace-pre-wrap word-break">{msg.content}</p>}
                                      
                                      <div className={clsx("text-[10px] mt-1 flex items-center gap-1 opacity-70", isUser ? "justify-end text-indigo-200" : "text-slate-500")}>
                                          {formatTime(msg.createdAt)}
                                          {isUser && (
                                              msg.status === 'SCHEDULED' ? <Clock size={12} /> :
                                              msg.status === 'READ' ? <CheckCheck size={12} className="text-blue-300" /> :
                                              msg.status === 'DELIVERED' ? <CheckCheck size={12} /> :
                                              <Check size={12} />
                                          )}
                                      </div>

                                      {/* Hover Actions */}
                                      <div className={clsx(
                                          "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity",
                                          isUser ? "-left-10" : "-right-10"
                                      )}>
                                          <button 
                                              onClick={() => setReplyingTo(msg)}
                                              className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 shadow"
                                              title="Responder"
                                          >
                                              <Reply size={14} />
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                      <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Banner */}
                  {replyingTo && (
                      <div className="mx-4 p-3 bg-slate-800 border-l-4 border-indigo-500 rounded-t-xl flex items-start justify-between">
                          <div>
                             <span className="text-xs text-indigo-400 font-bold block mb-1">
                                Respondendo a {replyingTo.senderType === 'USER' ? 'Você' : selectedTicket.contact?.name || 'Cliente'}
                             </span>
                             <p className="text-sm text-slate-300 truncate max-w-sm">{replyingTo.content}</p>
                          </div>
                          <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                      </div>
                  )}

                  {/* Schedule Banner */}
                  {showSchedule && (
                      <div className="mx-4 p-3 bg-slate-800/80 rounded-t-xl flex items-center gap-4">
                          <label className="text-sm text-slate-300 flex items-center gap-2">
                             <Clock size={16} className="text-amber-400" /> Enviar em:
                          </label>
                          <input 
                             type="datetime-local" 
                             value={scheduleDate}
                             onChange={e => setScheduleDate(e.target.value)}
                             min={new Date().toISOString().slice(0,16)}
                             className="bg-slate-900 border border-slate-700 text-sm text-white rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                          />
                          <button onClick={() => { setShowSchedule(false); setScheduleDate(''); }} className="ml-auto text-slate-500 hover:text-white">Cancelar</button>
                      </div>
                  )}

                  {/* File Selection Banner */}
                  {selectedFile && (
                      <div className="mx-4 p-3 bg-slate-800 rounded-t-xl flex items-center justify-between border-t border-slate-700">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-500/20 rounded">
                                 <FileText size={20} className="text-indigo-400" />
                             </div>
                             <div>
                                 <span className="text-sm font-medium text-white block">{selectedFile.name}</span>
                                 <span className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                             </div>
                         </div>
                         <button onClick={() => setSelectedFile(null)} className="text-slate-500 hover:text-white p-2"><X size={20} /></button>
                      </div>
                  )}

                  {/* Input Base */}
                  <div className="p-4 bg-slate-900 border-t border-slate-800 relative">
                      {/* Emoji Picker Popover */}
                      {showEmojiPicker && (
                          <div className="absolute bottom-full left-4 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden border border-slate-700">
                             <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                          </div>
                      )}

                      <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl p-2 px-4 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} className="text-slate-500 hover:text-indigo-400 transition" title="Anexar Arquivo"><Paperclip size={20} /></button>
                          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-slate-500 hover:text-indigo-400 transition" title="Emojis"><Smile size={20} /></button>
                          
                          <input 
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-slate-500 py-2 ml-1" 
                            placeholder="Digite sua mensagem..." 
                          />
                          
                          <button onClick={() => setShowSchedule(!showSchedule)} className={clsx("p-2 transition rounded", showSchedule ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-amber-400")} title="Agendar Mensagem">
                              <Calendar size={20} />
                          </button>

                          {(inputValue.trim() || selectedFile) ? (
                              <button onClick={handleSendMessage} className="p-2 ml-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition shadow-lg shadow-indigo-500/20">
                                  {scheduleDate && showSchedule ? <Clock size={18} /> : <Send size={18} />}
                              </button>
                          ) : (
                              <button className="text-slate-500 hover:text-white transition ml-1"><Mic size={20} /></button>
                          )}
                      </div>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                      <MessageCircle size={40} className="text-indigo-500/50" />
                  </div>
                  <p className="text-lg font-medium text-slate-400">Selecione um ticket para iniciar</p>
                  <button onClick={createTicket} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition">Iniciar Novo Atendimento</button>
              </div>
          )}
      </div>

      {/* 3. RIGHT: CRM CONTEXT (Hidden on small screens) */}
      {selectedTicket && (
          <div className="w-80 border-l border-slate-800 bg-slate-900 hidden xl:flex flex-col p-6 space-y-6">
              <div className="text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center mb-3 border-2 border-indigo-500/30">
                      <User size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedTicket.contact?.name || 'Novo Cliente'}</h3>
                  <p className="text-slate-400 text-sm mt-1">{selectedTicket.contact?.email || 'Sem email'}</p>
                  <p className="text-slate-400 text-sm">{selectedTicket.contact?.phone || 'Sem telefone'}</p>
                  
                  <div className="flex justify-center gap-2 mt-4">
                      <button 
                        onClick={() => selectedTicket.contactId && navigate(`/contacts/${selectedTicket.contactId}`)}
                        className="px-3 py-1.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-medium hover:bg-indigo-600 hover:text-white transition"
                      >
                          Ver Perfil
                      </button>
                      <button className="px-3 py-1.5 bg-amber-600/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium hover:bg-amber-600 hover:text-white transition">
                          Criar Processo
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Clock size={14} className="text-indigo-500" /> Histórico</h4>
                      <p className="text-xs text-slate-500">Nenhum atendimento anterior recente.</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Archive size={14} className="text-indigo-500" /> Processos Ativos</h4>
                      <p className="text-xs text-slate-500">Cliente não possui processos ativos.</p>
                  </div>
               </div>
          </div>
      )}
    </div>
  );
};