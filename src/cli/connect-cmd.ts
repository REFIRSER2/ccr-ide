import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { DEFAULT_PORT } from '../shared/constants.js';

export function createConnectCommand(): Command {
  const connect = new Command('connect')
    .description('Connect to a CCR server')
    .argument('<address>', 'Server address (host:port)')
    .requiredOption('-t, --token <token>', 'Access token')
    .option('--token-file <path>', 'Read token from file')
    .option('-s, --session <id>', 'Attach to a specific session')
    .option('--web', 'Open Web IDE in browser instead of raw terminal mode')
    .action(async (address: string, opts: {
      token?: string;
      tokenFile?: string;
      session?: string;
      web?: boolean;
    }) => {
      // Parse address
      const parts = address.split(':');
      const host = parts[0] || 'localhost';
      const port = parts.length > 1 ? parseInt(parts[1], 10) : DEFAULT_PORT;

      // Resolve token
      let token = opts.token;
      if (opts.tokenFile) {
        token = readFileSync(opts.tokenFile, 'utf-8').trim();
      }
      if (!token) {
        console.error('[CCR] Error: --token or --token-file is required');
        process.exit(1);
      }

      if (opts.web) {
        // Open Web IDE in browser
        const url = `http://${host}:${port}`;
        console.log(`[CCR] Opening Web IDE: ${url}`);

        try {
          const isWin = platform() === 'win32';
          const isMac = platform() === 'darwin';

          if (isWin) {
            execSync(`start "" "${url}"`, { stdio: 'ignore', shell: 'cmd.exe' });
          } else if (isMac) {
            execSync(`open "${url}"`, { stdio: 'ignore' });
          } else {
            execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
          }
        } catch {
          console.log(`[CCR] Could not open browser. Visit: ${url}`);
        }

        console.log(`[CCR] Token for Web IDE: ${token}`);
      } else {
        // Raw mode (default) - direct stdin/stdout relay
        const { startRawMode } = await import('../client/raw-mode.js');
        startRawMode({
          host,
          port,
          token,
          sessionId: opts.session,
        });
      }
    });

  return connect;
}
