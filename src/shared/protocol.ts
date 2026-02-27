import { MessageType } from './types.js';

/**
 * Binary message protocol:
 * [1 byte: MessageType][payload bytes]
 *
 * TERMINAL_DATA: payload is raw PTY bytes
 * Other types: payload is JSON-encoded string
 */

export function encodeMessage(type: MessageType, payload: Buffer | string | object): Buffer {
  const typeBuf = Buffer.alloc(1);
  typeBuf[0] = type;

  let payloadBuf: Buffer;

  if (type === MessageType.TERMINAL_DATA) {
    payloadBuf = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload as Buffer;
  } else if (type === MessageType.PING || type === MessageType.PONG) {
    payloadBuf = Buffer.alloc(0);
  } else {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    payloadBuf = Buffer.from(json, 'utf-8');
  }

  return Buffer.concat([typeBuf, payloadBuf]);
}

export interface DecodedMessage {
  type: MessageType;
  payload: Buffer;
}

export function decodeMessage(data: Buffer | ArrayBuffer | Uint8Array): DecodedMessage {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);

  if (buf.length < 1) {
    throw new Error('Message too short: missing type byte');
  }

  const type = buf[0] as MessageType;
  const payload = buf.subarray(1);

  return { type, payload };
}

export function decodeJsonPayload<T>(payload: Buffer): T {
  return JSON.parse(payload.toString('utf-8')) as T;
}

export function encodeTerminalData(data: string | Buffer): Buffer {
  return encodeMessage(MessageType.TERMINAL_DATA, data);
}

export function encodePing(): Buffer {
  return encodeMessage(MessageType.PING, '');
}

export function encodePong(): Buffer {
  return encodeMessage(MessageType.PONG, '');
}

export function encodeResize(cols: number, rows: number): Buffer {
  return encodeMessage(MessageType.RESIZE, { cols, rows });
}

export function encodeSessionControl(action: string, sessionId?: string, opts?: Record<string, unknown>): Buffer {
  return encodeMessage(MessageType.SESSION_CONTROL, { action, sessionId, ...opts });
}

export function encodeAuth(token: string): Buffer {
  return encodeMessage(MessageType.AUTH, { token });
}

export function encodeAuthOk(): Buffer {
  return encodeMessage(MessageType.AUTH_OK, { status: 'ok' });
}

export function encodeError(code: string, message: string): Buffer {
  return encodeMessage(MessageType.ERROR, { code, message });
}

export function encodeSessionList(sessions: unknown[]): Buffer {
  return encodeMessage(MessageType.SESSION_LIST, sessions);
}

export function encodeFileList(path: string, files: unknown[]): Buffer {
  return encodeMessage(MessageType.FILE_LIST, { path, files });
}

export function encodeFileRead(path: string): Buffer {
  return encodeMessage(MessageType.FILE_READ, { path });
}

export function encodeFileContent(path: string, content: string, language: string): Buffer {
  return encodeMessage(MessageType.FILE_CONTENT, { path, content, language });
}

export function encodeFileWrite(path: string, content: string): Buffer {
  return encodeMessage(MessageType.FILE_WRITE, { path, content });
}

/**
 * Encodes terminal output data along with the sessionId it belongs to.
 * Format: [1 byte type][8 bytes sessionId length (LE uint32) + sessionId string][terminal data]
 */
export function encodeSessionOutput(sessionId: string, data: Buffer | string): Buffer {
  const typeBuf = Buffer.alloc(1);
  typeBuf[0] = MessageType.SESSION_OUTPUT;

  const sessionIdBuf = Buffer.from(sessionId, 'utf-8');
  const sessionIdLenBuf = Buffer.alloc(4);
  sessionIdLenBuf.writeUInt32LE(sessionIdBuf.length, 0);

  const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

  return Buffer.concat([typeBuf, sessionIdLenBuf, sessionIdBuf, dataBuf]);
}

/**
 * Decodes a SESSION_OUTPUT message payload into sessionId and terminal data.
 */
export function decodeSessionOutput(payload: Buffer): { sessionId: string; data: Buffer } {
  const sessionIdLen = payload.readUInt32LE(0);
  const sessionId = payload.subarray(4, 4 + sessionIdLen).toString('utf-8');
  const data = payload.subarray(4 + sessionIdLen);
  return { sessionId, data };
}
