import { createConnection, createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { platform } from 'node:os';

const SOCKET_NAME = 'ccr-plugin.sock';

function getSocketPath(): string {
  if (platform() === 'win32') {
    return '\\\\.\\pipe\\ccr-plugin';
  }
  return join(tmpdir(), SOCKET_NAME);
}

/**
 * IPC Server for receiving commands from the Claude Code plugin.
 */
export function createIPCServer(onCommand: (cmd: string, args: Record<string, unknown>) => void): ReturnType<typeof createServer> {
  const socketPath = getSocketPath();

  const server = createServer((socket) => {
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        try {
          const { command, args } = JSON.parse(line);
          onCommand(command, args ?? {});
          socket.write(JSON.stringify({ status: 'ok' }) + '\n');
        } catch {
          socket.write(JSON.stringify({ status: 'error', message: 'Invalid command' }) + '\n');
        }
      }
    });
  });

  server.listen(socketPath);
  return server;
}

/**
 * IPC Client for sending commands to the plugin server.
 */
export function sendIPCCommand(command: string, args: Record<string, unknown> = {}): Promise<{ status: string; message?: string }> {
  return new Promise((resolve, reject) => {
    const socketPath = getSocketPath();
    const client = createConnection(socketPath);

    client.on('connect', () => {
      client.write(JSON.stringify({ command, args }) + '\n');
    });

    let buffer = '';
    client.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        try {
          resolve(JSON.parse(buffer.trim()));
        } catch {
          reject(new Error('Invalid response'));
        }
        client.end();
      }
    });

    client.on('error', reject);
  });
}
