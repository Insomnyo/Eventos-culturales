// Defensa CSRF para los endpoints que usan la cookie del refresh token (/auth/refresh, /auth/logout).
// Capas: cookie SameSite=Strict + CORS restringido + verificación explícita del header Origin.
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const requireTrustedOrigin = (req, _res, next) => {
  const origin = req.get('origin');
  const allowed = origin ? env.allowedOrigins.includes(origin) : !env.isProduction;
  if (!allowed) return next(new AppError(403, 'untrusted_origin', 'Origen no permitido.'));
  next();
};
