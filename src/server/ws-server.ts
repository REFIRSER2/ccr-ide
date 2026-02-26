import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { createServer, type Server } from 'node:http';
import { SessionManager } from './session-manager.js';
import { verifyAccessToken } from './auth.js';
import {
  decodeMessage,
  decodeJsonPayload,
  encodeTerminalData,
  encodeSessionList,
  encodeAuthOk,
  encodeError,
  encodePong,
} from '../shared/protocol.js';
import {
  MessageType,
  SessionAction,
  type ResizePayload,
  type SessionControlPayload,
  type AuthPayload,
  type ServerConfig,
} from '../shared/types.js';
import { HEARTBEAT_INTERVAL_MS, AUTH_TIMEOUT_MS } from '../shared/constants.js';

interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  authenticated: boolean;
  currentSessionId: string | null;
}

export class CCRServer {
  private wss: WebSocketServer | null = null;
  private httpServer: Server | null = null;
  private sessionManager: SessionManager;
  private config: ServerConfig;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: ServerConfig) {
    this.config = config;
    this.sessionManager = new SessionManager();
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer();

      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        this.handleConnection(ws as AuthenticatedSocket, req);
      });

      this.wss.on('error', (err) => {
        console.error('[CCR Server] WebSocket error:', err.message);
      });

      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.startHeartbeat();
        this.startCleanup();
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private handleConnection(ws: AuthenticatedSocket, req: IncomingMessage): void {
    ws.isAlive = true;
    ws.authenticated = false;
    ws.currentSessionId = null;
    ws.binaryType = 'arraybuffer';

    // Check header-based auth first
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token, this.config);
      if (payload) {
        ws.authenticated = true;
        this.sendMessage(ws, encodeAuthOk());
      }
    }

    // If not authenticated via header, wait for AUTH message
    if (!ws.authenticated) {
      const authTimeout = setTimeout(() => {
        if (!ws.authenticated) {
          this.sendMessage(ws, encodeError('AUTH_TIMEOUT', 'Authentication timeout'));
          ws.terminate();
        }
      }, AUTH_TIMEOUT_MS);

      ws.once('message', (raw: Buffer | ArrayBuffer) => {
        clearTimeout(authTimeout);
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        try {
          const msg = decodeMessage(buf);
          if (msg.type === MessageType.AUTH) {
            const { token } = decodeJsonPayload<AuthPayload>(msg.payload);
            const payload = verifyAccessToken(token, this.config);
            if (payload) {
              ws.authenticated = true;
              this.sendMessage(ws, encodeAuthOk());
              // Re-register the main message handler
              ws.on('message', (data: Buffer | ArrayBuffer) => this.handleMessage(ws, data));
            } else {
              this.sendMessage(ws, encodeError('AUTH_FAILED', 'Invalid token'));
              ws.terminate();
            }
          } else {
            this.sendMessage(ws, encodeError('AUTH_REQUIRED', 'Authentication required'));
            ws.terminate();
          }
        } catch {
          ws.terminate();
        }
      });
    } else {
      ws.on('message', (data: Buffer | ArrayBuffer) => this.handleMessage(ws, data));
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: AuthenticatedSocket, raw: Buffer | ArrayBuffer): void {
    if (!ws.authenticated) return;

    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    try {
      const msg = decodeMessage(buf);

      switch (msg.type) {
        case MessageType.TERMINAL_DATA:
          this.handleTerminalData(ws, msg.payload);
          break;

        case MessageType.RESIZE:
          this.handleResize(ws, msg.payload);
          break;

        case MessageType.PING:
          this.sendMessage(ws, encodePong());
          break;

        case MessageType.SESSION_CONTROL:
          this.handleSessionControl(ws, msg.payload);
          break;

        default:
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.sendMessage(ws, encodeError('PARSE_ERROR', message));
    }
  }

  private handleTerminalData(ws: AuthenticatedSocket, payload: Buffer): void {
    if (!ws.currentSessionId) {
      this.sendMessage(ws, encodeError('NO_SESSION', 'No session attached'));
      return;
    }

    const session = this.sessionManager.getSession(ws.currentSessionId);
    if (session) {
      session.write(payload);
    }
  }

  private handleResize(ws: AuthenticatedSocket, payload: Buffer): void {
    if (!ws.currentSessionId) return;

    const { cols, rows } = decodeJsonPayload<ResizePayload>(payload);
    const session = this.sessionManager.getSession(ws.currentSessionId);
    if (session) {
      session.resize(cols, rows);
    }
  }

  private handleSessionControl(ws: AuthenticatedSocket, payload: Buffer): void {
    const ctrl = decodeJsonPayload<SessionControlPayload>(payload);

    switch (ctrl.action) {
      case SessionAction.CREATE: {
        const session = this.sessionManager.createSession({
          name: ctrl.name,
          cwd: ctrl.cwd,
        });

        // Auto-attach to new session
        this.attachToSession(ws, session.id);

        // Send updated session list
        this.sendSessionList(ws);
        break;
      }

      case SessionAction.ATTACH: {
        if (!ctrl.sessionId) {
          this.sendMessage(ws, encodeError('MISSING_SESSION_ID', 'sessionId is required'));
          return;
        }
        this.attachToSession(ws, ctrl.sessionId);
        break;
      }

      case SessionAction.DETACH: {
        if (ws.currentSessionId) {
          this.sessionManager.detachClient(ws.currentSessionId);
          ws.currentSessionId = null;
        }
        break;
      }

      case SessionAction.DESTROY: {
        if (!ctrl.sessionId) {
          this.sendMessage(ws, encodeError('MISSING_SESSION_ID', 'sessionId is required'));
          return;
        }
        if (ws.currentSessionId === ctrl.sessionId) {
          ws.currentSessionId = null;
        }
        this.sessionManager.destroySession(ctrl.sessionId);
        this.sendSessionList(ws);
        break;
      }

      case SessionAction.LIST: {
        this.sendSessionList(ws);
        break;
      }
    }
  }

  private attachToSession(ws: AuthenticatedSocket, sessionId: string): void {
    // Detach from current session first
    if (ws.currentSessionId) {
      this.sessionManager.detachClient(ws.currentSessionId);
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      this.sendMessage(ws, encodeError('SESSION_NOT_FOUND', `Session ${sessionId} not found`));
      return;
    }

    const success = this.sessionManager.attachClient(sessionId, ws, (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, encodeTerminalData(data));
      }
    });

    if (success) {
      ws.currentSessionId = sessionId;

      // Send scrollback for reconnection
      const scrollback = session.getScrollback();
      if (scrollback.length > 0) {
        this.sendMessage(ws, encodeTerminalData(scrollback));
      }
    }
  }

  private handleDisconnect(ws: AuthenticatedSocket): void {
    if (ws.currentSessionId) {
      this.sessionManager.detachClient(ws.currentSessionId);
      ws.currentSessionId = null;
    }
  }

  private sendMessage(ws: WebSocket, data: Buffer): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  private sendSessionList(ws: WebSocket): void {
    const sessions = this.sessionManager.listSessions();
    this.sendMessage(ws, encodeSessionList(sessions));
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedSocket;
        if (!authWs.isAlive) {
          this.handleDisconnect(authWs);
          return authWs.terminate();
        }
        authWs.isAlive = false;
        ws.ping();
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startCleanup(): void {
    // Cleanup idle sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.sessionManager.cleanupIdleSessions();
      if (cleaned > 0) {
        console.log(`[CCR Server] Cleaned up ${cleaned} idle session(s)`);
      }
    }, 5 * 60 * 1000);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.sessionManager.destroyAll();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }
}
