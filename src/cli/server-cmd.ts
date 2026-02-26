import { Command } from 'commander';
import { DEFAULT_PORT, DEFAULT_HOST } from '../shared/constants.js';

export function createServerCommand(): Command {
  const server = new Command('server')
    .description('Manage the CCR server');

  server
    .command('start')
    .description('Start the CCR server')
    .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
    .option('-h, --host <host>', 'Host to bind to', DEFAULT_HOST)
    .option('-t, --token <token>', 'Use a custom access token')
    .action(async (opts: { port: string; host: string; token?: string }) => {
      const { startServer } = await import('../server/index.js');
      await startServer({
        port: parseInt(opts.port, 10),
        host: opts.host,
        token: opts.token,
      });
    });

  server
    .command('stop')
    .description('Stop the running CCR server')
    .action(async () => {
      const { loadPid } = await import('../server/config.js');
      const pid = loadPid();
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`[CCR] Server (PID: ${pid}) stopped`);
        } catch {
          console.log('[CCR] Server is not running');
        }
      } else {
        console.log('[CCR] No server PID found');
      }
    });

  server
    .command('status')
    .description('Show server status')
    .action(async () => {
      const { loadPid, loadToken } = await import('../server/config.js');
      const pid = loadPid();
      const token = loadToken();

      if (pid) {
        try {
          process.kill(pid, 0);
          console.log(`[CCR] Server is running (PID: ${pid})`);
          if (token) {
            console.log(`[CCR] Token: ${token}`);
          }
        } catch {
          console.log('[CCR] Server is not running (stale PID)');
        }
      } else {
        console.log('[CCR] Server is not running');
      }
    });

  server
    .command('token')
    .description('Show or regenerate the access token')
    .option('-r, --regenerate', 'Generate a new token')
    .action(async (opts: { regenerate?: boolean }) => {
      const { loadServerConfig, saveToken } = await import('../server/config.js');
      const { createAccessToken } = await import('../server/auth.js');
      const config = loadServerConfig();

      if (opts.regenerate) {
        const token = createAccessToken(config);
        saveToken(token);
        console.log(`[CCR] New token: ${token}`);
      } else {
        const { loadToken } = await import('../server/config.js');
        const token = loadToken();
        if (token) {
          console.log(`[CCR] Token: ${token}`);
        } else {
          const newToken = createAccessToken(config);
          saveToken(newToken);
          console.log(`[CCR] Generated token: ${newToken}`);
        }
      }
    });

  return server;
}
