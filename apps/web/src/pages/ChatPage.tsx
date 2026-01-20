import React, { useEffect, useState } from 'react';
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
  X
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

  // URL dinâmica para funcionar tanto local quanto na VPS
  const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Se estiver rodando local, usa localhost, senão usa o IP/Domínio da VPS
      return hostname === 'localhost' ? 'http://localhost:3000' : `http://${hostname}:3000`;
    }
    return 'http://localhost:3000';
  };

  const API_URL = getSocketUrl();

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WS at', API_URL);
    });

    // CORREÇÃO 1: Adicionado tipagem 'any' para evitar erro de build
    newSocket.on('qr_code', (data: any) => {
      setQrCode(data.qr);
      setStatus('QR_READY');
    });

    // CORREÇÃO 2: Adicionado tipagem 'any'
    newSocket.on('whatsapp_status', (data: any) => {
      setStatus(data.status);
      if (data.status === 'CONNECTED') {
        setQrCode('');
      }
    });

    // CORREÇÃO 3: Adicionado tipagem 'any'
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
      // Usa a URL dinâmica definida acima
      await fetch(`${API_URL}/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetNumber, message: inputText }),
      });
      
      // Add to local list optimistically
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

  // --- UI HELPER COMPONENTS ---

  const StatusCard = () => {
    let bgColor, textColor, Icon, label;

    switch (status) {
      case 'CONNECTED':
        bgColor = 'bg-green-100';
        textColor = 'text-green-700';
        Icon = Wifi;
        label = 'Conectado';
        break;
      case 'QR_READY':
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-700';
        Icon = Loader2; // Or Scan
        label = 'Aguardando Leitura';
        break;
      default:
        bgColor = 'bg-red-100';
        textColor = 'text-red-700';
        Icon = WifiOff;
        label = 'Desconectado';
    }

    return (
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${bgColor} ${textColor} border-opacity-20 shadow-sm transition-all duration-300`}>
        <div className={`p-2 rounded-full bg-white bg-opacity-60`}>
          <Icon className={`w-5 h-5 ${status === 'QR_READY' ? 'animate-spin' : ''}`} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase opacity-70 tracking-wider">Status do Sistema</p>
          <p className="font-bold text-sm">{label}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Dashboard & Status */}
      <aside className={`
        fixed md:relative z-50 w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl md:shadow-none transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-blue-200">
            <MessageSquare className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">Dr.X Chat</span>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden ml-auto text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Status Section */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Conexão</h3>
            <StatusCard />
          </section>

          {/* Quick Actions / Stats (Optional placeholders for professional feel) */}
          <section className="grid grid-cols-2 gap-3">
             <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-blue-600 text-xs font-bold">Mensagens</p>
                <p className="text-2xl font-bold text-blue-900">{messages.length}</p>
             </div>
             <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                <p className="text-purple-600 text-xs font-bold">Sessão</p>
                <p className="text-2xl font-bold text-purple-900">1</p>
             </div>
          </section>

          {/* Recent Messages List */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Logs Recentes</h3>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm italic">
                  Nenhuma mensagem registrada.
                </div>
              ) : (
                messages.slice().reverse().slice(0, 10).map((m, i) => (
                  <div key={i} className="group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-default">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-700 text-sm truncate max-w-[120px]">
                        {m.from === 'ME' ? 'Você' : m.name || m.from}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                    DR
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-700">Operador Dr.X</p>
                    <p className="text-xs text-slate-500">Online</p>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative w-full">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-600">
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-slate-800">Dr.X Chat</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
        </header>

        {/* Dynamic Content */}
        {status !== 'CONNECTED' ? (
             /* Disconnected / QR State */
             <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50/50">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="bg-slate-900 p-6 text-center">
                        <h2 className="text-white text-xl font-bold mb-2">Conectar WhatsApp</h2>
                        <p className="text-slate-400 text-sm">Sincronize seu dispositivo para começar</p>
                    </div>
                    
                    <div className="p-8 flex flex-col items-center">
                        {/* QR Display Area */}
                        
                        {qrCode ? (
                            <div className="mb-8 p-4 bg-white border-2 border-slate-100 rounded-xl shadow-inner">
                                <ConnectionQR qrCode={qrCode} />
                            </div>
                        ) : (
                             <div className="mb-8 w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                                <div className="text-center p-6">
                                    <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm font-medium">Gerando QR Code...</p>
                                </div>
                             </div>
                        )}

                        {/* Official Instructions */}
                        <div className="w-full space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs border border-slate-200">1</span>
                                <span>Abra o WhatsApp no seu celular</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs border border-slate-200">2</span>
                                <span>Toque em <strong>Menu</strong> (Android) ou <strong>Configurações</strong> (iOS)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs border border-slate-200">3</span>
                                <span>Selecione <strong>Aparelhos Conectados</strong> e depois <strong>Conectar Aparelho</strong></span>
                            </div>
                             <div className="flex items-center gap-3 text-sm text-slate-600">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs border border-slate-200">4</span>
                                <span>Aponte a câmera para esta tela</span>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
        ) : (
            /* Active Chat Interface */
            <>
                {/* Chat Header */}
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                             <Smartphone className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                             <p className="text-sm font-bold text-slate-800">Nova Mensagem</p>
                             <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <p className="text-xs text-slate-500">WhatsApp Conectado</p>
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <div className="relative group">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="5511999999999" 
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 transition-all"
                                value={targetNumber}
                                onChange={(e) => setTargetNumber(e.target.value)}
                            />
                         </div>
                         <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreVertical className="w-5 h-5" />
                         </button>
                    </div>
                </div>

                {/* Messages Area (Wallpaper effect) */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#e4e9f0] space-y-4 scroll-smooth">
                    {/* Date Divider Example */}
                    <div className="flex justify-center my-4">
                        <span className="bg-white/60 px-3 py-1 rounded-full text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
                            Hoje
                        </span>
                    </div>

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.from === 'ME' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[70%] md:max-w-[60%] px-4 py-3 shadow-sm relative group
                                ${msg.from === 'ME' 
                                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' 
                                    : 'bg-white text-slate-800 rounded-2xl rounded-tl-none'
                                }
                            `}>
                                <div className={`text-[10px] font-bold mb-1 ${msg.from === 'ME' ? 'text-blue-100' : 'text-blue-600'}`}>
                                    {msg.from === 'ME' ? 'Você' : msg.name || msg.from}
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <span className={`
                                    text-[10px] absolute bottom-1 right-3 opacity-60
                                    ${msg.from === 'ME' ? 'text-white' : 'text-slate-400'}
                                `}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="max-w-4xl mx-auto relative flex items-end gap-2">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-inner">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 bg-transparent border-none focus:outline-none text-slate-700 placeholder:text-slate-400 max-h-32 py-2"
                            />
                        </div>
                        <button 
                            onClick={handleSend}
                            disabled={!inputText.trim() || !targetNumber}
                            className={`
                                p-4 rounded-full shadow-lg transform transition-all duration-200 flex items-center justify-center
                                ${(!inputText.trim() || !targetNumber) 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                                }
                            `}
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </button>
                    </div>
                    <div className="text-center mt-2">
                         <p className="text-[10px] text-slate-400">Pressione Enter para enviar</p>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};
