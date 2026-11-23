import { query, withTransaction } from '../lib/db.js';
import { AppError } from '../utils/errors.js';
import { assertCanManage, getEventOrThrow } from './eventService.js';
import { logAudit } from './auditService.js';

const SELECT_RESERVATION = `
  SELECT r.id, r.event_id, r.ticket_code, r.status, r.attendance_status, r.checked_in_at, r.created_at,
         u.full_name, u.email, u.dni
    FROM reservations r JOIN users u ON u.id = r.user_id`;

const toReservation = ({ full_name: fullName, email, dni, ...rest }) => ({ ...rest, attendee: { full_name: fullName, email, dni: dni ?? null } });

/** Lista de inscriptos: solo el dueño del evento o un admin. */
export async function listAttendees(user, eventId) {
  const event = await getEventOrThrow(eventId);
  assertCanManage(event, user);
  const rows = await query(`${SELECT_RESERVATION} WHERE r.event_id = ? AND r.status = 'confirmed' ORDER BY r.created_at ASC`, [eventId]);
  return { event: { id: event.id, title: event.title, starts_at: event.starts_at, capacity: event.capacity }, attendees: rows.map(toReservation) };
}

async function getConfirmedReservation(whereSql, params) {
  const [row] = await query(`${SELECT_RESERVATION} WHERE ${whereSql} AND r.status = 'confirmed'`, params);
  if (!row) throw new AppError(404, 'reservation_not_found', 'No encontramos esa entrada.');
  return toReservation(row);
}

async function applyAttendance({ user, reservation, attendanceStatus, ip }) {
  const attended = attendanceStatus === 'attended';
  await query('UPDATE reservations SET attendance_status = ?, checked_in_at = ?, checked_in_by = ? WHERE id = ?',
    [attendanceStatus, attended ? new Date() : null, attended ? user.id : null, reservation.id]);
  await logAudit({
    actorId: user.id, action: 'attendance.update', entity: 'reservation', entityId: reservation.id,
    metadata: { eventId: reservation.event_id, from: reservation.attendance_status, to: attendanceStatus }, ip,
  });
  return getConfirmedReservation('r.id = ?', [reservation.id]);
}

export async function setAttendance({ user, eventId, reservationId, attendanceStatus, ip }) {
  const event = await getEventOrThrow(eventId);
  assertCanManage(event, user);
  // Se filtra también por event_id: un organizador no puede tocar reservas de OTRO evento
  // pasando un reservationId ajeno en la URL (IDOR).
  const reservation = await getConfirmedReservation('r.id = ? AND r.event_id = ?', [reservationId, eventId]);
  return applyAttendance({ user, reservation, attendanceStatus, ip });
}

/** Verificación de ticket por código: dueño del evento o admin. */
export async function lookupTicket(user, ticketCode) {
  const reservation = await getConfirmedReservation('r.ticket_code = ?', [ticketCode]);
  const event = await getEventOrThrow(reservation.event_id);
  assertCanManage(event, user);
  return { reservation, event: { id: event.id, title: event.title, starts_at: event.starts_at } };
}

export async function checkInByTicket({ user, ticketCode, ip }) {
  const { reservation, event } = await lookupTicket(user, ticketCode);
  if (reservation.attendance_status === 'attended') throw new AppError(409, 'already_checked_in', 'Esta entrada ya fue usada.');
  const updated = await applyAttendance({ user, reservation, attendanceStatus: 'attended', ip });
  return { reservation: updated, event };
}

/**
 * Check-in en la puerta por DNI: para quien olvidó su entrada. Marca UNA entrada pendiente de esa persona
 * por vez (si reservó 2, hay que presentarlo dos veces: así no entra un acompañante sin reserva).
 * Solo el dueño del evento o un admin. Devuelve cuántas entradas le quedan por ingresar.
 *
 * OJO: el DNI no está verificado contra ningún registro oficial. Por eso la respuesta incluye el NOMBRE
 * para que el organizador lo compare con el documento físico de la persona.
 */
export async function checkInByDni({ user, eventId, dni, ip }) {
  const event = await getEventOrThrow(eventId);
  assertCanManage(event, user);

  const result = await withTransaction(async (conn) => {
    // FOR UPDATE: dos personas del equipo que escaneen el mismo DNI a la vez no pueden marcar la misma entrada.
    const [rows] = await conn.execute(
      `${SELECT_RESERVATION} WHERE r.event_id = ? AND u.dni = ? AND r.status = 'confirmed' ORDER BY r.created_at ASC FOR UPDATE`,
      [eventId, dni]);
    if (!rows.length) throw new AppError(404, 'dni_not_registered', 'No hay ninguna inscripción con ese DNI en este evento.');

    const pending = rows.filter((r) => r.attendance_status !== 'attended');
    if (!pending.length) throw new AppError(409, 'already_checked_in', 'Esa persona ya ingresó con todas sus entradas.');

    const target = pending[0];
    await conn.execute('UPDATE reservations SET attendance_status = ?, checked_in_at = ?, checked_in_by = ? WHERE id = ?',
      ['attended', new Date(), user.id, target.id]);
    return { target, remaining: pending.length - 1, total: rows.length };
  });

  await logAudit({
    actorId: user.id, action: 'attendance.update', entity: 'reservation', entityId: result.target.id,
    metadata: { eventId, from: result.target.attendance_status, to: 'attended', via: 'dni' }, ip,
  });
  return { reservation: await getConfirmedReservation('r.id = ?', [result.target.id]), remaining: result.remaining, total: result.total };
}
