// Prueba de CONCURRENCIA del aforo contra MySQL/MariaDB REAL.
//
//   Ejecución:  cd backend && npm run test:concurrency
//   Requisitos: XAMPP/MySQL iniciado, base creada con backend/sql/base_de_datos_mysql.sql y .env completo.
//   Opcional:   TEST_DB_NAME=otra_base para no usar la base principal (debe tener las mismas tablas).
//   La prueba crea usuarios y eventos temporales y los borra al terminar.
//
// Qué demuestra: aunque N usuarios reserven EXACTAMENTE al mismo tiempo, nunca se venden más
// lugares que el cupo, el contador no queda negativo y cada reserva descuenta exactamente 1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if (process.env.TEST_DB_NAME) process.env.DB_NAME = process.env.TEST_DB_NAME;
const { pool, query } = await import('../src/lib/db.js');
const { reserveSpotTransaction, cancelReservation } = await import('../src/services/reservationService.js');

const CAPACITY = 5;
const CONCURRENT_USERS = 25;
const userIds = [];
const eventIds = [];
let organizerId;

async function createUser(label) {
  const id = crypto.randomUUID();
  await query(
    "INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, 'x', ?, 'attendee')",
    [id, `test-${label}-${id}@example.test`, `Test ${label}`],
  );
  userIds.push(id);
  return id;
}

async function createEvent(capacity) {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO events (id, organizer_id, title, description, category, starts_at, location, capacity, available_spots, status)
     VALUES (?, ?, 'Evento de prueba', 'Evento temporal para pruebas de concurrencia.', 'otros', ?, 'Sala de pruebas', ?, ?, 'published')`,
    [id, organizerId, new Date(Date.now() + 7 * 864e5), capacity, capacity],
  );
  eventIds.push(id);
  return id;
}

const spotsOf = async (eventId) => (await query('SELECT available_spots FROM events WHERE id = ?', [eventId]))[0].available_spots;
const attempt = (eventId, userId, maxPerUser = 1) =>
  reserveSpotTransaction({ eventId, userId, maxPerUser }).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));

before(async () => { organizerId = await createUser('organizer'); });

after(async () => {
  if (eventIds.length) await query(`DELETE FROM events WHERE id IN (${eventIds.map(() => '?').join(',')})`, eventIds);
  if (userIds.length) await query(`DELETE FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds);
  await pool.end();
});

test(`${CONCURRENT_USERS} usuarios simultáneos compiten por ${CAPACITY} lugares: exactamente ${CAPACITY} reservas`, async () => {
  const eventId = await createEvent(CAPACITY);
  const users = await Promise.all(Array.from({ length: CONCURRENT_USERS }, (_, i) => createUser(`u${i}`)));

  const results = await Promise.all(users.map((userId) => attempt(eventId, userId)));
  const confirmed = results.filter((r) => r.ok);
  const soldOut = results.filter((r) => !r.ok && r.error.code === 'sold_out');

  assert.equal(confirmed.length, CAPACITY, 'solo deben confirmarse tantas reservas como cupo');
  assert.equal(soldOut.length, CONCURRENT_USERS - CAPACITY, 'el resto debe ser rechazado por cupo agotado');
  assert.equal(await spotsOf(eventId), 0, 'el cupo disponible debe quedar en 0 (nunca negativo)');
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM reservations WHERE event_id = ? AND status = 'confirmed'", [eventId]);
  assert.equal(Number(total), CAPACITY, 'cantidad de tickets = cupo');
});

test('un mismo usuario disparando 8 reservas en paralelo no supera el máximo de 2 tickets', async () => {
  const eventId = await createEvent(20);
  const userId = await createUser('greedy');
  const results = await Promise.all(Array.from({ length: 8 }, () => attempt(eventId, userId, 2)));

  assert.equal(results.filter((r) => r.ok).length, 2);
  assert.equal(results.filter((r) => !r.ok && r.error.code === 'limit_per_user_reached').length, 6);
  assert.equal(await spotsOf(eventId), 18, 'cada reserva descontó exactamente 1');
});

test('cancelar una reserva devuelve exactamente 1 lugar y permite que otro usuario reserve', async () => {
  const eventId = await createEvent(1);
  const [a, b] = await Promise.all([createUser('a'), createUser('b')]);
  const first = await attempt(eventId, a);
  assert.ok(first.ok);
  assert.equal((await attempt(eventId, b)).error?.code, 'sold_out');

  await cancelReservation({ reservationId: first.value.id, user: { id: a }, ip: null });
  assert.equal(await spotsOf(eventId), 1);
  assert.ok((await attempt(eventId, b)).ok);
});

test('la base rechaza un cupo negativo (CHECK) aunque la aplicación fallara', async () => {
  const eventId = await createEvent(3);
  await assert.rejects(query('UPDATE events SET available_spots = -1 WHERE id = ?', [eventId]));
  await assert.rejects(query('UPDATE events SET available_spots = 99 WHERE id = ?', [eventId]));
});
