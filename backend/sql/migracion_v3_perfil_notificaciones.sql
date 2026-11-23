-- =====================================================================
--  Telón · MIGRACIÓN para bases YA CREADAS (perfil editable, deshabilitar cuentas, notificaciones)
--
--  Usala si ya ejecutaste base_de_datos_mysql.sql antes de esta versión: agrega lo nuevo SIN borrar tus datos.
--  (Si vas a crear la base desde cero, no la necesitás: base_de_datos_mysql.sql ya incluye todo.)
--
--  HeidiSQL: pestaña "Consulta" → abrí este archivo → F9.
--  Es re-ejecutable. Usa "ADD COLUMN IF NOT EXISTS", compatible con MariaDB (XAMPP). Si tu servidor es
--  MySQL 8 (no MariaDB), ejecutalo una sola vez: MySQL no soporta ese modificador.
-- =====================================================================
USE telon_eventos;

-- Perfil editable
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)  NULL AFTER full_name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city  VARCHAR(80)  NULL AFTER phone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio   VARCHAR(300) NULL AFTER city;

-- Estado de la cuenta (las cuentas existentes quedan habilitadas)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active       TINYINT(1)   NOT NULL DEFAULT 1 AFTER role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at     DATETIME     NULL AFTER is_active;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_by     CHAR(36)     NULL AFTER disabled_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason VARCHAR(200) NULL AFTER disabled_by;

-- Notificaciones de cambios en eventos
CREATE TABLE IF NOT EXISTS notifications (
  id            CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,
  event_id      CHAR(36)     NULL,
  type          ENUM('event_cancelled','event_rescheduled') NOT NULL,
  event_title   VARCHAR(120) NOT NULL,
  old_starts_at DATETIME     NULL,
  new_starts_at DATETIME     NULL,
  read_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, read_at, created_at),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_notif_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL
) ENGINE=InnoDB;
