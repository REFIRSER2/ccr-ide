import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import type { FileEntry } from '../shared/types.js';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.txt': 'plaintext',
  '.env': 'plaintext',
  '.gitignore': 'plaintext',
  '.dockerfile': 'dockerfile',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.cs': 'csharp',
};

export class FileHandler {
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = resolve(sessionsDir);
  }

  /**
   * Resolve a path within a session directory, preventing path traversal.
   */
  private resolvePath(sessionId: string, relativePath: string): string {
    const sessionDir = resolve(this.sessionsDir, sessionId);
    const fullPath = resolve(sessionDir, relativePath);

    // Prevent path traversal
    if (!fullPath.startsWith(sessionDir)) {
      throw new Error('Path traversal detected: access denied');
    }

    return fullPath;
  }

  private getSessionDir(sessionId: string): string {
    return resolve(this.sessionsDir, sessionId);
  }

  listFiles(sessionId: string, relativePath: string = '.'): FileEntry[] {
    const dirPath = this.resolvePath(sessionId, relativePath);
    const entries = readdirSync(dirPath, { withFileTypes: true });

    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(entry => {
        const stat = statSync(join(dirPath, entry.name));
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: stat.size,
        };
      })
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  readFile(sessionId: string, relativePath: string): { content: string; language: string } {
    const filePath = this.resolvePath(sessionId, relativePath);
    const stat = statSync(filePath);

    // Limit file size to 5MB
    if (stat.size > 5 * 1024 * 1024) {
      throw new Error('File too large (max 5MB)');
    }

    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();
    const language = LANGUAGE_MAP[ext] ?? 'plaintext';

    return { content, language };
  }

  writeFile(sessionId: string, relativePath: string, content: string): void {
    const filePath = this.resolvePath(sessionId, relativePath);

    // Ensure parent directory exists
    mkdirSync(dirname(filePath), { recursive: true });

    writeFileSync(filePath, content, 'utf-8');
  }
}
