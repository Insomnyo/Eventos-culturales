import { query } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from './auditService.js';

const PROFILE_COLUMNS = 'id, email, dni, full_name, phone, city, bio, role, email_verified_at, created_at';

export const toPublicProfile = (u) => ({
  id: u.id, email: u.email, dni: u.dni ?? null, full_name: u.full_name, phone: u.phone ?? null, city: u.city ?? null, bio: u.bio ?? null,
  role: u.role, email_verified: Boolean(u.email_verified_at), created_at: u.created_at,
});

export async function getProfile(userId) {
  const [user] = await query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [userId]);
  if (!user) throw new AppError(404, 'user_not_found', 'No encontramos tu perfil.');
  return toPublicProfile(user);
}

// Mapa campo del body → columna. Los nombres de columna salen de ESTA lista fija, nunca del input.
const EDITABLE = { fullName: 'full_name', phone: 'phone', city: 'city', bio: 'bio' };

/**
 * Cada usuario solo puede editar SU propio perfil: el id sale del token verificado, nunca de la URL ni del body.
 * Email y rol no son editables acá (cambiar el email exige reverificarlo; el rol lo gestiona un admin).
 * El DNI es un identificador: solo se puede COMPLETAR una vez (cuentas anteriores a esta función) y luego queda fijo.
 */
export async function updateOwnProfile(user, input, ip) {
  const { dni, ...rest } = input;
  const sets = [];
  const params = [];
  for (const [field, column] of Object.entries(EDITABLE)) {
    if (rest[field] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(rest[field]);
  }

  const dniChanged = dni !== undefined && dni !== user.dni;
  if (dniChanged) {
    if (user.dni) {
      throw new AppError(409, 'dni_locked', 'Tu DNI ya está registrado y no se puede modificar. Si hay un error, contactá a un administrador.');
    }
    sets.push('dni = ?');
    params.push(dni);
  }

  if (sets.length) {
    try {
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, user.id]);
    } catch (err) {
      // Mensaje genérico: no se confirma a quién pertenece ese DNI.
      if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, 'dni_unavailable', 'No pudimos asociar ese DNI. Verificá el número o contactá a un administrador.');
      throw err;
    }
  }
  // Se registran los campos modificados, no sus valores (son datos personales).
  await logAudit({ actorId: user.id, action: 'profile.update', entity: 'user', entityId: user.id, metadata: { fields: Object.keys(input) }, ip });
  return getProfile(user.id);
}
