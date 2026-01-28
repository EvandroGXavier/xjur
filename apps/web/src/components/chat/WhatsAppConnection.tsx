import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from '../../services/api';
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';

interface WhatsAppConnectionProps {
  onConnected?: () => void;
}

export const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ onConnected }) => {
  const [qrCode, setQrCode] = useState<string>('');
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    connectSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = () => {
    const socketUrl = getApiUrl();
    console.log('🔌 Conectando ao DR.X:', socketUrl);

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Conectado ao WebSocket');
      setLoading(false);
      setError('');
    });

    socket.on('disconnect', () => {
      console.log('❌ Desconectado do WebSocket');
      setError('Conexão perdida. Tentando reconectar...');
    });

    socket.on('qr_code', (data: { qr: string }) => {
      console.log('📸 QR Code recebido');
      setQrCode(data.qr);
      setStatus('SCANNING');
      setLoading(false);
    });

    socket.on('whatsapp_status', (data: { status: string }) => {
      console.log('📶 Status:', data.status);
      setStatus(data.status);
      if (data.status === 'CONNECTED') {
        setQrCode('');
        if (onConnected) onConnected();
      }
    });

    socket.on('new_message', (data: any) => {
      console.log('📨 Nova mensagem:', data);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err);
      setError('Erro ao conectar com o servidor');
      setLoading(false);
    });
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/whatsapp/disconnect`, {
        method: 'POST',
      });
      if (response.ok) {
        setStatus('DISCONNECTED');
        setQrCode('');
      }
    } catch (err) {
      console.error('Erro ao desconectar:', err);
    }
  };

  const handleReconnect = () => {
    setLoading(true);
    setError('');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setTimeout(connectSocket, 500);
  };

  if (status === 'CONNECTED') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl border border-green-200">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <Wifi className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">WhatsApp Conectado!</h2>
        <p className="text-green-600 text-center mb-6">
          Seu WhatsApp está conectado e pronto para uso.
        </p>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <Smartphone className="w-8 h-8 text-indigo-600" />
        <h2 className="text-2xl font-bold text-gray-800">Conectar WhatsApp</h2>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-gray-600">Conectando ao servidor...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={handleReconnect}
            className="ml-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {qrCode && !loading && (
        <>
          <div className="p-6 bg-gray-50 rounded-xl mb-6">
            <QRCodeSVG value={qrCode} size={280} level="H" />
          </div>

          <div className="max-w-md text-center space-y-3 text-gray-600">
            <p className="font-semibold text-gray-800">Como conectar:</p>
            <ol className="text-left space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Abra o WhatsApp no seu celular</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Selecione <strong>Aparelhos Conectados</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Toque em <strong>Conectar um Aparelho</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>Aponte a câmera para este QR Code</span>
              </li>
            </ol>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Status: {status === 'SCANNING' ? 'Aguardando leitura...' : status}</span>
          </div>
        </>
      )}

      {!qrCode && !loading && !error && (
        <div className="py-8 text-center">
          <p className="text-gray-600 mb-4">Aguardando QR Code...</p>
          <button
            onClick={handleReconnect}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Gerar QR Code
          </button>
        </div>
      )}
    </div>
  );
};
