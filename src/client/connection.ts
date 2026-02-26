import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import {
  decodeMessage,
  decodeJsonPayload,
  decodeSessionOutput,
  encodeAuth,
  encodeTerminalData,
  encodeResize,
  encodeSessionControl,
  encodePing,
} from '../shared/protocol.js';
import {
  MessageType,
  SessionAction,
  type ErrorPayload,
  type SessionInfo,
} from '../shared/types.js';
import {
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_MAX_ATTEMPTS,
  HEARTBEAT_INTERVAL_MS,
} from '../shared/constants.js';

export interface ConnectionOptions {
  host: string;
  port: number;
  token: string;
  autoReconnect?: boolean;
}

export class Connection extends EventEmitter {
  private ws: WebSocket | null = null;
  private opts: ConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _authenticated = false;
  private _lastSessionId: string | null = null;

  constructor(opts: ConnectionOptions) {
    super();
    this.opts = opts;
  }

  connect(): void {
    const url = `ws://${this.opts.host}:${this.opts.port}`;

    this.ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${this.opts.token}`,
      },
    });

    this.ws.binaryType = 'arraybuffer';

    this.ws.on('open', () => {
      this._connected = true;
      this.reconnectAttempts = 0;
      this.startPing();
      this.emit('connected');
    });

    this.ws.on('message', (raw: Buffer | ArrayBuffer) => {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      this.handleMessage(buf);
    });

    this.ws.on('close', () => {
      this._connected = false;
      this._authenticated = false;
      this.stopPing();
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  private handleMessage(buf: Buffer): void {
    try {
      const msg = decodeMessage(buf);

      switch (msg.type) {
        case MessageType.AUTH_OK:
          this._authenticated = true;
          this.emit('authenticated');

          // If we had a previous session, try to reattach
          if (this._lastSessionId) {
            this.attachSession(this._lastSessionId);
          }
          break;

        case MessageType.TERMINAL_DATA:
          this.emit('data', msg.payload);
          break;

        case MessageType.SESSION_OUTPUT: {
          const output = decodeSessionOutput(msg.payload);
          this.emit('data', output.data);
          this.emit('session-output', output.sessionId, output.data);
          break;
        }

        case MessageType.SESSION_LIST: {
          const sessions = decodeJsonPayload<SessionInfo[]>(msg.payload);
          this.emit('sessions', sessions);
          break;
        }

        case MessageType.ERROR: {
          const error = decodeJsonPayload<ErrorPayload>(msg.payload);
          this.emit('server-error', error);
          break;
        }

        case MessageType.PONG:
          this.emit('pong');
          break;

        default:
          break;
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  sendInput(data: string | Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeTerminalData(data));
  }

  sendResize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeResize(cols, rows));
  }

  createSession(name?: string, cwd?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeSessionControl(SessionAction.CREATE, undefined, { name, cwd }));
  }

  attachSession(sessionId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this._lastSessionId = sessionId;
    this.ws.send(encodeSessionControl(SessionAction.ATTACH, sessionId));
  }

  detachSession(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeSessionControl(SessionAction.DETACH));
  }

  destroySession(sessionId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeSessionControl(SessionAction.DESTROY, sessionId));
  }

  listSessions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeSessionControl(SessionAction.LIST));
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(encodePing());
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.opts.autoReconnect) return;
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.emit('reconnect-failed');
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      RECONNECT_MAX_DELAY_MS
    );

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts, delay);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();

    // Disable auto-reconnect for intentional disconnect
    this.opts.autoReconnect = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._connected = false;
    this._authenticated = false;
  }

  get connected(): boolean {
    return this._connected;
  }

  get authenticated(): boolean {
    return this._authenticated;
  }
}
