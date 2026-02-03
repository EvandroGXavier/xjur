import React, { useState } from 'react';
import { WhatsAppConnection } from '../components/chat/WhatsAppConnection';

export const ChatPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {isConnected ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-indigo-900 mb-4">Dr.X Conectado e Operante ⚖️</h1>
            <p className="text-gray-600">Sistema de triagem inteligente ativo</p>
            {/* Aqui virá o componente de Triagem Futuramente */}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <WhatsAppConnection onConnected={() => setIsConnected(true)} />
        </div>
      )}
    </div>
  );
};