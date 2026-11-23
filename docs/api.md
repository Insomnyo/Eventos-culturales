# API

Base: `/api` · JSON. Autenticación: `Authorization: Bearer <access token>`. El refresh token viaja solo en la cookie HttpOnly `telon_refresh` (ruta `/api/auth`).

Error uniforme (nunca incluye stack ni detalles internos):
```json
{ "error": { "code": "sold_out", "message": "Se agotaron los lugares para este evento.", "requestId": "…", "details": [] } }
```

## Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | `{ fullName, dni, email, password, captchaToken? }` → `202`. El **DNI** es obligatorio (7 u 8 números, con o sin puntos; se guarda sin puntos) y único. Respuesta idéntica exista o no el email **o el DNI** (no se revela cuál ya tiene cuenta). Envía el enlace de verificación |
| POST | `/auth/login` | `identifier` es el **DNI o el email**; la contraseña es siempre obligatoria. | `{ identifier, password, captchaToken? }` → `{ accessToken, expiresInSeconds, profile }` + cookie de refresh. `401 invalid_credentials`, `429 too_many_attempts` (5 fallos = 15 min), `403 account_disabled` (cuenta deshabilitada; solo se informa con la contraseña correcta) |
| POST | `/auth/refresh` | Usa la cookie (valida `Origin`). Rota el refresh token y devuelve un nuevo `accessToken` |
| POST | `/auth/logout` | Revoca el refresh token y borra la cookie → `204` |
| POST | `/auth/verify-email` | `{ token }` del enlace del correo (un solo uso, vence a las 24 h) |
| POST | `/auth/resend-verification` | `{ email, captchaToken? }` → `202` genérico |
| GET | `/media/covers/:file?exp=&sig=` | Imagen de portada; solo con URL firmada vigente |

## Públicos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/events?category=&q=&page=` | Eventos publicados y futuros (12 por página). Incluye `cover_url` firmada |
| GET | `/events/:id` | Detalle. Borradores/cancelados solo para dueño o admin (token opcional) |

## Usuario autenticado
| Método | Ruta | Requisitos | Descripción |
|---|---|---|---|
| GET | `/me` | JWT | Perfil completo (`full_name`, `phone`, `city`, `bio`, `role`, `email_verified`, `created_at`) |
| PATCH | `/me` | JWT | Edita **solo el propio** perfil: `{ fullName?, dni?, phone?, city?, bio? }`. El `dni` solo se puede **completar una vez** (cuentas antiguas sin DNI); si ya existe, cambiarlo responde `409 dni_locked`. Email, rol e id no son editables (`400` si se envían). Campos vacíos se guardan como `NULL` |
| GET | `/me/reservations` | JWT | Mis entradas (con `ticket_code`). Cada una incluye `date_changed` (el evento tiene hoy una fecha distinta a la que tenía al reservar) y `previous_starts_at` (la fecha que vio al reservar) |
| POST | `/events/:id/reservations` | JWT + **email verificado** + captcha | Reserva 1 entrada → `201 { reservation, availableSpots, emailSent }` |
| DELETE | `/reservations/:id` | JWT (dueño) | Cancela y devuelve el lugar → `204` |

Errores de reserva: `email_not_verified` 403 · `captcha_required/failed` 400 · `event_not_open` / `event_already_started` / `limit_per_user_reached` / `sold_out` 409 · `rate_limited` 429.

## Notificaciones (siempre las del propio usuario)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notifications?limit=20` | Últimas notificaciones (`limit` 1–50) y `unreadCount`. Cada una: `type` (`event_cancelled` \| `event_rescheduled`), `event_id` (`null` si el evento se eliminó), `event_title`, `old_starts_at`, `new_starts_at`, `read_at`, `created_at` |
| GET | `/notifications/unread-count` | `{ unreadCount }` (consulta liviana para la campana) |
| POST | `/notifications/:id/read` | Marca una como leída. `404` si no existe **o es de otra persona** |
| POST | `/notifications/read-all` | Marca todas como leídas |

**Correos:** además de la campana, cada persona afectada recibe un correo (cambio de día/hora con "Antes/Ahora", o cancelación). Se envían **después** de confirmar el cambio en la base de datos, de a 5 por vez y sin hacer esperar la respuesta: un fallo de correo no revierte el cambio. Sin SMTP configurado, quedan en la consola y en `backend/mail-outbox`. La entrada que se envía al reservar incluye el DNI del titular.

**Cuándo se generan:** al editar un evento (`PUT /events/:id`) se avisa una vez a cada persona con reserva confirmada si **cambia el día u hora** (`event_rescheduled`) o si **pasa a "cancelado"** (`event_cancelled`). Eliminar un evento futuro con inscriptos también avisa su cancelación. Cambiar título, lugar, descripción o cupo no genera avisos. Los avisos se crean en la misma transacción que el cambio del evento.

## Organizador / Admin (propiedad verificada en el servicio)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizer/events` | Mis eventos (admin: todos) |
| POST | `/events` | Crea evento. `title, description, category, starts_at (ISO), location, capacity, status` |
| PUT | `/events/:id` | Edición parcial (campos desconocidos → 400). Bajar `capacity` por debajo de lo reservado → `409 capacity_below_reserved` |
| DELETE | `/events/:id` | Elimina evento y sus inscripciones → `204` |
| POST | `/events/:id/cover` | `multipart/form-data`, campo `cover` (JPG/PNG/WebP ≤ 2 MB) → `{ cover_url }` |
| GET | `/events/:id/attendees` | Inscriptos con estado de asistencia y **DNI** |
| POST | `/events/:id/check-in/dni` | `{ "dni": "12345678" }`. Check-in en la puerta para quien olvidó su entrada: marca **una** entrada pendiente de esa persona y devuelve `{ reservation, remaining, total }` (con el nombre, para compararlo con el documento). `404 dni_not_registered`, `409 already_checked_in` |
| PATCH | `/events/:id/attendees/:reservationId` | `{ "attendance_status": "pending" \| "attended" \| "no_show" }` |
| GET | `/tickets/:code` | Verifica un ticket (solo organizador del evento o admin) |
| POST | `/tickets/:code/check-in` | Marca asistencia por código; `409 already_checked_in` si ya se usó |
| GET | `/admin/users` | (solo admin) Organizadores y administradores con su estado: `is_active`, `disabled_at`, `disabled_reason` |
| PATCH | `/admin/users/:id/status` | (**solo admin**) `{ "active": true \| false, "reason"?: "…" }`. Habilita o deshabilita una cuenta de **organizador o administrador**. Al deshabilitar se revocan todas sus sesiones. Errores: `403 forbidden` (no es admin), `400 role_not_manageable` (asistentes no incluidos), `400 cannot_disable_self`, `409 last_admin` (no se puede deshabilitar al único admin activo), `409 no_change` |
| PATCH | `/admin/roles` | (solo admin) `{ "email": "…", "role": "attendee" \| "organizer" \| "admin" }`, auditado |

## Límites de tasa
Global 300 / 15 min por IP · Login 20 / 15 min por IP · Registro 10 / h · Verificación y reenvío 6 / h · Refresh 120 / 15 min · Reserva 10 por usuario y 30 por IP cada 10 min · Escrituras 60 por usuario · Subidas 15 por usuario. Superarlos devuelve `429 rate_limited`.
