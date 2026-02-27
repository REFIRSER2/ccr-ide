import type { Connection } from './connection.js';
import type { SessionInfo } from '../shared/types.js';

const CTRL_B = 0x02;

export type SessionManagerState = 'normal' | 'prefix' | 'list';

export class RawSessionManager {
  private state: SessionManagerState = 'normal';
  private conn: Connection;
  private sessions: SessionInfo[] = [];
  private currentSessionId: string | null = null;
  private prefixTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(conn: Connection) {
    this.conn = conn;

    this.conn.on('sessions', (sessions: SessionInfo[]) => {
      this.sessions = sessions;
    });
  }

  get currentSession(): string | null {
    return this.currentSessionId;
  }

  set currentSession(id: string | null) {
    this.currentSessionId = id;
  }

  /**
   * Process a chunk of stdin data.
   * Returns data that should be forwarded to the server (or null if consumed).
   */
  handleInput(data: Buffer): Buffer | null {
    if (this.state === 'list') {
      this.handleListInput(data);
      return null;
    }

    if (this.state === 'prefix') {
      this.clearPrefixTimeout();
      this.state = 'normal';
      return this.handlePrefixCommand(data);
    }

    // Check for Ctrl+B in normal mode
    if (data.length === 1 && data[0] === CTRL_B) {
      this.state = 'prefix';
      this.showPrefixIndicator();
      // Auto-exit prefix mode after 2 seconds
      this.prefixTimeout = setTimeout(() => {
        if (this.state === 'prefix') {
          this.state = 'normal';
          this.clearStatusLine();
        }
      }, 2000);
      return null;
    }

    // Check for Ctrl+B embedded in larger data (fast typing)
    const ctrlBIndex = data.indexOf(CTRL_B);
    if (ctrlBIndex !== -1 && data.length > 1) {
      // Send everything before Ctrl+B
      const before = data.subarray(0, ctrlBIndex);
      // Process the byte after Ctrl+B as command
      if (ctrlBIndex + 1 < data.length) {
        const cmdByte = data.subarray(ctrlBIndex + 1, ctrlBIndex + 2);
        this.handlePrefixCommand(cmdByte);
        // Send everything after the command byte
        const after = data.subarray(ctrlBIndex + 2);
        if (before.length > 0 && after.length > 0) {
          return Buffer.concat([before, after]);
        }
        return before.length > 0 ? before : (after.length > 0 ? after : null);
      }
      // Ctrl+B was last byte - enter prefix mode
      this.state = 'prefix';
      this.showPrefixIndicator();
      return before.length > 0 ? before : null;
    }

    return data;
  }

  private handlePrefixCommand(data: Buffer): Buffer | null {
    if (data.length === 0) return null;

    const key = String.fromCharCode(data[0]);

    switch (key) {
      case 'c': // Create new session
        this.createNewSession();
        return null;

      case 'n': // Next session
        this.switchSession(1);
        return null;

      case 'p': // Previous session
        this.switchSession(-1);
        return null;

      case 'l': // List sessions
        this.showSessionList();
        return null;

      case 'd': // Detach
        this.detachSession();
        return null;

      case '?': // Help
        this.showHelp();
        return null;

      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        this.switchToSessionNumber(parseInt(key, 10));
        return null;

      default:
        // Unknown command - ignore
        this.clearStatusLine();
        return null;
    }
  }

  private handleListInput(data: Buffer): void {
    if (data.length === 0) return;

    const key = data[0];

    // Escape or 'q' to exit list
    if (key === 0x1b || key === 0x71) { // ESC or 'q'
      this.state = 'normal';
      this.clearStatusLine();
      return;
    }

    // Number keys to select session
    if (key >= 0x30 && key <= 0x39) { // '0'-'9'
      const idx = key - 0x30;
      if (idx < this.sessions.length) {
        this.state = 'normal';
        this.switchToSession(this.sessions[idx].id);
      }
      return;
    }

    // Enter to select first unconnected
    if (key === 0x0d) { // Enter
      const target = this.sessions.find(s => !s.connected) ?? this.sessions[0];
      if (target) {
        this.state = 'normal';
        this.switchToSession(target.id);
      }
      return;
    }
  }

  private createNewSession(): void {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    process.stderr.write('\r\n[CCR] Creating new session...\r\n');
    this.conn.createSession(undefined, undefined, cols, rows);
  }

  private switchSession(direction: number): void {
    if (this.sessions.length <= 1) {
      this.showStatus('Only one session');
      return;
    }

    const currentIdx = this.sessions.findIndex(s => s.id === this.currentSessionId);
    let nextIdx = currentIdx + direction;
    if (nextIdx < 0) nextIdx = this.sessions.length - 1;
    if (nextIdx >= this.sessions.length) nextIdx = 0;

    this.switchToSession(this.sessions[nextIdx].id);
  }

  private switchToSessionNumber(num: number): void {
    if (num >= this.sessions.length) {
      this.showStatus(`No session #${num}`);
      return;
    }
    this.switchToSession(this.sessions[num].id);
  }

  private switchToSession(sessionId: string): void {
    if (sessionId === this.currentSessionId) {
      this.clearStatusLine();
      return;
    }

    const session = this.sessions.find(s => s.id === sessionId);
    const name = session?.name ?? sessionId;
    process.stderr.write(`\r\n[CCR] Switching to: ${name}\r\n`);
    this.currentSessionId = sessionId;
    this.conn.attachSession(sessionId);
  }

  private detachSession(): void {
    process.stderr.write('\r\n[CCR] Detached from session.\r\n');
    this.conn.detachSession();
    this.currentSessionId = null;
  }

  private showSessionList(): void {
    this.state = 'list';
    process.stderr.write('\r\n[CCR] Sessions:\r\n');
    this.sessions.forEach((s, i) => {
      const active = s.id === this.currentSessionId ? '>' : ' ';
      const status = s.connected ? '*' : ' ';
      process.stderr.write(`  ${active}${i} ${status} ${s.name} (${s.id})\r\n`);
    });
    process.stderr.write('[CCR] Press 0-9 to select, q/ESC to cancel\r\n');
  }

  private showHelp(): void {
    process.stderr.write('\r\n[CCR] Ctrl+B shortcuts:\r\n');
    process.stderr.write('  c   Create new session\r\n');
    process.stderr.write('  n   Next session\r\n');
    process.stderr.write('  p   Previous session\r\n');
    process.stderr.write('  l   List sessions\r\n');
    process.stderr.write('  d   Detach session\r\n');
    process.stderr.write('  0-9 Switch to session #\r\n');
    process.stderr.write('  ?   Show this help\r\n');
  }

  private showPrefixIndicator(): void {
    process.stderr.write('\r[CCR] ');
  }

  private showStatus(msg: string): void {
    process.stderr.write(`\r\n[CCR] ${msg}\r\n`);
  }

  private clearStatusLine(): void {
    // Clear the prefix indicator
    process.stderr.write('\r\x1b[K');
  }

  private clearPrefixTimeout(): void {
    if (this.prefixTimeout) {
      clearTimeout(this.prefixTimeout);
      this.prefixTimeout = null;
    }
  }

  dispose(): void {
    this.clearPrefixTimeout();
  }
}
