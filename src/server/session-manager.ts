import crypto from 'node:crypto';
import { PtySession, type PtySessionOptions } from './pty-session.js';
import type { SessionInfo } from '../shared/types.js';
import type WebSocket from 'ws';

interface ManagedSession {
  session: PtySession;
  client: WebSocket | null;
  onData: (data: Buffer) => void;
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>();

  createSession(opts?: Partial<Pick<PtySessionOptions, 'name' | 'cwd' | 'cols' | 'rows'>>): PtySession {
    const id = crypto.randomUUID().slice(0, 8);
    const name = opts?.name ?? `session-${id}`;

    const session = new PtySession({
      id,
      name,
      cwd: opts?.cwd,
      cols: opts?.cols,
      rows: opts?.rows,
    });

    const managed: ManagedSession = {
      session,
      client: null,
      onData: () => {},
    };

    session.on('exit', () => {
      this.sessions.delete(id);
    });

    this.sessions.set(id, managed);
    return session;
  }

  attachClient(sessionId: string, ws: WebSocket, onData: (data: Buffer) => void): boolean {
    const managed = this.sessions.get(sessionId);
    if (!managed) return false;

    // Detach previous client if any
    if (managed.client) {
      managed.session.removeListener('data', managed.onData);
    }

    managed.client = ws;
    managed.onData = onData;
    managed.session.on('data', onData);

    return true;
  }

  detachClient(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    managed.session.removeListener('data', managed.onData);
    managed.client = null;
    managed.onData = () => {};
  }

  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  getSessionForClient(ws: WebSocket): PtySession | undefined {
    for (const managed of this.sessions.values()) {
      if (managed.client === ws) return managed.session;
    }
    return undefined;
  }

  destroySession(sessionId: string): boolean {
    const managed = this.sessions.get(sessionId);
    if (!managed) return false;

    managed.session.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  listSessions(): SessionInfo[] {
    const list: SessionInfo[] = [];
    for (const managed of this.sessions.values()) {
      const info = managed.session.toJSON();
      info.connected = managed.client !== null;
      list.push(info);
    }
    return list;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroySession(id);
    }
  }

  cleanupIdleSessions(): number {
    let cleaned = 0;
    for (const [id, managed] of this.sessions) {
      if (managed.client === null && managed.session.isIdle()) {
        managed.session.kill();
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
