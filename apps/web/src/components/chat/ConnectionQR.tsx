import React from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';

interface ConnectionQRProps {
  qrCode: string;
}

export const ConnectionQR: React.FC<ConnectionQRProps> = ({ qrCode }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Conectar WhatsApp</h2>
      <div className="p-4 bg-gray-100 rounded-lg">
        {qrCode ? (
          <QRCode value={qrCode} size={256} />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center text-gray-400">
            Aguardando QR Code...
          </div>
        )}
      </div>
      <p className="mt-6 text-gray-600 text-center">
        1. Abra o WhatsApp no seu celular<br />
        2. Toque em Menu ou Configurações e selecione Aparelhos Conectados<br />
        3. Toque em Conectar um Aparelho<br />
        4. Aponte a câmera para esta tela
      </p>
    </div>
  );
};
