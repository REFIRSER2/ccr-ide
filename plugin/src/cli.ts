#!/usr/bin/env node

import { splitPane, createCanvasLayout, detectMultiplexer } from './terminal.js';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'preview': {
    const filePath = args[1];
    if (!filePath) {
      console.error('Usage: ccr-plugin preview <file-path>');
      process.exit(1);
    }
    const success = splitPane(`cat "${filePath}" | less -R`, { direction: 'vertical', size: 40 });
    if (!success) {
      console.error('Failed to open preview pane. No supported terminal multiplexer detected.');
      process.exit(1);
    }
    break;
  }

  case 'explorer': {
    const dir = args[1] || '.';
    const cmd = process.platform === 'win32' ? `dir /s /b "${dir}"` : `find "${dir}" -maxdepth 3 -type f | head -50`;
    const success = splitPane(cmd, { direction: 'vertical', size: 25 });
    if (!success) {
      console.error('Failed to open explorer pane.');
      process.exit(1);
    }
    break;
  }

  case 'canvas': {
    const mux = detectMultiplexer();
    if (mux === 'tmux') {
      const success = createCanvasLayout();
      if (!success) {
        console.error('Failed to create canvas layout.');
        process.exit(1);
      }
    } else {
      // Try to open web IDE
      console.log('Opening Web IDE...');
      try {
        const openCmd = process.platform === 'win32' ? 'start' :
          process.platform === 'darwin' ? 'open' : 'xdg-open';
        execSync(`${openCmd} http://localhost:3100`, { stdio: 'ignore' });
      } catch {
        console.log('Visit http://localhost:3100 to access the Web IDE');
      }
    }
    break;
  }

  default:
    console.log('CCR Plugin Commands:');
    console.log('  preview <file>  - Open file preview pane');
    console.log('  explorer [dir]  - Open file explorer pane');
    console.log('  canvas          - Open full IDE layout');
    break;
}
