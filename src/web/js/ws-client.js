/**
 * WebSocket client for CCR Web IDE.
 * Handles binary protocol encoding/decoding matching the server protocol.
 */

// Message types must match src/shared/types.ts
const MessageType = {
  TERMINAL_DATA: 0x00,
  RESIZE: 0x01,
  PING: 0x02,
  PONG: 0x03,
  SESSION_CONTROL: 0x04,
  AUTH: 0x05,
  ERROR: 0x06,
  SESSION_LIST: 0x07,
  AUTH_OK: 0x08,
  SESSION_OUTPUT: 0x09,
  FILE_LIST: 0x0a,
  FILE_READ: 0x0b,
  FILE_CONTENT: 0x0c,
  FILE_WRITE: 0x0d,
};

class WSClient extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectBaseDelay = 1000;
    this.reconnectMaxDelay = 30000;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.token = null;
  }

  connect(token) {
    this.token = token;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._emit('connected');
      this._startPing();
    };

    this.ws.onmessage = (event) => {
      this._handleMessage(event.data);
    };

    this.ws.onclose = () => {
      this.authenticated = false;
      this._stopPing();
      this._emit('disconnected');
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this._emit('error', { message: 'WebSocket error' });
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._stopPing();
    this.maxReconnectAttempts = 0; // Prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // --- Send methods ---

  sendTerminalData(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    this._send(MessageType.TERMINAL_DATA, data);
  }

  sendResize(cols, rows) {
    this._sendJson(MessageType.RESIZE, { cols, rows });
  }

  createSession(name, cwd, cols, rows) {
    this._sendJson(MessageType.SESSION_CONTROL, {
      action: 'create', name, cwd, cols, rows,
    });
  }

  attachSession(sessionId) {
    this._sendJson(MessageType.SESSION_CONTROL, {
      action: 'attach', sessionId,
    });
  }

  detachSession() {
    this._sendJson(MessageType.SESSION_CONTROL, { action: 'detach' });
  }

  destroySession(sessionId) {
    this._sendJson(MessageType.SESSION_CONTROL, {
      action: 'destroy', sessionId,
    });
  }

  listSessions() {
    this._sendJson(MessageType.SESSION_CONTROL, { action: 'list' });
  }

  requestFileList(path) {
    this._sendJson(MessageType.FILE_LIST, { path: path || '.' });
  }

  requestFileRead(path) {
    this._sendJson(MessageType.FILE_READ, { path });
  }

  sendFileWrite(path, content) {
    this._sendJson(MessageType.FILE_WRITE, { path, content });
  }

  // --- Internal ---

  _send(type, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const typeBuf = new Uint8Array([type]);
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
      const payloadBuf = payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload;
      const msg = new Uint8Array(1 + payloadBuf.length);
      msg[0] = type;
      msg.set(payloadBuf, 1);
      this.ws.send(msg.buffer);
    } else {
      const msg = new Uint8Array(1);
      msg[0] = type;
      this.ws.send(msg.buffer);
    }
  }

  _sendJson(type, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const json = JSON.stringify(payload);
    const encoded = new TextEncoder().encode(json);
    const msg = new Uint8Array(1 + encoded.length);
    msg[0] = type;
    msg.set(encoded, 1);
    this.ws.send(msg.buffer);
  }

  _handleMessage(data) {
    const buf = new Uint8Array(data);
    if (buf.length < 1) return;

    const type = buf[0];
    const payload = buf.slice(1);

    switch (type) {
      case MessageType.AUTH_OK:
        this.authenticated = true;
        this._emit('authenticated');
        break;

      case MessageType.TERMINAL_DATA:
        this._emit('terminal-data', payload);
        break;

      case MessageType.SESSION_OUTPUT: {
        // Decode: [4-byte LE length][sessionId][data]
        if (payload.length < 4) break;
        const view = new DataView(payload.buffer, payload.byteOffset, payload.length);
        const idLen = view.getUint32(0, true);
        const sessionId = new TextDecoder().decode(payload.slice(4, 4 + idLen));
        const termData = payload.slice(4 + idLen);
        this._emit('terminal-data', termData);
        this._emit('session-output', { sessionId, data: termData });
        break;
      }

      case MessageType.SESSION_LIST: {
        const sessions = JSON.parse(new TextDecoder().decode(payload));
        this._emit('sessions', sessions);
        break;
      }

      case MessageType.FILE_LIST: {
        const fileList = JSON.parse(new TextDecoder().decode(payload));
        this._emit('file-list', fileList);
        break;
      }

      case MessageType.FILE_CONTENT: {
        const fileContent = JSON.parse(new TextDecoder().decode(payload));
        this._emit('file-content', fileContent);
        break;
      }

      case MessageType.ERROR: {
        const error = JSON.parse(new TextDecoder().decode(payload));
        this._emit('server-error', error);
        break;
      }

      case MessageType.PONG:
        this._emit('pong');
        break;
    }
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  _startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msg = new Uint8Array([MessageType.PING]);
        this.ws.send(msg.buffer);
      }
    }, 30000);
  }

  _stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._emit('reconnect-failed');
      return;
    }

    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.reconnectMaxDelay,
    );

    this.reconnectAttempts++;
    this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }
}

// Export as global
window.WSClient = WSClient;
window.MessageType = MessageType;
