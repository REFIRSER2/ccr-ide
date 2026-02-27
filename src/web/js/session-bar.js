/**
 * Session bar component for managing sessions
 */
class SessionBar {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.sessions = [];
    this.activeSessionId = null;
    this.onSessionChange = null; // callback

    this.tabsEl = document.getElementById('session-tabs');
    this.newBtn = document.getElementById('btn-new-session');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');

    this._setupListeners();
  }

  _setupListeners() {
    this.wsClient.addEventListener('sessions', (e) => {
      this.sessions = e.detail;
      this._render();

      // Auto-select first session if none active
      if (!this.activeSessionId && this.sessions.length > 0) {
        const target = this.sessions.find(s => !s.connected) || this.sessions[0];
        this.selectSession(target.id);
      }
    });

    this.wsClient.addEventListener('connected', () => {
      this.statusDot.className = 'dot connecting';
      this.statusText.textContent = 'Connecting...';
    });

    this.wsClient.addEventListener('authenticated', () => {
      this.statusDot.className = 'dot online';
      this.statusText.textContent = 'Connected';
    });

    this.wsClient.addEventListener('disconnected', () => {
      this.statusDot.className = 'dot offline';
      this.statusText.textContent = 'Disconnected';
    });

    this.wsClient.addEventListener('reconnecting', (e) => {
      this.statusDot.className = 'dot connecting';
      this.statusText.textContent = `Reconnecting (${e.detail.attempt})...`;
    });

    this.newBtn.addEventListener('click', () => {
      this.createSession();
    });

    this.tabsEl.addEventListener('click', (e) => {
      const tab = e.target.closest('.session-tab');
      if (!tab) return;

      // Check if close button was clicked
      if (e.target.classList.contains('close-btn')) {
        const id = tab.dataset.sessionId;
        this.destroySession(id);
        return;
      }

      const id = tab.dataset.sessionId;
      this.selectSession(id);
    });
  }

  createSession() {
    // Use terminal dimensions if available
    const cols = 80;
    const rows = 24;
    this.wsClient.createSession(undefined, undefined, cols, rows);
  }

  selectSession(sessionId) {
    if (sessionId === this.activeSessionId) return;

    this.activeSessionId = sessionId;
    this.wsClient.attachSession(sessionId);
    this._render();

    if (this.onSessionChange) {
      this.onSessionChange(sessionId);
    }
  }

  destroySession(sessionId) {
    this.wsClient.destroySession(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  _render() {
    this.tabsEl.innerHTML = '';

    this.sessions.forEach((session) => {
      const tab = document.createElement('div');
      tab.className = 'session-tab' + (session.id === this.activeSessionId ? ' active' : '');
      tab.dataset.sessionId = session.id;

      const name = session.name.length > 16
        ? session.name.slice(0, 16) + '...'
        : session.name;

      tab.innerHTML = `
        <span>${this._escapeHtml(name)}</span>
        <button class="close-btn" title="Close session">&times;</button>
      `;

      this.tabsEl.appendChild(tab);
    });
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.SessionBar = SessionBar;
