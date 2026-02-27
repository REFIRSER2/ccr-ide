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
  SESSION_OUTPUT = 0x09,
  FILE_LIST = 0x0a,
  FILE_READ = 0x0b,
  FILE_CONTENT = 0x0c,
  FILE_WRITE = 0x0d,
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
  cols?: number;
  rows?: number;
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

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
}

export interface FileListPayload {
  path: string;
  files: FileEntry[];
}

export interface FileReadPayload {
  path: string;
}

export interface FileContentPayload {
  path: string;
  content: string;
  language: string;
}

export interface FileWritePayload {
  path: string;
  content: string;
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
