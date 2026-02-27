export const DEFAULT_PORT = 3100;
export const DEFAULT_HOST = '0.0.0.0';

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const AUTH_TIMEOUT_MS = 5_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
export const RECONNECT_MAX_ATTEMPTS = 10;

export const SCROLLBACK_MAX_BYTES = 1024 * 1024; // 1MB

export const DEFAULT_PTY_COLS = 80;
export const DEFAULT_PTY_ROWS = 24;

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const JWT_EXPIRY = '24h';
export const JWT_ALGORITHM = 'HS256' as const;

export const CONFIG_DIR_NAME = '.ccr';
export const CONFIG_FILE_NAME = 'config.json';
export const TOKEN_FILE_NAME = 'token';
export const PID_FILE_NAME = 'server.pid';

export const SESSIONS_DIR = 'sessions';

export const APP_NAME = 'claude-code-remote-cli';
export const APP_VERSION = '0.1.0';
