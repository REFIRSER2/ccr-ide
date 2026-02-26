import * as pty from 'node-pty';
import { EventEmitter } from 'node:events';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RingBuffer } from './ring-buffer.js';
import {
  SCROLLBACK_MAX_BYTES,
  DEFAULT_PTY_COLS,
  DEFAULT_PTY_ROWS,
  SESSION_IDLE_TIMEOUT_MS,
} from '../shared/constants.js';

export interface PtySessionOptions {
  id: string;
  name: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  /** Additional CLI args to pass to claude (e.g. ['--continue'] for session resumption) */
  args?: string[];
}

export class PtySession extends EventEmitter {
  readonly id: string;
  readonly name: string;
  readonly cwd: string;
  readonly createdAt: Date;
  readonly args: string[];
  lastActivity: Date;

  private ptyProcess: pty.IPty;
  private scrollback: RingBuffer;
  private _exited = false;

  constructor(opts: PtySessionOptions) {
    super();
    this.id = opts.id;
    this.name = opts.name;
    this.cwd = opts.cwd ?? process.cwd();
    this.args = opts.args ?? [];
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.scrollback = new RingBuffer(SCROLLBACK_MAX_BYTES);

    const claudePath = findClaudePath();
    const cols = opts.cols ?? DEFAULT_PTY_COLS;
    const rows = opts.rows ?? DEFAULT_PTY_ROWS;

    this.ptyProcess = pty.spawn(claudePath, this.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: this.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    });

    this.ptyProcess.onData((data: string) => {
      this.lastActivity = new Date();
      const buf = Buffer.from(data, 'utf-8');
      this.scrollback.push(buf);
      this.emit('data', buf);
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this._exited = true;
      this.emit('exit', exitCode, signal);
    });
  }

  write(data: string | Buffer): void {
    if (this._exited) return;
    const str = typeof data === 'string' ? data : data.toString('utf-8');
    this.lastActivity = new Date();
    this.ptyProcess.write(str);
  }

  resize(cols: number, rows: number): void {
    if (this._exited) return;
    this.ptyProcess.resize(cols, rows);
  }

  getScrollback(): Buffer {
    return this.scrollback.getAll();
  }

  get pid(): number {
    return this.ptyProcess.pid;
  }

  get exited(): boolean {
    return this._exited;
  }

  isIdle(): boolean {
    return Date.now() - this.lastActivity.getTime() > SESSION_IDLE_TIMEOUT_MS;
  }

  kill(): void {
    if (!this._exited) {
      this.ptyProcess.kill();
    }
    this.scrollback.clear();
    this.removeAllListeners();
  }

  /**
   * Returns the full serializable state of this session, including scrollback data.
   * Useful for session persistence / snapshot to disk.
   */
  getState(): {
    id: string;
    name: string;
    cwd: string;
    args: string[];
    createdAt: string;
    lastActivity: string;
    exited: boolean;
    pid: number;
    scrollback: ReturnType<RingBuffer['toJSON']>;
  } {
    return {
      id: this.id,
      name: this.name,
      cwd: this.cwd,
      args: this.args,
      createdAt: this.createdAt.toISOString(),
      lastActivity: this.lastActivity.toISOString(),
      exited: this._exited,
      pid: this.pid,
      scrollback: this.scrollback.toJSON(),
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      cwd: this.cwd,
      createdAt: this.createdAt.toISOString(),
      lastActivity: this.lastActivity.toISOString(),
      connected: false, // will be set by session manager
      pid: this.pid,
    };
  }
}

export function findClaudePath(): string {
  const isWin = platform() === 'win32';

  if (isWin) {
    // Check common Windows paths
    const candidates = [
      join(process.env.APPDATA ?? '', 'npm', 'claude.cmd'),
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'claude', 'claude.exe'),
      join(process.env.USERPROFILE ?? '', '.local', 'bin', 'claude.exe'),
    ];

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }

    // Fall back to PATH
    return 'claude';
  }

  // Unix: check common paths
  const unixCandidates = [
    '/usr/local/bin/claude',
    join(process.env.HOME ?? '', '.local', 'bin', 'claude'),
    join(process.env.HOME ?? '', '.npm-global', 'bin', 'claude'),
  ];

  for (const p of unixCandidates) {
    if (existsSync(p)) return p;
  }

  return 'claude';
}
