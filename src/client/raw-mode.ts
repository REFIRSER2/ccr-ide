import { Connection } from './connection.js';
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
 */
export function startRawMode(opts: RawModeOptions): void {
  const conn = new Connection({
    host: opts.host,
    port: opts.port,
    token: opts.token,
    autoReconnect: true,
  });

  let sessionAttached = false;

  // Enter raw mode on stdin
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  conn.on('connected', () => {
    process.stderr.write('[CCR] Connected to server\r\n');
  });

  conn.on('authenticated', () => {
    process.stderr.write('[CCR] Authenticated\r\n');

    if (opts.sessionId) {
      conn.attachSession(opts.sessionId);
    } else {
      // Request session list to pick or create
      conn.listSessions();
    }
  });

  conn.on('sessions', (sessions: SessionInfo[]) => {
    if (sessionAttached) return;

    if (sessions.length > 0 && !opts.sessionId) {
      // Attach to the first available session
      const target = sessions.find(s => !s.connected) ?? sessions[0];
      process.stderr.write(`[CCR] Attaching to session: ${target.name} (${target.id})\r\n`);
      conn.attachSession(target.id);
      sessionAttached = true;
    } else if (sessions.length === 0) {
      // Create a new session
      process.stderr.write('[CCR] No sessions found, creating new session...\r\n');
      conn.createSession();
      sessionAttached = true;
    }
  });

  conn.on('data', (data: Buffer) => {
    process.stdout.write(data);
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

  // Forward stdin to server
  process.stdin.on('data', (data: Buffer) => {
    conn.sendInput(data);
  });

  // Forward terminal resize
  if (process.stdout.isTTY) {
    process.stdout.on('resize', () => {
      conn.sendResize(process.stdout.columns, process.stdout.rows);
    });

    // Send initial size
    conn.on('authenticated', () => {
      conn.sendResize(process.stdout.columns, process.stdout.rows);
    });
  }

  // Cleanup on exit
  function cleanup() {
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

  // Start connection
  conn.connect();
}
