import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from './session-manager.js';
import { FileHandler } from './file-handler.js';
import { RateLimiter } from './rate-limiter.js';
import { verifyAccessToken } from './auth.js';
import {
  decodeMessage,
  decodeJsonPayload,
  encodeTerminalData,
  encodeSessionList,
  encodeSessionOutput,
  encodeAuthOk,
  encodeError,
  encodePong,
  encodeFileList,
  encodeFileContent,
} from '../shared/protocol.js';
import {
  MessageType,
  SessionAction,
  type ResizePayload,
  type SessionControlPayload,
  type AuthPayload,
  type FileReadPayload,
  type FileWritePayload,
  type ServerConfig,
} from '../shared/types.js';
import { HEARTBEAT_INTERVAL_MS, AUTH_TIMEOUT_MS, SESSIONS_DIR } from '../shared/constants.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  authenticated: boolean;
  currentSessionId: string | null;
}

export interface TLSOptions {
  cert: Buffer;
  key: Buffer;
}

export class CCRServer {
  private wss: WebSocketServer | null = null;
  private httpServer: Server | null = null;
  private sessionManager: SessionManager;
  private fileHandler: FileHandler;
  private rateLimiter: RateLimiter;
  private config: ServerConfig;
  private tlsOptions?: TLSOptions;
  private baseDir: string;
  private webDir: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: ServerConfig, baseDir?: string, tlsOptions?: TLSOptions) {
    this.config = config;
    this.tlsOptions = tlsOptions;
    this.baseDir = baseDir ?? process.cwd();
    this.sessionManager = new SessionManager(this.baseDir);
    this.fileHandler = new FileHandler(join(this.baseDir, SESSIONS_DIR));
    this.rateLimiter = new RateLimiter(200, 1000); // 200 messages per second

    // Resolve web directory relative to this file's location
    const currentDir = typeof __dirname !== 'undefined'
      ? __dirname
      : fileURLToPath(new URL('.', import.meta.url));
    this.webDir = resolve(currentDir, '..', 'web');
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestHandler = (req: IncomingMessage, res: ServerResponse) => {
        this.handleHttpRequest(req, res);
      };

      if (this.tlsOptions) {
        this.httpServer = createHttpsServer(
          { cert: this.tlsOptions.cert, key: this.tlsOptions.key },
          requestHandler,
        ) as unknown as Server;
      } else {
        this.httpServer = createHttpServer(requestHandler);
      }

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

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // API routes
    if (pathname.startsWith('/api/')) {
      this.handleApiRequest(req, res, pathname);
      return;
    }

    // Static file serving for web IDE
    this.serveStaticFile(res, pathname);
  }

  private handleApiRequest(_req: IncomingMessage, res: ServerResponse, pathname: string): void {
    // Health check
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', sessions: this.sessionManager.getSessionCount() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private serveStaticFile(res: ServerResponse, pathname: string): void {
    // Default to index.html
    let filePath = pathname === '/' ? '/index.html' : pathname;

    // Prevent path traversal
    const normalizedPath = join(this.webDir, filePath);
    if (!normalizedPath.startsWith(this.webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(normalizedPath) || statSync(normalizedPath).isDirectory()) {
      // Try appending index.html for directory
      const indexPath = join(normalizedPath, 'index.html');
      if (existsSync(indexPath)) {
        this.sendFile(res, indexPath);
        return;
      }
      // Fallback to SPA routing
      const spaPath = join(this.webDir, 'index.html');
      if (existsSync(spaPath)) {
        this.sendFile(res, spaPath);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Web IDE not found. Place web files in src/web/');
      }
      return;
    }

    this.sendFile(res, normalizedPath);
  }

  private sendFile(res: ServerResponse, filePath: string): void {
    try {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const content = readFileSync(filePath);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
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
        this.sendSessionList(ws);
      }
    }

    // Check query param auth for web clients (ws://host:port?token=xxx)
    if (!ws.authenticated) {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        const payload = verifyAccessToken(queryToken, this.config);
        if (payload) {
          ws.authenticated = true;
          this.sendMessage(ws, encodeAuthOk());
          this.sendSessionList(ws);
        }
      }
    }

    // If not authenticated via header or query, wait for AUTH message
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
              this.sendSessionList(ws);
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

    // Rate limiting (use remote address as key)
    const clientKey = (ws as any)._socket?.remoteAddress ?? 'unknown';
    if (!this.rateLimiter.check(clientKey)) {
      this.sendMessage(ws, encodeError('RATE_LIMITED', 'Too many messages'));
      return;
    }

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

        case MessageType.FILE_LIST:
          this.handleFileList(ws, msg.payload);
          break;

        case MessageType.FILE_READ:
          this.handleFileRead(ws, msg.payload);
          break;

        case MessageType.FILE_WRITE:
          this.handleFileWrite(ws, msg.payload);
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
          cols: ctrl.cols,
          rows: ctrl.rows,
        });

        this.attachToSession(ws, session.id);
        this.broadcastSessionList();
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
        this.broadcastSessionList();
        break;
      }

      case SessionAction.LIST: {
        this.sendSessionList(ws);
        break;
      }
    }
  }

  private handleFileList(ws: AuthenticatedSocket, payload: Buffer): void {
    if (!ws.currentSessionId) {
      this.sendMessage(ws, encodeError('NO_SESSION', 'No session attached'));
      return;
    }
    const { path: reqPath } = decodeJsonPayload<{ path: string }>(payload);
    try {
      const files = this.fileHandler.listFiles(ws.currentSessionId, reqPath);
      this.sendMessage(ws, encodeFileList(reqPath, files));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.sendMessage(ws, encodeError('FILE_ERROR', message));
    }
  }

  private handleFileRead(ws: AuthenticatedSocket, payload: Buffer): void {
    if (!ws.currentSessionId) {
      this.sendMessage(ws, encodeError('NO_SESSION', 'No session attached'));
      return;
    }
    const { path: reqPath } = decodeJsonPayload<FileReadPayload>(payload);
    try {
      const result = this.fileHandler.readFile(ws.currentSessionId, reqPath);
      this.sendMessage(ws, encodeFileContent(reqPath, result.content, result.language));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.sendMessage(ws, encodeError('FILE_ERROR', message));
    }
  }

  private handleFileWrite(ws: AuthenticatedSocket, payload: Buffer): void {
    if (!ws.currentSessionId) {
      this.sendMessage(ws, encodeError('NO_SESSION', 'No session attached'));
      return;
    }
    const { path: reqPath, content } = decodeJsonPayload<{ path: string; content: string }>(payload);
    try {
      this.fileHandler.writeFile(ws.currentSessionId, reqPath, content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.sendMessage(ws, encodeError('FILE_ERROR', message));
    }
  }

  private attachToSession(ws: AuthenticatedSocket, sessionId: string): void {
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
        this.sendMessage(ws, encodeSessionOutput(sessionId, data));
      }
    });

    if (success) {
      ws.currentSessionId = sessionId;

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
    // Clean up rate limiter
    const clientKey = (ws as any)._socket?.remoteAddress ?? 'unknown';
    this.rateLimiter.remove(clientKey);
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

  private broadcastSessionList(): void {
    if (!this.wss) return;
    const sessions = this.sessionManager.listSessions();
    const data = encodeSessionList(sessions);
    this.wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedSocket;
      if (authWs.authenticated && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
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
