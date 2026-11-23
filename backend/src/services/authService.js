import { pool, query, withTransaction } from '../lib/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { newId, randomToken, sha256 } from '../utils/crypto.js';
import { normalizeDni } from '../utils/dni.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../utils/passwords.js';
import { sendVerificationEmail } from '../utils/email.js';
import { signAccessToken } from './tokenService.js';
import { logAudit } from './auditService.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const VERIFY_TTL_HOURS = 24;
const addMs = (ms) => new Date(Date.now() + ms);

export const toProfile = (u) => ({
  id: u.id, email: u.email, dni: u.dni ?? null, full_name: u.full_name, phone: u.phone ?? null, city: u.city ?? null, bio: u.bio ?? null,
  role: u.role, email_verified: Boolean(u.email_verified_at), created_at: u.created_at,
});

const accountDisabled = () => new AppError(403, 'account_disabled', 'Tu cuenta está deshabilitada. Contactá a un administrador.');

async function issueVerificationEmail(user) {
  const token = randomToken();
  await query('INSERT INTO email_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [newId(), user.id, sha256(token), addMs(VERIFY_TTL_HOURS * 3600 * 1000)]);
  // Solo se guarda el HASH del token; el valor real viaja únicamente en el enlace del correo.
  await sendVerificationEmail({ to: user.email, name: user.full_name, link: `${env.FRONTEND_URL}/verificar-email?token=${token}` });
}

/** Registro. La respuesta es idéntica exista o no el email (no revela qué cuentas existen). */
export async function register({ fullName, dni, email, password, ip }) {
  // Si el email O el DNI ya tienen cuenta, no se crea nada y la respuesta es la misma (no se revela cuál existe).
  const [existing] = await query('SELECT id FROM users WHERE email = ? OR dni = ?', [email, dni]);
  if (existing) return;

  const user = { id: newId(), email, full_name: fullName };
  try {
    // El rol NO viene del cliente: siempre 'attendee'.
    await query('INSERT INTO users (id, email, dni, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, email, dni, await hashPassword(password), fullName, 'attendee']);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return;   // carrera de dos registros simultáneos con el mismo email o DNI
    throw err;
  }
  await logAudit({ actorId: user.id, action: 'user.register', entity: 'user', entityId: user.id, ip });
  await issueVerificationEmail(user);
}

export async function verifyEmail(token) {
  const [row] = await query(
    'SELECT id, user_id FROM email_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
    [sha256(token), new Date()]);
  if (!row) throw new AppError(400, 'invalid_verification_token', 'El enlace de verificación es inválido o venció.');
  const now = new Date();
  await withTransaction(async (conn) => {
    await conn.execute('UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, row.id]);
    await conn.execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [now, row.user_id]);
  });
  await logAudit({ actorId: row.user_id, action: 'user.verify_email', entity: 'user', entityId: row.user_id });
}

/** Reenvío de verificación. Respuesta genérica siempre (sin enumeración de cuentas). */
export async function resendVerification(email) {
  const [user] = await query('SELECT id, email, full_name, email_verified_at FROM users WHERE email = ?', [email]);
  if (user && !user.email_verified_at) await issueVerificationEmail(user);
}

async function createRefreshToken(userId) {
  const token = randomToken();
  const expiresAt = addMs(env.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000);
  await query('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [newId(), userId, sha256(token), expiresAt]);
  return { token, expiresAt };
}

/** El identificador puede ser el DNI (solo números, con o sin puntos) o el email. */
function parseIdentifier(identifier) {
  const compact = normalizeDni(identifier);
  return /^\d+$/.test(compact) ? { column: 'dni', value: compact } : { column: 'email', value: identifier.trim().toLowerCase() };
}

export async function login({ identifier, password, ip }) {
  const { column, value } = parseIdentifier(identifier);
  // Solo hay dos consultas fijas (por DNI o por email): el input nunca forma parte del SQL.
  const [user] = column === 'dni'
    ? await query('SELECT * FROM users WHERE dni = ?', [value])
    : await query('SELECT * FROM users WHERE email = ?', [value]);

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(429, 'too_many_attempts', `Demasiados intentos fallidos. Probá de nuevo en ${LOCK_MINUTES} minutos.`);
  }

  // Siempre se compara contra un hash (real o falso): mismo costo de CPU y de tiempo.
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    if (user) {
      const failed = user.failed_login_count + 1;
      const lockedUntil = failed >= MAX_FAILED_LOGINS ? addMs(LOCK_MINUTES * 60 * 1000) : null;
      await query('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?',
        [lockedUntil ? 0 : failed, lockedUntil, user.id]);
      await logAudit({ actorId: user.id, action: 'user.login_failed', entity: 'user', entityId: user.id, metadata: { locked: Boolean(lockedUntil) }, ip });
    }
    // Mensaje genérico: no distingue "email inexistente" de "contraseña incorrecta".
    throw new AppError(401, 'invalid_credentials', 'Email o contraseña incorrectos.');
  }

  // El estado de la cuenta se informa SOLO tras validar la contraseña (no revela qué cuentas existen).
  if (!user.is_active) {
    await logAudit({ actorId: user.id, action: 'user.login_blocked_disabled', entity: 'user', entityId: user.id, ip });
    throw accountDisabled();
  }

  await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?', [user.id]);
  const refresh = await createRefreshToken(user.id);
  await logAudit({ actorId: user.id, action: 'user.login', entity: 'user', entityId: user.id, ip });
  return { accessToken: signAccessToken(user.id), refresh, profile: toProfile(user) };
}

/** Rotación de refresh token con detección de reutilización. */
export async function refreshSession(rawToken) {
  if (!rawToken) throw new AppError(401, 'no_session', 'No hay sesión activa.');
  const [row] = await query('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?', [sha256(rawToken)]);
  if (!row) throw new AppError(401, 'no_session', 'No hay sesión activa.');

  if (row.revoked_at) {
    // Un token ya usado reapareció: posible robo. Se cierran TODAS las sesiones de ese usuario.
    await query('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [new Date(), row.user_id]);
    await logAudit({ actorId: row.user_id, action: 'user.refresh_reuse_detected', entity: 'user', entityId: row.user_id });
    throw new AppError(401, 'no_session', 'Tu sesión ya no es válida. Volvé a iniciar sesión.');
  }
  if (new Date(row.expires_at) < new Date()) throw new AppError(401, 'no_session', 'Tu sesión expiró.');

  const [user] = await query('SELECT * FROM users WHERE id = ?', [row.user_id]);
  if (!user) throw new AppError(401, 'no_session', 'No hay sesión activa.');
  if (!user.is_active) throw accountDisabled();

  // Revocación atómica: si dos pestañas refrescan a la vez, solo una gana.
  const [result] = await pool.execute('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [new Date(), row.id]);
  if (result.affectedRows !== 1) throw new AppError(401, 'no_session', 'Tu sesión ya no es válida.');

  const refresh = await createRefreshToken(user.id);
  return { accessToken: signAccessToken(user.id), refresh, profile: toProfile(user) };
}

export async function logout(rawToken, userIdHint) {
  if (!rawToken) return;
  const [row] = await query('SELECT id, user_id FROM refresh_tokens WHERE token_hash = ?', [sha256(rawToken)]);
  if (!row) return;
  await query('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [new Date(), row.id]);
  await logAudit({ actorId: userIdHint ?? row.user_id, action: 'user.logout', entity: 'user', entityId: row.user_id });
}
