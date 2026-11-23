import { query, withTransaction } from '../lib/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';
import { sendTicketEmail } from '../utils/email.js';
import { getEventOrThrow } from './eventService.js';
import { logAudit } from './auditService.js';

/**
 * =====================================================================
 *  RESERVA ATÓMICA — cómo se previene la condición de carrera (sobreventa)
 * =====================================================================
 *  PROBLEMA: con el patrón "leer cupo → verificar → escribir", dos peticiones simultáneas leen
 *  available_spots = 1, ambas ven que hay lugar y ambas reservan → cupo = -1.
 *
 *  SOLUCIÓN (3 capas):
 *   1) Transacción de base de datos + bloqueo pesimista de fila: "SELECT ... FOR UPDATE" sobre
 *      la fila del evento. La 2ª transacción espera hasta que la 1ª haga COMMIT y recién entonces
 *      lee el cupo ya actualizado. Las reservas de un mismo evento se serializan; las de eventos
 *      distintos no se bloquean entre sí.
 *   2) Insertar el ticket y descontar 1 lugar ocurren en la MISMA transacción: o se confirman
 *      juntos o no se confirma nada.
 *   3) CHECK (available_spots >= 0 AND available_spots <= capacity) en la tabla: aunque hubiera un
 *      bug futuro, la base rechaza el estado inválido.
 *
 *  El límite de tickets por persona se verifica DENTRO del bloqueo: una persona que dispare N
 *  peticiones en paralelo tampoco puede superarlo.
 *
 *  Nunca se debe leer el cupo fuera de esta transacción para decidir si se reserva.
 * =====================================================================
 */
export async function reserveSpotTransaction({ eventId, userId, maxPerUser }) {
  return withTransaction(async (conn) => {
    // (1) Bloqueo de fila: serializa las reservas concurrentes del mismo evento.
    const [events] = await conn.execute(
      'SELECT id, status, starts_at, available_spots FROM events WHERE id = ? FOR UPDATE', [eventId]);
    const event = events[0];
    if (!event) throw new AppError(404, 'event_not_found', 'No encontramos ese evento.');
    if (event.status !== 'published') throw new AppError(409, 'event_not_open', 'Este evento no está abierto a inscripciones.');
    if (new Date(event.starts_at) <= new Date()) throw new AppError(409, 'event_already_started', 'Este evento ya comenzó.');

    // Límite por persona (se evalúa con el bloqueo tomado → no se puede esquivar con paralelismo).
    const [[{ mine }]] = await conn.execute(
      "SELECT COUNT(*) AS mine FROM reservations WHERE event_id = ? AND user_id = ? AND status = 'confirmed'", [eventId, userId]);
    if (Number(mine) >= maxPerUser) {
      throw new AppError(409, 'limit_per_user_reached', `Alcanzaste el máximo de ${maxPerUser} entradas por persona para este evento.`);
    }

    // Rechazo cuando el cupo llega a cero.
    if (event.available_spots <= 0) throw new AppError(409, 'sold_out', 'Se agotaron los lugares para este evento.');

    // (2) Ticket + descuento exacto de 1 lugar, en la misma transacción.
    const reservation = { id: newId(), ticket_code: newId() };   // UUID v4 (CSPRNG): impredecible
    // booked_starts_at guarda la fecha vigente AL RESERVAR: si después el organizador la cambia,
    // "Mis entradas" puede marcar la entrada como "Fecha modificada" y mostrar la fecha anterior.
    await conn.execute('INSERT INTO reservations (id, event_id, user_id, ticket_code, booked_starts_at) VALUES (?, ?, ?, ?, ?)',
      [reservation.id, eventId, userId, reservation.ticket_code, event.starts_at]);
    await conn.execute('UPDATE events SET available_spots = available_spots - 1 WHERE id = ?', [eventId]);

    return { ...reservation, event_id: eventId, attendance_status: 'pending', available_spots: event.available_spots - 1 };
  });
}

export async function createReservation({ eventId, user, ip }) {
  const reservation = await reserveSpotTransaction({ eventId, userId: user.id, maxPerUser: env.MAX_TICKETS_PER_USER });
  await logAudit({ actorId: user.id, action: 'reservation.create', entity: 'reservation', entityId: reservation.id, metadata: { eventId }, ip });

  const event = await getEventOrThrow(eventId);
  const emailSent = await sendTicketEmail({ to: user.email, name: user.fullName, dni: user.dni, event, ticketCode: reservation.ticket_code });

  return {
    reservation: { id: reservation.id, ticket_code: reservation.ticket_code, event_id: eventId, attendance_status: 'pending' },
    availableSpots: reservation.available_spots,
    emailSent,
  };
}

/** Cancela una reserva propia y devuelve exactamente 1 lugar. Orden de bloqueo: evento → reserva (evita deadlocks). */
export async function cancelReservation({ reservationId, user, ip }) {
  const eventId = await withTransaction(async (conn) => {
    const [found] = await conn.execute('SELECT event_id FROM reservations WHERE id = ? AND user_id = ?', [reservationId, user.id]);
    if (!found[0]) throw new AppError(404, 'reservation_not_found', 'No encontramos esa reserva.');
    const id = found[0].event_id;

    const [events] = await conn.execute('SELECT starts_at FROM events WHERE id = ? FOR UPDATE', [id]);
    const [reservations] = await conn.execute(
      'SELECT status FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE', [reservationId, user.id]);
    if (!reservations[0] || reservations[0].status !== 'confirmed') throw new AppError(404, 'reservation_not_found', 'No encontramos esa reserva.');
    if (new Date(events[0].starts_at) <= new Date()) throw new AppError(409, 'event_already_started', 'Este evento ya comenzó.');

    await conn.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservationId]);
    await conn.execute('UPDATE events SET available_spots = available_spots + 1 WHERE id = ?', [id]);
    return id;
  });
  await logAudit({ actorId: user.id, action: 'reservation.cancel', entity: 'reservation', entityId: reservationId, metadata: { eventId }, ip });
}

/** "Mis entradas": solo reservas del propio usuario (filtro por el user_id del token verificado). */
export async function listMyReservations(user) {
  const rows = await query(
    `SELECT r.id, r.ticket_code, r.status, r.attendance_status, r.created_at, r.booked_starts_at,
            e.id AS event_id, e.title, e.starts_at, e.location, e.category, e.status AS event_status
       FROM reservations r JOIN events e ON e.id = r.event_id
      WHERE r.user_id = ? AND r.status = 'confirmed'
      ORDER BY r.created_at DESC`, [user.id]);
  return rows.map((r) => ({
    id: r.id, ticket_code: r.ticket_code, status: r.status, attendance_status: r.attendance_status, created_at: r.created_at,
    // "Fecha modificada": el evento tiene hoy una fecha distinta a la que tenía cuando se reservó.
    date_changed: Boolean(r.booked_starts_at) && new Date(r.booked_starts_at).getTime() !== new Date(r.starts_at).getTime(),
    previous_starts_at: r.booked_starts_at ?? null,
    event: { id: r.event_id, title: r.title, starts_at: r.starts_at, location: r.location, category: r.category, status: r.event_status },
  }));
}
