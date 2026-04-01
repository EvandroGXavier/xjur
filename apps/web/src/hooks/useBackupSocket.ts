import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../auth/authStorage';

export function useBackupSocket() {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const getSocketUrl = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com');
    // Em ambiente IDX/Local, a API roda na porta 3000
    const baseURL = isLocal ? `http://${window.location.hostname}:3000` : '';
    return `${baseURL}/backup`;
  };

  useEffect(() => {
    const token = getToken();
    // No backup, permitimos conexao mesmo sem token se for ambiente local, 
    // mas o ideal é ter para seguranca.
    
    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach((callback) => socket.on(event, callback));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }

    return () => {
      listenersRef.current.get(event)?.delete(callback);
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  return {
    isConnected,
    on,
  };
}
