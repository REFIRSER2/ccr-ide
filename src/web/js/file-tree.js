/**
 * File tree explorer component
 */
class FileTree {
  constructor(containerEl, wsClient) {
    this.container = containerEl;
    this.wsClient = wsClient;
    this.currentPath = '.';
    this.openFolders = new Set(['.']);
    this.activeFile = null;
    this.onFileSelect = null; // callback

    this._setupListeners();
  }

  _setupListeners() {
    this.wsClient.addEventListener('file-list', (e) => {
      const { path, files } = e.detail;
      this._renderDirectory(path, files);
    });

    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.tree-item');
      if (!item) return;

      const path = item.dataset.path;
      const type = item.dataset.type;

      if (type === 'directory') {
        this._toggleFolder(path);
      } else {
        this._selectFile(path);
      }
    });
  }

  refresh() {
    // Re-request all open folders
    this.container.innerHTML = '';
    this.wsClient.requestFileList('.');
    for (const folder of this.openFolders) {
      if (folder !== '.') {
        this.wsClient.requestFileList(folder);
      }
    }
  }

  _toggleFolder(path) {
    if (this.openFolders.has(path)) {
      this.openFolders.delete(path);
      // Remove children from DOM
      const children = this.container.querySelectorAll(`[data-parent="${path}"]`);
      children.forEach(el => el.remove());
      // Update icon
      const item = this.container.querySelector(`[data-path="${CSS.escape(path)}"]`);
      if (item) {
        const icon = item.querySelector('.tree-icon');
        if (icon) icon.textContent = '\u25b6'; // right triangle
      }
    } else {
      this.openFolders.add(path);
      this.wsClient.requestFileList(path);
      // Update icon
      const item = this.container.querySelector(`[data-path="${CSS.escape(path)}"]`);
      if (item) {
        const icon = item.querySelector('.tree-icon');
        if (icon) icon.textContent = '\u25bc'; // down triangle
      }
    }
  }

  _selectFile(path) {
    // Update active state
    this.container.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
    const item = this.container.querySelector(`[data-path="${CSS.escape(path)}"]`);
    if (item) item.classList.add('active');

    this.activeFile = path;

    // Request file content
    this.wsClient.requestFileRead(path);

    if (this.onFileSelect) {
      this.onFileSelect(path);
    }
  }

  _renderDirectory(path, files) {
    const depth = path === '.' ? 0 : path.split('/').length;

    // Remove existing children for this path
    const existing = this.container.querySelectorAll(`[data-parent="${CSS.escape(path)}"]`);
    existing.forEach(el => el.remove());

    // Find insertion point
    let insertAfter = null;
    if (path === '.') {
      // Top level
      insertAfter = null;
    } else {
      const parentItem = this.container.querySelector(`[data-path="${CSS.escape(path)}"]`);
      insertAfter = parentItem;
    }

    const fragment = document.createDocumentFragment();

    for (const file of files) {
      const filePath = path === '.' ? file.name : `${path}/${file.name}`;
      const el = document.createElement('div');
      el.className = 'tree-item';
      el.dataset.path = filePath;
      el.dataset.type = file.type;
      el.dataset.parent = path;

      // Indentation
      let indent = '';
      for (let i = 0; i < depth; i++) {
        indent += '<span class="tree-indent"></span>';
      }

      const icon = file.type === 'directory'
        ? (this.openFolders.has(filePath) ? '\u25bc' : '\u25b6')
        : this._getFileIcon(file.name);

      el.innerHTML = `${indent}<span class="tree-icon">${icon}</span><span class="tree-name">${this._escapeHtml(file.name)}</span>`;

      if (filePath === this.activeFile) {
        el.classList.add('active');
      }

      fragment.appendChild(el);
    }

    if (insertAfter) {
      insertAfter.after(fragment);
    } else {
      this.container.appendChild(fragment);
    }
  }

  _getFileIcon(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons = {
      ts: '\ud83d\udcc4',
      tsx: '\u269b\ufe0f',
      js: '\ud83d\udcc4',
      jsx: '\u269b\ufe0f',
      json: '{}',
      html: '\ud83c\udf10',
      css: '\ud83c\udfa8',
      md: '\ud83d\udcdd',
      py: '\ud83d\udc0d',
      rs: '\u2699\ufe0f',
      go: '\ud83d\udc39',
      sh: '$_',
      yaml: '\u2699\ufe0f',
      yml: '\u2699\ufe0f',
      toml: '\u2699\ufe0f',
      txt: '\ud83d\udcc4',
      env: '\ud83d\udd12',
      lock: '\ud83d\udd12',
    };
    return icons[ext] || '\ud83d\udcc4';
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.FileTree = FileTree;
