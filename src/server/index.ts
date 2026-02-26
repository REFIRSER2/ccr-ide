import { CCRServer } from './ws-server.js';
import { loadServerConfig, saveToken } from './config.js';
import { createAccessToken } from './auth.js';
import type { ServerConfig } from '../shared/types.js';

export interface StartServerOptions {
  port?: number;
  host?: string;
  token?: string;
}

export async function startServer(opts: StartServerOptions = {}): Promise<{ server: CCRServer; token: string }> {
  const config = loadServerConfig();

  if (opts.port) config.port = opts.port;
  if (opts.host) config.host = opts.host;

  const token = opts.token ?? createAccessToken(config);
  saveToken(token);

  const server = new CCRServer(config);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[CCR Server] Shutting down...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.start();

  console.log(`[CCR Server] Started on ${config.host}:${config.port}`);
  console.log(`[CCR Server] Access token: ${token}`);
  console.log(`[CCR Server] Connect with: ccr connect ${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port} --token ${token}`);

  return { server, token };
}

export { CCRServer } from './ws-server.js';
export { loadServerConfig, type ServerConfig };
