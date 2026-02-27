import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR_NAME } from '../shared/constants.js';

const CERT_DIR = join(homedir(), CONFIG_DIR_NAME, 'certs');
const CERT_FILE = join(CERT_DIR, 'server.crt');
const KEY_FILE = join(CERT_DIR, 'server.key');

export interface TLSConfig {
  cert: Buffer;
  key: Buffer;
}

/**
 * Check if TLS certificates exist.
 */
export function hasCertificates(): boolean {
  return existsSync(CERT_FILE) && existsSync(KEY_FILE);
}

/**
 * Generate self-signed certificates using openssl.
 */
export function generateSelfSignedCert(): boolean {
  try {
    mkdirSync(CERT_DIR, { recursive: true });

    const subject = '/CN=ccr-server/O=CCR/C=US';
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" ` +
      `-days 365 -nodes -subj "${subject}" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'pipe' },
    );

    console.log(`[CCR TLS] Self-signed certificate generated at ${CERT_DIR}`);
    return true;
  } catch (err) {
    console.error('[CCR TLS] Failed to generate certificate. Is openssl installed?');
    console.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Load TLS certificates from disk.
 */
export function loadCertificates(): TLSConfig | null {
  if (!hasCertificates()) return null;

  try {
    return {
      cert: readFileSync(CERT_FILE),
      key: readFileSync(KEY_FILE),
    };
  } catch {
    return null;
  }
}

/**
 * Ensure TLS certificates exist, generating if needed.
 */
export function ensureCertificates(): TLSConfig | null {
  if (!hasCertificates()) {
    const generated = generateSelfSignedCert();
    if (!generated) return null;
  }
  return loadCertificates();
}
