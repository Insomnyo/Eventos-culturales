import { query, withTransaction } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { checkStatusChange, MANAGEABLE_ROLES } from '../utils/userPolicy.js';
import { logAudit } from './auditService.js';

export async function changeUserRole({ admin, email, role, ip }) {
  if (email === admin.email && role !== 'admin') {
    throw new AppError(400, 'cannot_demote_self', 'No podés quitarte a vos mismo el rol de administrador.');
  }
  const [target] = await query('SELECT id, role FROM users WHERE email = ?', [email]);
  if (!target) throw new AppError(404, 'user_not_found', 'No existe un usuario con ese email.');

  await query('UPDATE users SET role = ? WHERE id = ?', [role, target.id]);
  await logAudit({ actorId: admin.id, action: 'role.change', entity: 'user', entityId: target.id, metadata: { from: target.role, to: role }, ip });
  return { email, role };
}

/** Cuentas gestionables (organizadores y administradores) con su estado. Nunca devuelve hashes ni tokens. */
export async function listManagedUsers() {
  const placeholders = MANAGEABLE_ROLES.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, email, full_name, role, is_active, disabled_at, disabled_reason, created_at
       FROM users WHERE role IN (${placeholders}) ORDER BY role ASC, full_name ASC`, MANAGEABLE_ROLES);
  return rows.map((u) => ({ ...u, is_active: Boolean(u.is_active) }));
}

/**
 * Habilita o deshabilita una cuenta de organizador/administrador.
 * La autorización se aplica en DOS capas: el middleware de la ruta (requireRole('admin')) y la política
 * `checkStatusChange` (defensa en profundidad: si alguien reutilizara este servicio desde otra ruta,
 * el chequeo sigue ahí).
 */
export async function setUserStatus({ actor, userId, active, reason, ip }) {
  const target = await withTransaction(async (conn) => {
    // Se bloquean TODOS los administradores activos (orden fijo): dos admins que se deshabiliten
    // mutuamente a la vez no pueden dejar el sistema sin administradores.
    const [admins] = await conn.execute("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id FOR UPDATE");
    const [rows] = await conn.execute('SELECT id, email, role, is_active FROM users WHERE id = ? FOR UPDATE', [userId]);

    const denied = checkStatusChange({ actor, target: rows[0], active, activeAdminCount: admins.length });
    if (denied) throw new AppError(denied.status, denied.code, denied.message);

    await conn.execute(
      'UPDATE users SET is_active = ?, disabled_at = ?, disabled_by = ?, disabled_reason = ? WHERE id = ?',
      [active ? 1 : 0, active ? null : new Date(), active ? null : actor.id, active ? null : (reason ?? null), userId]);
    if (!active) {
      // Cierra de inmediato todas las sesiones de la cuenta deshabilitada.
      await conn.execute('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [new Date(), userId]);
    }
    return rows[0];
  });

  await logAudit({
    actorId: actor.id, action: active ? 'user.enable' : 'user.disable', entity: 'user', entityId: userId,
    metadata: { role: target.role, reason: reason ?? null }, ip,
  });
  return { id: userId, is_active: active };
}
