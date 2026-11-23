-- =====================================================================
--  Telón · MIGRACIÓN v4 para bases YA CREADAS (DNI único + fecha original de cada reserva)
--
--  Ejecutala si tu base ya existe (sin borrar datos). Si creás la base desde cero, no la necesitás:
--  base_de_datos_mysql.sql ya incluye todo.
--
--  HeidiSQL: pestaña "Consulta" → abrí este archivo → F9. Es re-ejecutable (sintaxis de MariaDB/XAMPP;
--  en MySQL 8 ejecutala una sola vez porque no soporta IF NOT EXISTS en ALTER/CREATE INDEX).
-- =====================================================================
USE telon_eventos;

-- DNI: identificador único de la persona. Las cuentas existentes quedan con DNI vacío (NULL) y
-- lo completan una sola vez desde "Mi perfil". Los NULL no chocan entre sí en un índice único.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dni VARCHAR(8) NULL AFTER email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_dni ON users (dni);

-- Fecha/hora que tenía el evento cuando se hizo la reserva: permite mostrar "Fecha modificada" en cada entrada.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booked_starts_at DATETIME NULL AFTER ticket_code;

-- Reservas anteriores a esta versión: no sabemos qué fecha vieron, se toma la actual del evento.
-- (Desde ahora, cada reserva nueva guarda la fecha vigente al reservar.)
UPDATE reservations r JOIN events e ON e.id = r.event_id
   SET r.booked_starts_at = e.starts_at
 WHERE r.booked_starts_at IS NULL;
