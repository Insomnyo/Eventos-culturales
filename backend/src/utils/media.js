// URLs FIRMADAS para las portadas (equivalente local a las "signed URLs" de un bucket privado).
// El archivo solo se sirve si la firma HMAC es válida y no venció; el nombre es un UUID aleatorio.
import { env } from '../config/env.js';
import { safeEqualHex, signMedia } from './crypto.js';

export const COVER_FILE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const TTL_SECONDS = 3600;

export function signedCoverUrl(file) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = signMedia(`${file}.${exp}`);
  return `${env.PUBLIC_API_URL}/api/media/covers/${file}?exp=${exp}&sig=${sig}`;
}

export function isValidCoverSignature(file, exp, sig) {
  const expNumber = Number(exp);
  if (!COVER_FILE_REGEX.test(file) || !Number.isInteger(expNumber)) return false;
  if (expNumber < Math.floor(Date.now() / 1000)) return false;
  return safeEqualHex(sig, signMedia(`${file}.${expNumber}`));
}
