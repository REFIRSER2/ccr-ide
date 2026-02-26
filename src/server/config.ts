import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  TOKEN_FILE_NAME,
  PID_FILE_NAME,
  DEFAULT_PORT,
  DEFAULT_HOST,
} from '../shared/constants.js';
import type { ServerConfig } from '../shared/types.js';

function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR_NAME);
}

function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function loadServerConfig(): ServerConfig {
  const dir = ensureConfigDir();
  const configPath = join(dir, CONFIG_FILE_NAME);

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
      port: parsed.port ?? DEFAULT_PORT,
      host: parsed.host ?? DEFAULT_HOST,
      jwtSecret: parsed.jwtSecret ?? generateSecret(),
    };
  }

  const config: ServerConfig = {
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
    jwtSecret: generateSecret(),
  };
  saveServerConfig(config);
  return config;
}

export function saveServerConfig(config: ServerConfig): void {
  const dir = ensureConfigDir();
  const configPath = join(dir, CONFIG_FILE_NAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateToken(config: ServerConfig): string {
  return crypto.createHash('sha256').update(config.jwtSecret).digest('hex').slice(0, 48);
}

export function saveToken(token: string): void {
  const dir = ensureConfigDir();
  writeFileSync(join(dir, TOKEN_FILE_NAME), token, 'utf-8');
}

export function loadToken(): string | null {
  const tokenPath = join(getConfigDir(), TOKEN_FILE_NAME);
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf-8').trim();
  }
  return null;
}

export function savePid(pid: number): void {
  const dir = ensureConfigDir();
  writeFileSync(join(dir, PID_FILE_NAME), String(pid), 'utf-8');
}

export function loadPid(): number | null {
  const pidPath = join(getConfigDir(), PID_FILE_NAME);
  if (existsSync(pidPath)) {
    const raw = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  }
  return null;
}

export function removePid(): void {
  const pidPath = join(getConfigDir(), PID_FILE_NAME);
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}
