import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUser } from '../auth/authStorage';
import { toast } from 'sonner';

interface SigiloContextType {
  isSigiloActive: boolean;
  activateSigilo: (durationMinutes?: number) => void;
  deactivateSigilo: () => void;
  timeLeft: number; // em segundos
}

const SigiloContext = createContext<SigiloContextType | undefined>(undefined);

export const SigiloProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSigiloActive, setIsSigiloActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const deactivateSigilo = useCallback(() => {
    setIsSigiloActive(false);
    setTimeLeft(0);
    if (isSigiloActive) {
      toast.info('Modo Sigilo encerrado.');
    }
  }, [isSigiloActive]);

  const activateSigilo = useCallback((durationMinutes = 5) => {
    const user = getUser();
    if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
      toast.error('Apenas administradores podem ativar o modo sigilo.');
      return;
    }
    setIsSigiloActive(true);
    setTimeLeft(durationMinutes * 60);
    toast.success(`Modo Sigilo ativado por ${durationMinutes} minutos.`);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSigiloActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            deactivateSigilo();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSigiloActive, timeLeft, deactivateSigilo]);

  // Shortcut Listener: CTRL + F8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'F8') {
        e.preventDefault();
        // Disparar o evento de necessidade de re-autenticação
        window.dispatchEvent(new CustomEvent('open-sigilo-auth'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SigiloContext.Provider value={{ isSigiloActive, activateSigilo, deactivateSigilo, timeLeft }}>
      {children}
    </SigiloContext.Provider>
  );
};

export const useSigilo = () => {
  const context = useContext(SigiloContext);
  if (context === undefined) {
    throw new Error('useSigilo must be used within a SigiloProvider');
  }
  return context;
};
