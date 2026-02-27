import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PtySession, type PtySessionOptions } from './pty-session.js';
import type { SessionInfo } from '../shared/types.js';
import { SESSIONS_DIR } from '../shared/constants.js';
import type WebSocket from 'ws';

interface ManagedSession {
  session: PtySession;
  client: WebSocket | null;
  onData: (data: Buffer) => void;
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>();
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
    // Ensure sessions directory exists
    const sessionsDir = join(this.baseDir, SESSIONS_DIR);
    mkdirSync(sessionsDir, { recursive: true });
  }

  createSession(opts?: Partial<Pick<PtySessionOptions, 'name' | 'cwd' | 'cols' | 'rows'>>): PtySession {
    const id = crypto.randomUUID().slice(0, 8);
    const name = opts?.name ?? `session-${id}`;

    // Create isolated session folder
    const sessionDir = join(this.baseDir, SESSIONS_DIR, id);
    mkdirSync(sessionDir, { recursive: true });

    const session = new PtySession({
      id,
      name,
      cwd: opts?.cwd ?? sessionDir,
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

  /**
   * Returns all sessions where the given WebSocket is the connected client.
   */
  getSessionsForClient(ws: WebSocket): PtySession[] {
    const result: PtySession[] = [];
    for (const managed of this.sessions.values()) {
      if (managed.client === ws) {
        result.push(managed.session);
      }
    }
    return result;
  }

  /**
   * Returns the first session whose name matches the given string.
   */
  findSessionByName(name: string): PtySession | undefined {
    for (const managed of this.sessions.values()) {
      if (managed.session.name === name) {
        return managed.session;
      }
    }
    return undefined;
  }

  /**
   * If no sessions exist, creates a new default session and returns it.
   * Otherwise, returns the first available (non-connected) session,
   * or the very first session if all are occupied.
   */
  getOrCreateDefaultSession(): PtySession {
    if (this.sessions.size === 0) {
      return this.createSession({ name: 'default' });
    }

    // Prefer an unoccupied session
    for (const managed of this.sessions.values()) {
      if (managed.client === null) {
        return managed.session;
      }
    }

    // All sessions are occupied; return the first one
    return this.sessions.values().next().value!.session;
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
        const idleMinutes = Math.round(
          (Date.now() - managed.session.lastActivity.getTime()) / 60_000,
        );
        console.log(
          `[SessionManager] Cleaning up idle session: id=${id}, name="${managed.session.name}", idle for ${idleMinutes}m`,
        );
        managed.session.kill();
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
