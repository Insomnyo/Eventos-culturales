-- =====================================================================
--  Telón · Base de datos para MySQL / MariaDB (XAMPP) — ejecutar con HeidiSQL
--
--  Cómo usarlo:
--    1. XAMPP: iniciá el módulo "MySQL".
--    2. HeidiSQL: nueva sesión → host 127.0.0.1 · puerto 3306 · usuario root (sin contraseña en XAMPP por defecto).
--    3. Pestaña "Consulta" → abrí este archivo → ejecutá todo (F9).
--    4. Es re-ejecutable: no borra ni duplica lo que ya existe.
--
--  Compatible con MariaDB 10.4+ (XAMPP) y MySQL 8.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS telon_eventos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE telon_eventos;

-- ---------------------------------------------------------------------
--  users: cuentas. La contraseña se guarda SOLO como hash bcrypt (nunca en texto plano).
--  El rol por defecto es 'attendee'; organizadores/admins los asigna un admin (o el script create-admin).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 CHAR(36)     NOT NULL,
  email              VARCHAR(254) NOT NULL,
  dni                VARCHAR(8)   NULL,                       -- 7 u 8 dígitos, sin puntos. Único. NULL solo en cuentas antiguas sin DNI cargado
  password_hash      VARCHAR(100) NOT NULL,
  full_name          VARCHAR(80)  NOT NULL,
  phone              VARCHAR(30)  NULL,                       -- perfil editable por el propio usuario
  city               VARCHAR(80)  NULL,
  bio                VARCHAR(300) NULL,
  role               ENUM('attendee','organizer','admin') NOT NULL DEFAULT 'attendee',
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,         -- 0 = cuenta deshabilitada por un administrador
  disabled_at        DATETIME     NULL,
  disabled_by        CHAR(36)     NULL,                       -- admin que la deshabilitó (el detalle queda en audit_logs)
  disabled_reason    VARCHAR(200) NULL,
  email_verified_at  DATETIME     NULL,
  failed_login_count INT          NOT NULL DEFAULT 0,        -- bloqueo temporal anti fuerza bruta
  locked_until       DATETIME     NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_dni (dni)                            -- varios NULL permitidos; un DNI no puede repetirse
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  refresh_tokens: sesiones. Se guarda el HASH (sha256) del token, nunca el token.
--  Rotación: cada uso revoca el anterior; reutilizar uno revocado invalida todas las sesiones del usuario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          CHAR(36)  NOT NULL,
  user_id     CHAR(36)  NOT NULL,
  token_hash  CHAR(64)  NOT NULL,
  expires_at  DATETIME  NOT NULL,
  revoked_at  DATETIME  NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  email_tokens: enlaces de verificación de email (también se guarda solo el hash).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_tokens (
  id          CHAR(36)  NOT NULL,
  user_id     CHAR(36)  NOT NULL,
  token_hash  CHAR(64)  NOT NULL,
  expires_at  DATETIME  NOT NULL,
  used_at     DATETIME  NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_token_hash (token_hash),
  KEY idx_email_token_user (user_id),
  CONSTRAINT fk_email_token_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  events
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id              CHAR(36)     NOT NULL,
  organizer_id    CHAR(36)     NOT NULL,
  title           VARCHAR(120) NOT NULL,
  description     TEXT         NOT NULL,
  category        ENUM('teatro','concierto','charla','danza','cine','otros') NOT NULL,
  starts_at       DATETIME     NOT NULL,                  -- se guarda en UTC
  location        VARCHAR(200) NOT NULL,
  cover_file      VARCHAR(80)  NULL,                      -- nombre del archivo en backend/uploads/covers
  capacity        INT          NOT NULL,
  available_spots INT          NOT NULL,
  status          ENUM('draft','published','cancelled') NOT NULL DEFAULT 'published',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_status_start (status, starts_at),
  KEY idx_events_organizer (organizer_id),
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES users (id) ON DELETE CASCADE,
  -- Invariantes de aforo: red de seguridad final si algún día hubiera un bug en la aplicación.
  CONSTRAINT chk_events_capacity CHECK (capacity BETWEEN 1 AND 5000),
  CONSTRAINT chk_events_spots CHECK (available_spots >= 0 AND available_spots <= capacity)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  reservations (un ticket por fila)
--  ticket_code lo genera la aplicación con crypto.randomUUID() (UUID v4, CSPRNG → impredecible).
--  No se usa UUID() de MySQL porque genera UUID v1 (basado en hora y MAC: predecible).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id                CHAR(36) NOT NULL,
  event_id          CHAR(36) NOT NULL,
  user_id           CHAR(36) NOT NULL,
  ticket_code       CHAR(36) NOT NULL,
  booked_starts_at  DATETIME NULL,                          -- fecha/hora del evento CUANDO se reservó (para marcar "Fecha modificada")
  status            ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  attendance_status ENUM('pending','attended','no_show') NOT NULL DEFAULT 'pending',
  checked_in_at     DATETIME NULL,
  checked_in_by     CHAR(36) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservations_ticket (ticket_code),
  KEY idx_reservations_event_user (event_id, user_id, status),
  KEY idx_reservations_user (user_id, created_at),
  CONSTRAINT fk_res_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_res_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_res_checkedby FOREIGN KEY (checked_in_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  notifications: avisos a quienes tienen reserva cuando un evento se cancela o cambia de día/hora.
--  Se guarda el título del evento como "foto" (event_title): si el evento se elimina, el aviso se conserva.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id            CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,                       -- destinatario
  event_id      CHAR(36)     NULL,                           -- NULL si el evento fue eliminado
  type          ENUM('event_cancelled','event_rescheduled') NOT NULL,
  event_title   VARCHAR(120) NOT NULL,
  old_starts_at DATETIME     NULL,                           -- UTC (solo en event_rescheduled)
  new_starts_at DATETIME     NULL,
  read_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, read_at, created_at),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_notif_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  audit_logs: bitácora de acciones críticas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  actor_id   CHAR(36)     NULL,
  action     VARCHAR(60)  NOT NULL,          -- event.create, reservation.create, attendance.update, role.change...
  entity     VARCHAR(40)  NOT NULL,
  entity_id  VARCHAR(64)  NULL,
  metadata   LONGTEXT     NULL,             -- JSON en texto
  ip         VARCHAR(64)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================================
--  OPCIONAL (recomendado): usuario de aplicación con privilegios mínimos.
--  MySQL no tiene Row Level Security; la autorización la hace el backend. Para limitar el daño
--  si algo falla, la API debe conectarse con un usuario que NO pueda borrar ni alterar tablas.
--
--  1. Cambiá 'CAMBIAR_ESTA_CLAVE' por una contraseña propia.
--  2. Quitá los "-- " del bloque de abajo y ejecutalo.
--  3. En el .env: DB_USER=telon_app y DB_PASSWORD=<tu clave>.
-- =====================================================================
-- CREATE USER IF NOT EXISTS 'telon_app'@'localhost' IDENTIFIED BY 'CAMBIAR_ESTA_CLAVE';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON telon_eventos.* TO 'telon_app'@'localhost';
-- FLUSH PRIVILEGES;
