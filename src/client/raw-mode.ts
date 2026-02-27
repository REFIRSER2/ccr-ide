import { Connection } from './connection.js';
import { RawSessionManager } from './raw-session-manager.js';
import type { ErrorPayload, SessionInfo } from '../shared/types.js';

export interface RawModeOptions {
  host: string;
  port: number;
  token: string;
  sessionId?: string;
}

/**
 * Raw mode: directly relay stdin/stdout to/from the remote Claude Code CLI.
 * Minimal latency, no TUI overhead. Like SSH.
 *
 * Session management: Ctrl+B prefix for tmux-style session commands.
 */
export function startRawMode(opts: RawModeOptions): void {
  const conn = new Connection({
    host: opts.host,
    port: opts.port,
    token: opts.token,
    autoReconnect: true,
  });

  const sessionMgr = new RawSessionManager(conn);
  let sessionAttached = false;
  let outputPaused = false;
  let outputBuffer: Buffer[] = [];

  // Enter raw mode on stdin
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  conn.on('connected', () => {
    process.stderr.write('[CCR] Connected (Ctrl+B ? for help)\r\n');
  });

  conn.on('authenticated', () => {
    process.stderr.write('[CCR] Authenticated\r\n');

    if (opts.sessionId) {
      conn.attachSession(opts.sessionId);
      sessionMgr.currentSession = opts.sessionId;
    } else {
      conn.listSessions();
    }
  });

  conn.on('sessions', (sessions: SessionInfo[]) => {
    if (sessionAttached) return;

    if (sessions.length > 0 && !opts.sessionId) {
      const target = sessions.find(s => !s.connected) ?? sessions[0];
      process.stderr.write(`[CCR] Attaching to session: ${target.name} (${target.id})\r\n`);
      conn.attachSession(target.id);
      sessionMgr.currentSession = target.id;
      sessionAttached = true;
    } else if (sessions.length === 0) {
      process.stderr.write('[CCR] No sessions found, creating new session...\r\n');
      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;
      conn.createSession(undefined, undefined, cols, rows);
      sessionAttached = true;
    }
  });

  // Track session attachment from session-output events
  conn.on('session-output', (sessionId: string) => {
    if (!sessionMgr.currentSession) {
      sessionMgr.currentSession = sessionId;
    }
  });

  conn.on('data', (data: Buffer) => {
    if (outputPaused) {
      outputBuffer.push(data);
    } else {
      process.stdout.write(data);
    }
  });

  conn.on('server-error', (err: ErrorPayload) => {
    process.stderr.write(`[CCR Error] ${err.code}: ${err.message}\r\n`);
  });

  conn.on('disconnected', () => {
    process.stderr.write('[CCR] Disconnected\r\n');
    sessionAttached = false;
  });

  conn.on('reconnecting', (attempt: number, delay: number) => {
    process.stderr.write(`[CCR] Reconnecting (attempt ${attempt}, ${Math.round(delay / 1000)}s)...\r\n`);
  });

  conn.on('reconnect-failed', () => {
    process.stderr.write('[CCR] Max reconnection attempts reached. Exiting.\r\n');
    cleanup();
    process.exit(1);
  });

  conn.on('error', (err: Error) => {
    process.stderr.write(`[CCR] Connection error: ${err.message}\r\n`);
  });

  // Forward stdin through session manager (handles Ctrl+B prefix)
  process.stdin.on('data', (data: Buffer) => {
    const forwarded = sessionMgr.handleInput(data);
    if (forwarded !== null) {
      conn.sendInput(forwarded);
    }
  });

  // Forward terminal resize
  if (process.stdout.isTTY) {
    process.stdout.on('resize', () => {
      conn.sendResize(process.stdout.columns, process.stdout.rows);
    });

    conn.on('authenticated', () => {
      conn.sendResize(process.stdout.columns, process.stdout.rows);
    });
  }

  function cleanup() {
    sessionMgr.dispose();
    conn.disconnect();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  conn.connect();
}
