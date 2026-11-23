import { AppError } from './errors.js';

// El código del ticket es un UUID v4 generado por PostgreSQL (gen_random_uuid → CSPRNG),
// por lo que es impredecible. Acá solo validamos formato y damos una versión corta legible.
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertTicketCode(code) {
  if (!UUID_REGEX.test(code)) throw new AppError(400, 'invalid_ticket', 'El código de ticket no es válido.');
  return code.toLowerCase();
}

export const shortTicket = (code) => code.slice(0, 8).toUpperCase();
