import { CCRServer } from './ws-server.js';
import { loadServerConfig, saveToken } from './config.js';
import { createAccessToken } from './auth.js';
import { ensureCertificates } from './tls.js';
import { logger } from './logger.js';
import type { ServerConfig } from '../shared/types.js';

export interface StartServerOptions {
  port?: number;
  host?: string;
  token?: string;
  tls?: boolean;
}

export async function startServer(opts: StartServerOptions = {}): Promise<{ server: CCRServer; token: string }> {
  const config = loadServerConfig();

  if (opts.port) config.port = opts.port;
  if (opts.host) config.host = opts.host;

  const token = opts.token ?? createAccessToken(config);
  saveToken(token);

  // Handle TLS
  let tlsConfig: { cert: Buffer; key: Buffer } | undefined;
  if (opts.tls) {
    const certs = ensureCertificates();
    if (!certs) {
      console.error('[CCR Server] TLS requested but certificate generation failed. Starting without TLS.');
    } else {
      tlsConfig = certs;
    }
  }

  const server = new CCRServer(config, undefined, tlsConfig);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[CCR Server] Shutting down...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.start();

  const protocol = tlsConfig ? 'https' : 'http';
  const wsProtocol = tlsConfig ? 'wss' : 'ws';
  const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host;

  console.log(`[CCR Server] Started on ${config.host}:${config.port}`);
  console.log(`[CCR Server] Web IDE: ${protocol}://${displayHost}:${config.port}`);
  console.log(`[CCR Server] WebSocket: ${wsProtocol}://${displayHost}:${config.port}`);
  console.log(`[CCR Server] Access token: ${token}`);
  console.log(`[CCR Server] Connect with: ccr connect ${displayHost}:${config.port} --token ${token}`);

  if (tlsConfig) {
    console.log('[CCR Server] TLS enabled (self-signed certificate)');
  }

  return { server, token };
}

export { CCRServer } from './ws-server.js';
export { loadServerConfig, type ServerConfig };
