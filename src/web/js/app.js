/**
 * Main application entry point for CCR Web IDE
 */
(function () {
  'use strict';

  let wsClient;
  let terminal;
  let fileTree;
  let editor;
  let sessionBar;
  let ctrlActive = false;

  // DOM elements
  const authDialog = document.getElementById('auth-dialog');
  const authToken = document.getElementById('auth-token');
  const btnConnect = document.getElementById('btn-connect');
  const authError = document.getElementById('auth-error');
  const toggleExplorer = document.getElementById('btn-toggle-explorer');
  const filePanel = document.getElementById('file-panel');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');
  const mobileKeys = document.getElementById('mobile-keys');
  const mobileTabBar = document.getElementById('mobile-tab-bar');

  // Check for saved token
  const savedToken = sessionStorage.getItem('ccr-token');
  if (savedToken) {
    initApp(savedToken);
  }

  // Auth dialog handlers
  btnConnect.addEventListener('click', () => {
    const token = authToken.value.trim();
    if (!token) {
      authError.textContent = 'Token is required';
      authError.classList.remove('hidden');
      return;
    }
    initApp(token);
  });

  authToken.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnConnect.click();
    }
  });

  function initApp(token) {
    // Save token for session
    sessionStorage.setItem('ccr-token', token);

    // Hide auth dialog
    authDialog.classList.add('hidden');

    // Create WebSocket client
    wsClient = new WSClient();

    // Init components
    terminal = new TerminalPanel(
      document.getElementById('terminal-container'),
      wsClient,
    );

    fileTree = new FileTree(
      document.getElementById('file-tree'),
      wsClient,
    );

    editor = new EditorPanel(wsClient);
    sessionBar = new SessionBar(wsClient);

    // When authenticated, create or attach to a session
    wsClient.addEventListener('authenticated', () => {
      authError.classList.add('hidden');
      wsClient.listSessions();
    });

    // When sessions are received and no active session
    wsClient.addEventListener('sessions', (e) => {
      const sessions = e.detail;
      if (sessions.length === 0 && !sessionBar.activeSessionId) {
        // Create a new session with terminal dimensions
        const dims = terminal.getDimensions();
        wsClient.createSession(undefined, undefined, dims.cols, dims.rows);
      }
    });

    // When a session becomes active, refresh file tree
    sessionBar.onSessionChange = () => {
      fileTree.refresh();
    };

    // Handle auth errors
    wsClient.addEventListener('server-error', (e) => {
      const err = e.detail;
      if (err.code === 'AUTH_FAILED' || err.code === 'AUTH_TIMEOUT') {
        sessionStorage.removeItem('ccr-token');
        authDialog.classList.remove('hidden');
        authError.textContent = err.message;
        authError.classList.remove('hidden');
      }
    });

    // Connect
    wsClient.connect(token);

    // Focus terminal
    setTimeout(() => terminal.focus(), 100);
  }

  // Explorer toggle
  toggleExplorer.addEventListener('click', () => {
    filePanel.classList.toggle('hidden');
    resizerLeft.classList.toggle('hidden');
    setTimeout(() => terminal.fit(), 50);
  });

  // Panel resizers
  setupResizer(resizerLeft, filePanel, 'left');
  setupResizer(resizerRight, document.getElementById('editor-panel'), 'right');

  function setupResizer(resizerEl, panel, side) {
    let startX, startWidth;

    function onMouseDown(e) {
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      resizerEl.classList.add('active');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    }

    function onMouseMove(e) {
      const dx = e.clientX - startX;
      const newWidth = side === 'left'
        ? startWidth + dx
        : startWidth - dx;
      panel.style.width = Math.max(150, newWidth) + 'px';
      terminal.fit();
    }

    function onMouseUp() {
      resizerEl.classList.remove('active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    resizerEl.addEventListener('mousedown', onMouseDown);

    // Touch support
    resizerEl.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      onMouseDown({ clientX: touch.clientX, preventDefault: () => {} });
    });
  }

  // Mobile tab switching
  if (mobileTabBar) {
    mobileTabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      const panel = btn.dataset.panel;

      // Update active tab
      mobileTabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update body class for CSS panel switching
      document.body.classList.remove('tab-terminal', 'tab-files', 'tab-editor');
      document.body.classList.add(`tab-${panel}`);

      // Refit terminal if switching to terminal tab
      if (panel === 'terminal' && terminal) {
        setTimeout(() => terminal.fit(), 50);
      }

      // Refresh file tree if switching to files
      if (panel === 'files' && fileTree) {
        fileTree.refresh();
      }
    });
  }

  // Mobile special keys
  if (mobileKeys) {
    mobileKeys.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !terminal) return;

      const key = btn.dataset.key;
      const mod = btn.dataset.mod;

      if (mod === 'ctrl') {
        ctrlActive = !ctrlActive;
        btn.classList.toggle('active', ctrlActive);
        return;
      }

      if (ctrlActive && key) {
        // Send Ctrl+key
        terminal.sendCtrl(key);
        ctrlActive = false;
        mobileKeys.querySelector('[data-mod="ctrl"]')?.classList.remove('active');
      } else if (key) {
        terminal.sendKey(key);
      }
    });
  }
})();
