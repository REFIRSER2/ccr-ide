/**
 * Terminal panel wrapper for xterm.js
 */
class TerminalPanel {
  constructor(containerEl, wsClient) {
    this.container = containerEl;
    this.wsClient = wsClient;
    this.term = null;
    this.fitAddon = null;
    this.resizeObserver = null;
    this._init();
  }

  _init() {
    this.term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    // Load fit addon
    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);

    // Try WebGL renderer
    try {
      const webglAddon = new WebglAddon.WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      this.term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, use canvas fallback
    }

    this.term.open(this.container);
    this.fit();

    // Handle user input
    this.term.onData((data) => {
      this.wsClient.sendTerminalData(data);
    });

    // Handle binary input
    this.term.onBinary((data) => {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data.charCodeAt(i) & 0xff;
      }
      this.wsClient.sendTerminalData(bytes);
    });

    // Handle resize
    this.term.onResize(({ cols, rows }) => {
      this.wsClient.sendResize(cols, rows);
    });

    // Listen for terminal data from server
    this.wsClient.addEventListener('terminal-data', (e) => {
      const data = e.detail;
      if (data instanceof Uint8Array) {
        this.term.write(data);
      }
    });

    // Responsive resize
    this.resizeObserver = new ResizeObserver(() => {
      this.fit();
    });
    this.resizeObserver.observe(this.container);

    // Also fit on window resize
    window.addEventListener('resize', () => this.fit());
  }

  fit() {
    if (this.fitAddon && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
      try {
        this.fitAddon.fit();
      } catch {
        // Ignore fit errors during transitions
      }
    }
  }

  getDimensions() {
    return {
      cols: this.term.cols,
      rows: this.term.rows,
    };
  }

  focus() {
    this.term.focus();
  }

  clear() {
    this.term.clear();
  }

  /**
   * Send a special key from the mobile key bar
   */
  sendKey(key) {
    switch (key) {
      case 'Escape':
        this.term.write('\x1b');
        this.wsClient.sendTerminalData('\x1b');
        break;
      case 'Tab':
        this.wsClient.sendTerminalData('\t');
        break;
      case 'ArrowUp':
        this.wsClient.sendTerminalData('\x1b[A');
        break;
      case 'ArrowDown':
        this.wsClient.sendTerminalData('\x1b[B');
        break;
      case 'ArrowRight':
        this.wsClient.sendTerminalData('\x1b[C');
        break;
      case 'ArrowLeft':
        this.wsClient.sendTerminalData('\x1b[D');
        break;
      case '/':
        this.wsClient.sendTerminalData('/');
        break;
      default:
        this.wsClient.sendTerminalData(key);
    }
    this.focus();
  }

  /**
   * Send Ctrl+key combo
   */
  sendCtrl(key) {
    const code = key.toUpperCase().charCodeAt(0) - 64;
    if (code > 0 && code < 32) {
      this.wsClient.sendTerminalData(String.fromCharCode(code));
    }
    this.focus();
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.term) {
      this.term.dispose();
    }
  }
}

window.TerminalPanel = TerminalPanel;
