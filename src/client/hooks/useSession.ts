import { useState, useEffect, useCallback } from 'react';
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

export function useSession(connection: Connection | null): UseSessionResult {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!connection) return;

    const handleSessions = (list: SessionInfo[]) => {
      setSessions(list);

      // Auto-attach to first session if none active
      if (!activeSessionId && list.length > 0) {
        const target = list.find(s => !s.connected) ?? list[0];
        setActiveSessionId(target.id);
        connection.attachSession(target.id);
      }
    };

    connection.on('sessions', handleSessions);
    return () => {
      connection.removeListener('sessions', handleSessions);
    };
  }, [connection, activeSessionId]);

  const createSession = useCallback((name?: string) => {
    if (!connection) return;
    connection.createSession(name);
  }, [connection]);

  const attachSession = useCallback((sessionId: string) => {
    if (!connection) return;
    setActiveSessionId(sessionId);
    connection.attachSession(sessionId);
  }, [connection]);

  const destroySession = useCallback((sessionId: string) => {
    if (!connection) return;
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
    connection.destroySession(sessionId);
  }, [connection, activeSessionId]);

  const refreshSessions = useCallback(() => {
    if (!connection) return;
    connection.listSessions();
  }, [connection]);

  return {
    sessions,
    activeSessionId,
    createSession,
    attachSession,
    destroySession,
    refreshSessions,
  };
}
