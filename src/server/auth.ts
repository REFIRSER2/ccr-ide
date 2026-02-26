import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from '../shared/constants.js';
import type { ServerConfig } from '../shared/types.js';

export interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function createAccessToken(config: ServerConfig): string {
  return jwt.sign(
    { sub: 'ccr-client' },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRY, algorithm: 'HS256' }
  );
}

export function verifyAccessToken(token: string, config: ServerConfig): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export function createSimpleToken(config: ServerConfig): string {
  return createAccessToken(config);
}
