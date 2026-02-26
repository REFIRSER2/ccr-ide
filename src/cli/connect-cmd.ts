import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { DEFAULT_PORT } from '../shared/constants.js';

export function createConnectCommand(): Command {
  const connect = new Command('connect')
    .description('Connect to a CCR server')
    .argument('<address>', 'Server address (host:port)')
    .requiredOption('-t, --token <token>', 'Access token')
    .option('--token-file <path>', 'Read token from file')
    .option('--raw', 'Use raw mode (no TUI, direct stdin/stdout relay)', false)
    .option('-s, --session <id>', 'Attach to a specific session')
    .action(async (address: string, opts: {
      token?: string;
      tokenFile?: string;
      raw: boolean;
      session?: string;
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

      if (opts.raw) {
        const { startRawMode } = await import('../client/raw-mode.js');
        startRawMode({
          host,
          port,
          token,
          sessionId: opts.session,
        });
      } else {
        // TUI mode with Ink
        const { render } = await import('ink');
        const React = await import('react');
        const { App } = await import('../client/app.js');

        render(
          React.createElement(App, {
            host,
            port,
            token,
            sessionId: opts.session,
          }),
          { exitOnCtrlC: true }
        );
      }
    });

  return connect;
}
