import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { query, withTransaction } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';
import { signedCoverUrl } from '../utils/media.js';
import { logAudit } from './auditService.js';
import { notifyEventChange } from './notificationService.js';
import { sendEventChangeEmails } from '../utils/email.js';
import { logger } from '../utils/logger.js';

const PAGE_SIZE = 12;
const COLUMNS = 'id, organizer_id, title, description, category, starts_at, location, cover_file, capacity, available_spots, status, created_at';

// Los nombres de columna del UPDATE salen de esta lista fija, NUNCA del input del usuario.
const UPDATABLE_FIELDS = ['title', 'description', 'category', 'starts_at', 'location', 'capacity', 'status'];

const eventLink = (id) => `${env.FRONTEND_URL}/eventos/${id}`;

/** Envía los correos de aviso sin hacer esperar la respuesta HTTP. Los errores solo se registran. */
function emailInBackground({ recipients, payload }) {
  if (!payload || !recipients.length) return;
  sendEventChangeEmails(recipients, payload).catch((err) => logger.error({ err: err.message }, 'Falló el envío de avisos por correo'));
}

/** Quita el nombre de archivo interno y agrega una URL firmada temporal para la portada. */
export function toEvent(row) {
  const { cover_file: coverFile, ...rest } = row;
  return { ...rest, cover_url: coverFile ? signedCoverUrl(coverFile) : null };
}

export async function listPublicEvents({ category, q, page }) {
  const where = ["status = 'published'", 'starts_at > ?'];
  const params = [new Date()];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) { where.push('title LIKE ?'); params.push(`%${q}%`); }   // valor parametrizado (los comodines % _ ya se limpiaron en zod)

  const whereSql = where.join(' AND ');
  const offset = (page - 1) * PAGE_SIZE;   // enteros validados por zod: seguros de interpolar
  const items = await query(`SELECT ${COLUMNS} FROM events WHERE ${whereSql} ORDER BY starts_at ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM events WHERE ${whereSql}`, params);
  return { items: items.map(toEvent), page, pageSize: PAGE_SIZE, total: Number(total) };
}

export async function getEventOrThrow(id, conn) {
  const rows = conn
    ? (await conn.execute(`SELECT ${COLUMNS} FROM events WHERE id = ?`, [id]))[0]
    : await query(`SELECT ${COLUMNS} FROM events WHERE id = ?`, [id]);
  if (!rows[0]) throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
  return rows[0];
}

export const canManageEvent = (event, user) => Boolean(user) && (user.role === 'admin' || event.organizer_id === user.id);

/** Autorización a nivel de objeto: solo el dueño del evento o un admin. */
export function assertCanManage(event, user) {
  if (!canManageEvent(event, user)) {
    // 404 en vez de 403: no se revela la existencia de eventos ajenos (borradores).
    throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
  }
}

export async function getEventForViewer(id, viewer) {
  const event = await getEventOrThrow(id);
  if (event.status !== 'published' && !canManageEvent(event, viewer)) {
    throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
  }
  return toEvent(event);
}

export async function listOrganizerEvents(user) {
  const rows = user.role === 'admin'
    ? await query(`SELECT ${COLUMNS} FROM events ORDER BY starts_at DESC`)
    : await query(`SELECT ${COLUMNS} FROM events WHERE organizer_id = ? ORDER BY starts_at DESC`, [user.id]);
  return rows.map(toEvent);
}

export async function createEvent(user, input, ip) {
  const id = newId();
  await query(
    `INSERT INTO events (id, organizer_id, title, description, category, starts_at, location, capacity, available_spots, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user.id, input.title, input.description, input.category, new Date(input.starts_at), input.location, input.capacity, input.capacity, input.status],
  );
  await logAudit({ actorId: user.id, action: 'event.create', entity: 'event', entityId: id, metadata: { title: input.title }, ip });
  return toEvent(await getEventOrThrow(id));
}

export async function updateEvent(user, id, input, ip) {
  const change = await withTransaction(async (conn) => {
    // Bloqueo de la fila: serializa esta edición con reservas concurrentes del mismo evento.
    const [rows] = await conn.execute('SELECT id, organizer_id, title, starts_at, status, capacity FROM events WHERE id = ? FOR UPDATE', [id]);
    const before = rows[0];
    if (!before) throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
    assertCanManage(before, user);

    const sets = [];
    const params = [];
    for (const field of UPDATABLE_FIELDS) {
      if (input[field] === undefined) continue;
      sets.push(`${field} = ?`);
      params.push(field === 'starts_at' ? new Date(input[field]) : input[field]);
    }
    if (input.capacity !== undefined) {
      // Cambiar el cupo recalcula los lugares libres = cupo nuevo − reservas confirmadas.
      const [[{ active }]] = await conn.execute("SELECT COUNT(*) AS active FROM reservations WHERE event_id = ? AND status = 'confirmed'", [id]);
      if (input.capacity < Number(active)) {
        throw new AppError(409, 'capacity_below_reserved', 'No podés bajar el cupo por debajo de las reservas ya confirmadas.');
      }
      sets.push('available_spots = ?');
      params.push(input.capacity - Number(active));
    }
    if (sets.length) await conn.execute(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

    // ---- Avisos a quienes tienen reserva (misma transacción: todo o nada) ----
    const title = input.title ?? before.title;
    const newStart = input.starts_at !== undefined ? new Date(input.starts_at) : null;
    const wasCancelled = before.status === 'cancelled';

    if (input.status === 'cancelled' && !wasCancelled) {
      const recipients = await notifyEventChange(conn, { eventId: id, type: 'event_cancelled', eventTitle: title });
      return { recipients, payload: { type: 'event_cancelled', title, link: eventLink(id) } };
    }
    // Cambio de día y/o hora (si el evento ya estaba cancelado no se avisa de una fecha que no importa).
    if (newStart && newStart.getTime() !== new Date(before.starts_at).getTime() && !wasCancelled && input.status !== 'cancelled') {
      const oldStartsAt = new Date(before.starts_at);
      const recipients = await notifyEventChange(conn, { eventId: id, type: 'event_rescheduled', eventTitle: title, oldStartsAt, newStartsAt: newStart });
      return { recipients, payload: { type: 'event_rescheduled', title, oldStartsAt, newStartsAt: newStart, link: eventLink(id) } };
    }
    return { recipients: [], payload: null };
  });
  await logAudit({ actorId: user.id, action: 'event.update', entity: 'event', entityId: id, metadata: { fields: Object.keys(input), notified: change.recipients.length }, ip });
  emailInBackground(change);
  return toEvent(await getEventOrThrow(id));
}

export async function deleteEvent(user, id, ip) {
  const { event, recipients } = await withTransaction(async (conn) => {
    const [rows] = await conn.execute(`SELECT ${COLUMNS} FROM events WHERE id = ? FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row) throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
    assertCanManage(row, user);

    // Eliminar un evento futuro equivale a cancelarlo para quienes ya reservaron: se les avisa antes de borrarlo.
    // (event_id queda en NULL por la clave foránea, pero el aviso conserva el título.)
    const shouldNotify = row.status !== 'cancelled' && new Date(row.starts_at) > new Date();
    const notified = shouldNotify ? await notifyEventChange(conn, { eventId: id, type: 'event_cancelled', eventTitle: row.title }) : [];
    await conn.execute('DELETE FROM events WHERE id = ?', [id]);   // las reservas se eliminan en cascada
    return { event: row, recipients: notified };
  });
  if (event.cover_file) await fs.rm(path.join(env.uploadsDir, 'covers', event.cover_file), { force: true });
  await logAudit({ actorId: user.id, action: 'event.delete', entity: 'event', entityId: id, metadata: { title: event.title, notified: recipients.length }, ip });
  // El evento ya no existe: el correo de cancelación no lleva enlace.
  emailInBackground({ recipients, payload: { type: 'event_cancelled', title: event.title, link: null } });
}
