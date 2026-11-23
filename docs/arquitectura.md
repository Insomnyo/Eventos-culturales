# Arquitectura

## Visión general

```mermaid
flowchart LR
  U[Navegador<br/>Vue 3 + Tailwind] -- "HTTPS/HTTP + Authorization: Bearer JWT<br/>(cookie HttpOnly solo en /auth)" --> API[API Express]
  API -- "mysql2 · consultas parametrizadas<br/>transacciones" --> DB[(MySQL / MariaDB<br/>XAMPP)]
  API -- "fs" --> FS[(backend/uploads<br/>portadas)]
  API -- "Nodemailer" --> M[SMTP<br/>o consola en local]
  API -- "siteverify" --> H[hCaptcha opcional]
  HS[HeidiSQL] -. "administración" .-> DB
```

**Principio**: el navegador solo habla con la API. La API autentica (JWT), autoriza (rol + propiedad del recurso), valida el input y es la única que toca la base de datos.

## Capas del backend

```
Request → requestId → pino-http → Helmet → CORS → timeout → rate limit global → cookies → JSON (20 kB)
        → ruta: [rate limit específico] → requireAuth → requireRole → validate(zod) → controller → service → MySQL
        → notFound → errorHandler (respuesta genérica, detalle al log)
```

| Capa | Responsabilidad |
|---|---|
| `routes/` | Orden de middlewares por endpoint |
| `middlewares/` | auth, roles, rate limit, validación, captcha, origen confiable, errores, subida |
| `validators/` | Schemas zod (única fuente de verdad del input) |
| `controllers/` | Traducen HTTP ↔ servicios; sin lógica de negocio |
| `services/` | Reglas de negocio, autorización por objeto, SQL, transacciones, auditoría |
| `lib/db.js` | Pool MySQL, `query()` parametrizada y `withTransaction()` |
| `utils/` | logger, emails, tickets, hashing, URLs firmadas |

## Flujo: sesión

```mermaid
sequenceDiagram
  participant B as Navegador
  participant API as API
  participant DB as MySQL
  B->>API: POST /auth/login (email, contraseña, captcha)
  API->>DB: busca usuario · bcrypt.compare · cuenta intentos fallidos
  API-->>B: access JWT (15 min, en memoria) + cookie HttpOnly con refresh token
  B->>API: peticiones con Authorization: Bearer
  Note over B,API: el JWT vence → 401 token_expired
  B->>API: POST /auth/refresh (cookie, Origin verificado)
  API->>DB: revoca el refresh usado y crea uno nuevo (rotación)
  API-->>B: nuevo access JWT + nueva cookie
```

Al recargar la página, la app llama a `/auth/refresh`: si la cookie es válida, recupera la sesión sin guardar nada en `localStorage`.

## Flujo: reservar un lugar

```mermaid
sequenceDiagram
  participant B as Navegador
  participant API as API
  participant DB as MySQL
  B->>API: POST /events/:id/reservations (JWT + captcha)
  API->>API: rate limit IP → auth → rate limit usuario → email verificado → zod → hCaptcha
  API->>DB: BEGIN
  API->>DB: SELECT … FROM events WHERE id=? FOR UPDATE
  Note over DB: serializa las reservas del mismo evento
  API->>DB: valida estado/fecha/límite por persona/cupo
  API->>DB: INSERT reserva (ticket UUID v4) · UPDATE available_spots − 1
  API->>DB: COMMIT
  API->>DB: audit_logs
  API-->>B: 201 {reserva, cupo actualizado, emailSent}
```

## Flujo: check-in
Organizador → `PATCH /events/:id/attendees/:reservationId` o `POST /tickets/:code/check-in` → el servicio verifica que sea **dueño del evento o admin**, que la reserva pertenezca a ese evento, actualiza la asistencia y registra auditoría.

## Flujo: notificaciones de cambios en eventos

```mermaid
sequenceDiagram
  participant O as Organizador
  participant API as API
  participant DB as MySQL
  participant A as Asistente (campana)
  O->>API: PUT /events/:id (nuevo día/hora o estado "cancelado")
  API->>DB: BEGIN · SELECT evento FOR UPDATE
  API->>DB: UPDATE evento
  API->>DB: INSERT notifications (una por persona con reserva confirmada)
  API->>DB: COMMIT
  loop cada 60 s (solo con la pestaña visible)
    A->>API: GET /notifications/unread-count
  end
  A->>API: abre la campana → GET /notifications
  A->>API: clic en un aviso → POST /notifications/:id/read
```

## Decisiones de diseño
- **Avisos en la misma transacción que el cambio**: si el cambio se revierte, no quedan avisos de algo que no ocurrió.
- **Cupo con un único punto de verdad**: `available_spots` solo se modifica dentro de transacciones con la fila del evento bloqueada.
- **Rol en base, no en el token**: el middleware lee `users.role` en cada request; un cambio de rol aplica de inmediato.
- **Guards del frontend**: solo UX; la seguridad real es del backend.
- **Imágenes fuera de una carpeta pública**: solo se entregan por URL firmada con vencimiento.
