import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection } from '../connection.js';
import type { ErrorPayload } from '../../shared/types.js';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'reconnecting';

export interface UseConnectionOptions {
  host: string;
  port: number;
  token: string;
}

export interface UseConnectionResult {
  connectionRef: React.RefObject<Connection | null>;
  status: ConnectionStatus;
  error: string | null;
  latency: number;
  connect: () => void;
  disconnect: () => void;
}

export function useConnection(opts: UseConnectionOptions): UseConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const connectionRef = useRef<Connection | null>(null);
  const pingTimeRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
    }

    const conn = new Connection({
      host: opts.host,
      port: opts.port,
      token: opts.token,
      autoReconnect: true,
    });

    conn.on('connected', () => {
      setStatus('connected');
      setError(null);
    });

    conn.on('authenticated', () => {
      setStatus('authenticated');
    });

    conn.on('disconnected', () => {
      setStatus('disconnected');
    });

    conn.on('reconnecting', () => {
      setStatus('reconnecting');
    });

    conn.on('reconnect-failed', () => {
      setStatus('disconnected');
      setError('Max reconnection attempts reached');
    });

    conn.on('server-error', (err: ErrorPayload) => {
      setError(`${err.code}: ${err.message}`);
    });

    conn.on('error', (err: Error) => {
      if (err.message !== 'WebSocket was closed before the connection was established') {
        setError(err.message);
      }
    });

    conn.on('pong', () => {
      if (pingTimeRef.current > 0) {
        setLatency(Date.now() - pingTimeRef.current);
        pingTimeRef.current = 0;
      }
    });

    connectionRef.current = conn;
    setStatus('connecting');
    conn.connect();
  }, [opts.host, opts.port, opts.token]);

  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Latency measurement
  useEffect(() => {
    const interval = setInterval(() => {
      if (connectionRef.current?.connected) {
        pingTimeRef.current = Date.now();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  return {
    connectionRef,
    status,
    error,
    latency,
    connect,
    disconnect,
  };
}
