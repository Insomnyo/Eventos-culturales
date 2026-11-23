// Autenticación: valida el JWT (firma, expiración, emisor, audiencia) y carga el usuario con su
// rol desde la base de datos (fuente de verdad: un cambio de rol aplica de inmediato).
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { verifyAccessToken } from '../services/tokenService.js';

async function resolveUser(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token || token.length > 2048) return null;

  const payload = verifyAccessToken(token);
  const [user] = await query('SELECT id, email, dni, full_name, role, is_active, email_verified_at FROM users WHERE id = ?', [payload.sub]);
  if (!user) throw new AppError(401, 'invalid_token', 'Sesión inválida. Volvé a iniciar sesión.');

  // Una cuenta deshabilitada pierde acceso en el acto, aunque su token todavía no haya vencido.
  if (!user.is_active) throw new AppError(403, 'account_disabled', 'Tu cuenta está deshabilitada. Contactá a un administrador.');

  return {
    id: user.id,
    email: user.email,
    dni: user.dni,
    fullName: user.full_name,
    role: user.role,                                   // el rol sale de la tabla, NO del token ni del cliente
    emailVerified: Boolean(user.email_verified_at),
  };
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw new AppError(401, 'unauthenticated', 'Iniciá sesión para continuar.');
  req.user = user;
  next();
});

/** Autenticación opcional (rutas públicas que muestran más datos al dueño/admin). */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = (await resolveUser(req)) ?? null;
  next();
});

/** Reservar exige email verificado. */
export const requireVerifiedEmail = (req, _res, next) => {
  if (!req.user?.emailVerified) {
    return next(new AppError(403, 'email_not_verified', 'Verificá tu email para poder reservar.'));
  }
  next();
};
