import { query } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';

const COLUMNS = 'id, type, event_id, event_title, old_starts_at, new_starts_at, read_at, created_at';
const CHUNK = 200;   // filas por INSERT (con 8 columnas, muy por debajo del límite de parámetros)

/**
 * Crea un aviso para CADA persona con reserva confirmada del evento (una sola vez por persona,
 * aunque tenga 2 entradas). Se ejecuta DENTRO de la transacción que modifica el evento: si algo
 * falla se revierte todo y no quedan avisos de un cambio que no ocurrió.
 * @returns las personas avisadas (user_id, email, full_name): el correo se envía DESPUÉS del commit
 */
export async function notifyEventChange(conn, { eventId, type, eventTitle, oldStartsAt = null, newStartsAt = null }) {
  const [recipients] = await conn.execute(
    `SELECT DISTINCT r.user_id, u.email, u.full_name
       FROM reservations r JOIN users u ON u.id = r.user_id
      WHERE r.event_id = ? AND r.status = 'confirmed' AND u.is_active = 1`, [eventId]);

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const batch = recipients.slice(i, i + CHUNK);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = batch.flatMap(({ user_id: userId }) => [newId(), userId, eventId, type, eventTitle, oldStartsAt, newStartsAt]);
    await conn.execute(
      `INSERT INTO notifications (id, user_id, event_id, type, event_title, old_starts_at, new_starts_at) VALUES ${placeholders}`, params);
  }
  return recipients;
}

// Todas las consultas filtran por user_id del token: nadie puede leer ni marcar avisos ajenos.
export async function listForUser(userId, limit) {
  const items = await query(
    `SELECT ${COLUMNS} FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`, [userId]);
  return { items, unreadCount: await unreadCount(userId) };
}

export async function unreadCount(userId) {
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return Number(total);
}

export async function markRead(userId, notificationId) {
  // La comprobación de propiedad va en la propia consulta (user_id del token): un aviso ajeno responde 404.
  const [found] = await query('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
  if (!found) throw new AppError(404, 'notification_not_found', 'No encontramos esa notificación.');
  await query('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?', [new Date(), notificationId, userId]);
  return { unreadCount: await unreadCount(userId) };
}

export async function markAllRead(userId) {
  await query('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [new Date(), userId]);
  return { unreadCount: 0 };
}
