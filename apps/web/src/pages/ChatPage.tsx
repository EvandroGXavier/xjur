// apps/web/src/pages/ChatPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client'; // Certifique-se de ter: npm install socket.io-client
import { ConnectionQR } from '../components/chat/ConnectionQR';
import { getApiUrl } from '../services/api';

export const ChatPage: React.FC = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // DR.X: Conexão resiliente
    const socketUrl = getApiUrl();
    console.log('🔌 DR.X Connecting to:', socketUrl);

    socketRef.current = io(socketUrl, {
      transports: ['websocket'], // Força WebSocket para performance
      reconnection: true,
      reconnectionAttempts: 10,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Connected to DR.X Core');
      // Solicita status atual assim que conecta
      socket.emit('request_status'); 
    });

    socket.on('qr_code', (data: { qr: string }) => {
      console.log('📸 New QR Code Received');
      setQrCode(data.qr);
      setStatus('SCANNING');
    });

    socket.on('whatsapp_status', (data: { status: string }) => {
      console.log('📶 Status Update:', data.status);
      setStatus(data.status);
      if (data.status === 'CONNECTED') {
        setQrCode('');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {status === 'CONNECTED' ? (
        <div className="flex items-center justify-center h-full">
            <h1 className="text-2xl font-bold text-blue-900">Dr.X Conectado e Operante ⚖️</h1>
            {/* Aqui virá o componente de Triagem Futuramente */}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
            <ConnectionQR qrCode={qrCode} />
            <div className="fixed bottom-4 right-4 text-xs text-gray-400">
                Status: {status}
            </div>
        </div>
      )}
    </div>
  );
};