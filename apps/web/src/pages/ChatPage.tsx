import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectionQR } from '../components/chat/ConnectionQR';
import { MessageSquare, Send } from 'lucide-react';

interface ChatMessage {
  from: string;
  text: string;
  name?: string;
  timestamp: Date;
}

export const ChatPage: React.FC = () => {
  // @ts-ignore
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetNumber, setTargetNumber] = useState(''); // Simple input for now

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WS');
    });

    newSocket.on('qr_code', (data) => {
      setQrCode(data.qr);
      setStatus('QR_READY');
    });

    newSocket.on('whatsapp_status', (data) => {
      setStatus(data.status);
      if (data.status === 'CONNECTED') {
        setQrCode('');
      }
    });

    newSocket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSend = async () => {
    if (!inputText || !targetNumber) return;

    // Send via API (or socket if implemented)
    // For now using API as per plan/controller
    try {
      await fetch('http://localhost:3000/whatsapp/send', {
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar / Connection Status */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            Dr.X Chat
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-600">{status}</span>
          </div>
        </div>

        {/* Contact List (Mock for now) */}
        <div className="flex-1 overflow-y-auto p-4">
             <div className="text-xs text-gray-400 uppercase font-bold mb-2">Mensagens Recentes</div>
             {messages.map((m, i) => (
                 <div key={i} className="p-3 mb-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100">
                     <div className="font-bold text-sm text-gray-700">{m.name || m.from}</div>
                     <div className="text-xs text-gray-500 truncate">{m.text}</div>
                 </div>
             ))}
             {messages.length === 0 && <div className="text-gray-400 text-sm">Nenhuma mensagem.</div>}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
          {status !== 'CONNECTED' ? (
              <div className="flex-1 flex items-center justify-center p-8">
                  <ConnectionQR qrCode={qrCode} />
              </div>
          ) : (
              <>
                {/* Header */}
                <div className="h-16 border-b border-gray-200 bg-white flex items-center px-6 justify-between">
                    <div className="flex items-center gap-2">
                         <input 
                            type="text" 
                            placeholder="Número (5511999999999)" 
                            className="border rounded px-2 py-1 text-sm w-48"
                            value={targetNumber}
                            onChange={(e) => setTargetNumber(e.target.value)}
                         />
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex mb-4 ${msg.from === 'ME' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                                msg.from === 'ME' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                            }`}>
                                <div className="text-xs opacity-75 mb-1">{msg.from === 'ME' ? 'Você' : msg.name || msg.from}</div>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-200">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Digite uma mensagem..."
                            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <button 
                            onClick={handleSend}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
              </>
          )}
      </div>
    </div>
  );
};
