import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectionQR } from '../components/chat/ConnectionQR';
import { 
  MessageSquare, 
  Send, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Loader2, 
  MoreVertical, 
  Phone, 
  Search,
  Menu,
  X,
  Activity,
  ShieldCheck,
  Globe
} from 'lucide-react';

interface ChatMessage {
  from: string;
  text: string;
  name?: string;
  timestamp: Date;
}

export const ChatPage: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- LÓGICA DE SOCKET (INTOCÁVEL - NÃO MEXER) ---
  const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return hostname === 'localhost' ? 'http://localhost:3000' : `http://${hostname}:3000`;
    }
    return 'http://localhost:3000';
  };

  const API_URL = getSocketUrl();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WS at', API_URL);
    });

    newSocket.on('qr_code', (data: any) => {
      setQrCode(data.qr);
      setStatus('QR_READY');
    });

    newSocket.on('whatsapp_status', (data: any) => {
      setStatus(data.status);
      if (data.status === 'CONNECTED') {
        setQrCode('');
      }
    });

    newSocket.on('new_message', (msg: any) => {
      setMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSend = async () => {
    if (!inputText || !targetNumber) return;

    try {
      await fetch(`${API_URL}/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetNumber, message: inputText }),
      });
      
      setMessages((prev) => [...prev, { 
          from: 'ME', 
          text: inputText, 
          timestamp: new Date() 
      }]);
      setInputText('');
    } catch (err) {
      console.error('Failed to send', err);
    }
  };
  // --- FIM DA LÓGICA DE SOCKET ---

  // --- UI COMPONENTS ---

  const StatusCard = () => {
    let bgColor, textColor, Icon, label, description;

    switch (status) {
      case 'CONNECTED':
        bgColor = 'bg-green-50 border-green-200';
        textColor = 'text-green-700';
        Icon = Wifi;
        label = 'Online';
        description = 'Sistema operando normalmente';
        break;
      case 'QR_READY':
        bgColor = 'bg-amber-50 border-amber-200';
        textColor = 'text-amber-700';
        Icon = Loader2;
        label = 'Aguardando Leitura';
        description = 'Escaneie o QR Code para conectar';
        break;
      default:
        bgColor = 'bg-rose-50 border-rose-200';
        textColor = 'text-rose-700';
        Icon = WifiOff;
        label = 'Desconectado';
        description = 'Serviço de mensagens offline';
    }

    return (
      <div className={`flex flex-col p-4 rounded-xl border ${bgColor} transition-all duration-300`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg bg-white bg-opacity-80 shadow-sm`}>
            <Icon className={`w-5 h-5 ${textColor} ${status === 'QR_READY' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${textColor}`}>{label}</p>
            <p className="text-[10px] opacity-70 uppercase font-semibold tracking-wider">Status da API</p>
          </div>
        </div>
        <p className={`text-xs ${textColor} opacity-80 pl-1`}>
          {description}
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-none transition-transform duration-300 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-blue-200">
            <MessageSquare className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">Dr.X <span className="text-blue-600">Admin</span></span>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden ml-auto p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Painel de Controle</h3>
            <StatusCard />
          </section>

          <section className="grid grid-cols-2 gap-3">
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-1">
                   <Activity className="w-3 h-3 text-blue-500" />
                   <p className="text-slate-500 text-xs font-medium">Sessão</p>
                </div>
                <p className="text-xl font-bold text-slate-800">Ativa</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-1">
                   <Globe className="w-3 h-3 text-purple-500" />
                   <p className="text-slate-500 text-xs font-medium">Ambiente</p>
                </div>
                <p className="text-xl font-bold text-slate-800">Prod</p>
             </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Console de Eventos</h3>
            <div className="bg-slate-900 rounded-xl p-4 overflow-hidden shadow-inner border border-slate-800">
              <div className="font-mono text-[10px] space-y-2 h-32 overflow-y-auto custom-scrollbar">
                 <div className="text-green-400 flex gap-2">
                    <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                    <span>System initialized...</span>
                 </div>
                 <div className="text-blue-400 flex gap-2">
                    <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                    <span>Socket connected</span>
                 </div>
                 {status === 'QR_READY' && (
                    <div className="text-yellow-400 flex gap-2">
                       <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                       <span>Waiting for scan...</span>
                    </div>
                 )}
                 {messages.length > 0 && (
                    <div className="text-slate-300 flex gap-2">
                       <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                       <span>Processing {messages.length} messages</span>
                    </div>
                 )}
              </div>
            </div>
          </section>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-md">
                    DX
                </div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Operador Dr.X</p>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                       <p className="text-xs text-slate-500 font-medium">Online Agora</p>
                    </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-slate-300" />
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-[#eef1f6]">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 shadow-sm z-30">
            <div className="flex items-center gap-3">
                <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-slate-800">Dr.X Chat</span>
            </div>
            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
        </header>

        {/* --- MAIN DISPLAY LOGIC --- */}
        {status !== 'CONNECTED' ? (
             /* TELA DE CONEXÃO (QR CODE) */
             <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                    
                    {/* Left Side: Instructions */}
                    <div className="p-8 md:p-12 flex-1 flex flex-col justify-center bg-white">
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">Conectar WhatsApp</h2>
                            <p className="text-slate-500">Sincronize o número do escritório para iniciar os atendimentos automáticos.</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                                <div>
                                    <p className="font-bold text-slate-800 mb-1">Abra o WhatsApp</p>
                                    <p className="text-sm text-slate-500">No seu celular, abra o aplicativo oficial.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                                <div>
                                    <p className="font-bold text-slate-800 mb-1">Acesse o Menu</p>
                                    <p className="text-sm text-slate-500">Toque em Configurações (iOS) ou nos 3 pontos (Android) e selecione <strong>Aparelhos Conectados</strong>.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                                <div>
                                    <p className="font-bold text-slate-800 mb-1">Escaneie o Código</p>
                                    <p className="text-sm text-slate-500">Aponte a câmera para a tela ao lado.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: QR Code Area */}
                    <div className="bg-slate-50 border-l border-slate-200 p-8 md:p-12 flex flex-col items-center justify-center relative">
                        {status === 'QR_READY' && qrCode ? (
                           <div className="relative group">
                              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                              <div className="relative p-4 bg-white rounded-lg shadow-lg border border-slate-100">
                                  <ConnectionQR qrCode={qrCode} />
                              </div>
                              <p className="text-center mt-6 text-sm font-medium text-slate-600 animate-pulse">Aguardando leitura...</p>
                           </div>
                        ) : (
                             <div className="text-center">
                                <div className="relative w-48 h-48 mx-auto mb-6">
                                    <div className="absolute inset-0 border-4 border-slate-200 rounded-2xl"></div>
                                    <div className="absolute inset-0 border-4 border-blue-500 rounded-2xl border-t-transparent animate-spin"></div>
                                    <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-blue-500 animate-spin" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-2">Gerando Sessão</h3>
                                <p className="text-sm text-slate-400 max-w-[200px] mx-auto">Isso pode levar alguns segundos dependendo da API.</p>
                             </div>
                        )}
                        
                        <div className="absolute bottom-6 left-0 right-0 text-center">
                           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
                              <ShieldCheck className="w-3 h-3 text-green-500" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">End-to-End Encrypted</span>
                           </div>
                        </div>
                    </div>
                </div>
             </div>
        ) : (
            /* TELA DE CHAT (CONECTADO) */
            <>
                {/* Chat Header */}
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-200">
                                <Smartphone className="w-5 h-5" />
                           </div>
                           <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                              <div className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                           </div>
                        </div>
                        <div>
                             <p className="text-sm font-bold text-slate-800">WhatsApp Conectado</p>
                             <p className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Sincronizado em tempo real
                             </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         {/* Target Number Input */}
                         <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <Phone className="w-4 h-4 text-slate-400 mr-2" />
                            <input 
                                type="text" 
                                placeholder="5511999999999" 
                                className="bg-transparent border-none focus:outline-none text-sm w-40 text-slate-700 placeholder:text-slate-400 font-medium"
                                value={targetNumber}
                                onChange={(e) => setTargetNumber(e.target.value)}
                            />
                         </div>
                         <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                            <MoreVertical className="w-5 h-5" />
                         </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scroll-smooth" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px'}}>
                    
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                             <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-slate-400" />
                             </div>
                             <p className="text-slate-500 font-medium">Nenhuma mensagem ainda</p>
                             <p className="text-sm text-slate-400">Envie uma mensagem para iniciar</p>
                        </div>
                    ) : (
                         messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.from === 'ME' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`
                                    max-w-[85%] md:max-w-[60%] px-5 py-3 shadow-sm relative group text-sm leading-relaxed
                                    ${msg.from === 'ME' 
                                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                                        : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100'
                                    }
                                `}>
                                    {msg.from !== 'ME' && (
                                       <p className="text-[10px] font-bold text-blue-600 mb-1 opacity-80">{msg.name || msg.from}</p>
                                    )}
                                    
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                    
                                    <div className={`text-[9px] mt-1 text-right ${msg.from === 'ME' ? 'text-blue-200' : 'text-slate-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-20">
                    <div className="max-w-4xl mx-auto flex gap-3 items-end">
                        {/* Mobile Target Number (If not in header) */}
                        <div className="md:hidden flex-1 mb-2" style={{ display: targetNumber ? 'none' : 'block' }}>
                           <input 
                                type="text" 
                                placeholder="Para: 5511..." 
                                className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm border border-slate-200"
                                value={targetNumber}
                                onChange={(e) => setTargetNumber(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-end px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all shadow-inner">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 bg-transparent border-none focus:outline-none text-slate-700 placeholder:text-slate-400 max-h-32 resize-none text-sm"
                            />
                        </div>
                        <button 
                            onClick={handleSend}
                            disabled={!inputText.trim() || !targetNumber}
                            className={`
                                p-3.5 rounded-xl shadow-lg transform transition-all duration-200 flex items-center justify-center
                                ${(!inputText.trim() || !targetNumber) 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                                }
                            `}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};