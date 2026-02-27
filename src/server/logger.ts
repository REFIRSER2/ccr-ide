/**
 * Structured JSON logger for CCR server.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

export function debug(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog('debug')) {
    console.log(formatLog('debug', message, meta));
  }
}

export function info(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog('info')) {
    console.log(formatLog('info', message, meta));
  }
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog('warn')) {
    console.warn(formatLog('warn', message, meta));
  }
}

export function error(message: string, meta?: Record<string, unknown>): void {
  if (shouldLog('error')) {
    console.error(formatLog('error', message, meta));
  }
}

export const logger = { debug, info, warn, error, setLogLevel };
