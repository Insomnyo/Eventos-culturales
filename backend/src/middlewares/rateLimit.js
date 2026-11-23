// Rate limiting (express-rate-limit). Los contadores viven en memoria: con varias instancias
// usá un store compartido (ej. Redis) — ver docs/seguridad.md.
import rateLimit from 'express-rate-limit';

const handler = (_req, res) =>
  res.status(429).json({ error: { code: 'rate_limited', message: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' } });

const base = { standardHeaders: 'draft-7', legacyHeaders: false, handler };

/** Límite general por IP para toda la API. */
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300 });

/** Escrituras de organizadores (crear/editar/borrar eventos, check-in), por usuario. */
export const writeLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, limit: 60,
  keyGenerator: (req) => `w:${req.user?.id ?? req.ip}`,
});

/** Subida de imágenes, por usuario. */
export const uploadLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, limit: 15,
  keyGenerator: (req) => `u:${req.user?.id ?? req.ip}`,
});

/** Reserva: límite POR USUARIO (evita que una cuenta acapare cupos)... */
export const reserveUserLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, limit: 10,
  keyGenerator: (req) => `ru:${req.user?.id ?? req.ip}`,
});

/** ...y límite POR IP (evita que un bot cree muchas cuentas desde el mismo origen). */
export const reserveIpLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 30 });

// ---- Autenticación: freno a la fuerza bruta y al abuso de envío de correos (por IP) ----
export const loginLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20 });
export const registerLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 10 });
export const emailLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 6 });
export const refreshLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 120 });
