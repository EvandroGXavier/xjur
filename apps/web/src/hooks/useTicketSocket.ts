import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../auth/authStorage';

/**
 * Hook reutilizável para conexão WebSocket com o backend.
 * Conecta ao namespace /tickets com autenticação JWT.
 *
 * Eventos disponíveis:
 *  - ticket:new      → novo ticket criado
 *  - ticket:updated  → ticket atualizado (status, etc)
 *  - ticket:message  → nova mensagem em um ticket
 */
export function useTicketSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  const getSocketUrl = () => {
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname.includes('idx.google.com')
    ) {
      return `http://${window.location.hostname}:3000/tickets`;
    }
    return '/tickets';
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn('useTicketSocket: No token found, skipping connection');
      return;
    }

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach((cb) => socket.on(event, cb));
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

  return { isConnected, on, socket: socketRef };
}

