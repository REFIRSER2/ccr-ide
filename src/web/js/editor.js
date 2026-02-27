/**
 * Editor/Preview panel for file viewing and editing
 */
class EditorPanel {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.currentPath = null;
    this.currentContent = null;
    this.currentLanguage = null;
    this.editMode = false;
    this.modified = false;

    this.titleEl = document.getElementById('editor-title');
    this.welcomeEl = document.getElementById('editor-welcome');
    this.contentEl = document.getElementById('editor-content');
    this.textareaEl = document.getElementById('editor-textarea');
    this.previewEl = document.getElementById('editor-preview');
    this.editBtn = document.getElementById('btn-edit-mode');
    this.saveBtn = document.getElementById('btn-save');
    this.closeBtn = document.getElementById('btn-close-editor');

    this._setupListeners();
  }

  _setupListeners() {
    this.wsClient.addEventListener('file-content', (e) => {
      const { path, content, language } = e.detail;
      this.openFile(path, content, language);
    });

    this.editBtn.addEventListener('click', () => {
      this.toggleEditMode();
    });

    this.saveBtn.addEventListener('click', () => {
      this.save();
    });

    this.closeBtn.addEventListener('click', () => {
      this.close();
    });

    this.textareaEl.addEventListener('input', () => {
      this.modified = true;
      this.saveBtn.disabled = false;
    });

    // Ctrl+S to save
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (this.currentPath && this.editMode) {
          this.save();
        }
      }
    });
  }

  openFile(path, content, language) {
    this.currentPath = path;
    this.currentContent = content;
    this.currentLanguage = language;
    this.modified = false;
    this.editMode = false;

    const fileName = path.split('/').pop();
    this.titleEl.textContent = fileName;

    this.welcomeEl.classList.add('hidden');
    this.textareaEl.classList.add('hidden');
    this.saveBtn.disabled = true;

    // Check if it's markdown for preview
    if (language === 'markdown') {
      this.contentEl.classList.add('hidden');
      this.previewEl.classList.remove('hidden');
      this.previewEl.innerHTML = this._renderMarkdown(content);
    } else {
      this.previewEl.classList.add('hidden');
      this.contentEl.classList.remove('hidden');
      this.contentEl.textContent = content;
    }

    this.editBtn.textContent = 'Edit';
  }

  toggleEditMode() {
    if (!this.currentPath) return;

    this.editMode = !this.editMode;

    if (this.editMode) {
      this.contentEl.classList.add('hidden');
      this.previewEl.classList.add('hidden');
      this.textareaEl.classList.remove('hidden');
      this.textareaEl.value = this.modified ? this.textareaEl.value : this.currentContent;
      this.textareaEl.focus();
      this.editBtn.textContent = 'Preview';
    } else {
      this.textareaEl.classList.add('hidden');

      if (this.currentLanguage === 'markdown') {
        this.previewEl.classList.remove('hidden');
        const content = this.modified ? this.textareaEl.value : this.currentContent;
        this.previewEl.innerHTML = this._renderMarkdown(content);
      } else {
        this.contentEl.classList.remove('hidden');
        const content = this.modified ? this.textareaEl.value : this.currentContent;
        this.contentEl.textContent = content;
      }

      this.editBtn.textContent = 'Edit';
    }
  }

  save() {
    if (!this.currentPath || !this.modified) return;

    const content = this.textareaEl.value;
    this.wsClient.sendFileWrite(this.currentPath, content);
    this.currentContent = content;
    this.modified = false;
    this.saveBtn.disabled = true;
  }

  close() {
    this.currentPath = null;
    this.currentContent = null;
    this.currentLanguage = null;
    this.editMode = false;
    this.modified = false;

    this.titleEl.textContent = 'No file open';
    this.contentEl.classList.add('hidden');
    this.textareaEl.classList.add('hidden');
    this.previewEl.classList.add('hidden');
    this.welcomeEl.classList.remove('hidden');
    this.saveBtn.disabled = true;
  }

  _renderMarkdown(md) {
    // Simple markdown rendering (no external dependency)
    return md
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold/Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Wrap in paragraph
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
}

window.EditorPanel = EditorPanel;
