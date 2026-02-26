import { useState, useEffect, useCallback, type RefObject } from 'react';
import type { Connection } from '../connection.js';
import type { SessionInfo } from '../../shared/types.js';

export interface UseSessionResult {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  createSession: (name?: string) => void;
  attachSession: (sessionId: string) => void;
  destroySession: (sessionId: string) => void;
  refreshSessions: () => void;
}

export function useSession(connectionRef: RefObject<Connection | null>): UseSessionResult {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    const handleSessions = (list: SessionInfo[]) => {
      setSessions(list);
    };

    conn.on('sessions', handleSessions);
    return () => {
      conn.removeListener('sessions', handleSessions);
    };
  }, [connectionRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = useCallback((name?: string) => {
    connectionRef.current?.createSession(name);
  }, [connectionRef]);

  const attachSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    connectionRef.current?.attachSession(sessionId);
  }, [connectionRef]);

  const destroySession = useCallback((sessionId: string) => {
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
    connectionRef.current?.destroySession(sessionId);
  }, [connectionRef, activeSessionId]);

  const refreshSessions = useCallback(() => {
    connectionRef.current?.listSessions();
  }, [connectionRef]);

  return {
    sessions,
    activeSessionId,
    createSession,
    attachSession,
    destroySession,
    refreshSessions,
  };
}
