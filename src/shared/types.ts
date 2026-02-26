export enum MessageType {
  TERMINAL_DATA = 0x00,
  RESIZE = 0x01,
  PING = 0x02,
  PONG = 0x03,
  SESSION_CONTROL = 0x04,
  AUTH = 0x05,
  ERROR = 0x06,
  SESSION_LIST = 0x07,
  AUTH_OK = 0x08,
}

export enum SessionAction {
  CREATE = 'create',
  ATTACH = 'attach',
  DETACH = 'detach',
  DESTROY = 'destroy',
  LIST = 'list',
}

export interface ResizePayload {
  cols: number;
  rows: number;
}

export interface SessionControlPayload {
  action: SessionAction;
  sessionId?: string;
  name?: string;
  cwd?: string;
}

export interface AuthPayload {
  token: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  createdAt: string;
  lastActivity: string;
  connected: boolean;
  pid: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
}

export interface ClientConfig {
  host: string;
  port: number;
  token: string;
  raw: boolean;
}
