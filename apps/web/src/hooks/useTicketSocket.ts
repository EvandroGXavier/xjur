import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Hook reutilizável para conexão WebSocket com o backend.
 * Conecta ao namespace /tickets com autenticação JWT.
 *
 * Eventos disponíveis:
 *  - ticket:new      → novo ticket criado
 *  - ticket:updated   → ticket atualizado (status, etc)
 *  - ticket:message   → nova mensagem em um ticket
 */
export function useTicketSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  // Build socket URL
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
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ useTicketSocket: No token found, skipping connection');
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

    socket.on('connect', () => {
      console.log('🔌 [TicketSocket] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [TicketSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ [TicketSocket] Connection error:', err.message);
      setIsConnected(false);
    });

    // Re-attach any existing listeners (for hot-reload scenarios)
    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach((cb) => socket.on(event, cb));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  /**
   * Subscribe to a socket event. Returns an unsubscribe function.
   */
  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      // Track listener
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(callback);

      // If socket is already connected, attach now
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }

      // Return unsubscribe
      return () => {
        listenersRef.current.get(event)?.delete(callback);
        if (socketRef.current) {
          socketRef.current.off(event, callback);
        }
      };
    },
    [],
  );

  return { isConnected, on, socket: socketRef };
}
