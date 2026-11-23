import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const newId = () => crypto.randomUUID();                              // UUID v4 (CSPRNG)
export const randomToken = () => crypto.randomBytes(32).toString('base64url'); // 256 bits
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Clave derivada para firmar URLs de imágenes (separada de la clave de los JWT).
const mediaKey = crypto.createHmac('sha256', env.JWT_SECRET).update('telon-media-signing').digest();

export const signMedia = (payload) => crypto.createHmac('sha256', mediaKey).update(payload).digest('hex');
export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
