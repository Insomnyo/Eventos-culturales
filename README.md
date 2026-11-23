# Telón · Plataforma de registro para eventos culturales (versión local)

Aplicación web para difundir eventos culturales (teatro, conciertos sinfónicos, charlas) y gestionar **inscripciones gratuitas** con control de aforo transaccional, tickets únicos por email y check-in el día de la función.

Esta versión corre **100 % en tu computadora**: base de datos MySQL de **XAMPP**, administrada con **HeidiSQL**. No necesita cuentas externas.

| Capa | Tecnología |
|---|---|
| Frontend | Vue 3 (Composition API) + Pinia + Vue Router + TailwindCSS (Vite) |
| Backend | Node.js 20+ + Express 4 |
| Base de datos | MySQL / MariaDB (XAMPP) con `mysql2` |
| Autenticación | Propia: bcrypt + JWT de vida corta + refresh token en cookie HttpOnly |
| Emails | Nodemailer (SMTP). Sin SMTP, se imprimen en la consola del backend |
| Imágenes | Disco local (`backend/uploads`) con URLs firmadas |

## Qué hace

- **Asistentes**: se registran, verifican su email, ven la cartelera, reservan (máx. 2 entradas por evento), ven su código en *Mis entradas* y pueden cancelar.
- **Organizadores**: CRUD de eventos con portada y aforo, lista de inscriptos, check-in (manual o por código) con estados *pendiente / asistió / no asistió*.
- **Admins**: promueven usuarios a organizador, gestionan cualquier evento y pueden **deshabilitar/habilitar** cuentas de organizadores y de otros administradores.
- **Perfil**: cada persona ve y edita su propio perfil (nombre, teléfono, ciudad, sobre mí) en **Mi perfil**.
- **DNI**: se pide al registrarse (único), se puede usar junto con la contraseña para ingresar (en lugar del email), figura en la entrada y permite al organizador registrar el ingreso en la puerta si la persona olvidó su entrada. Las cuentas anteriores lo completan una vez desde **Mi perfil**.
- **Mis entradas**: cada entrada muestra la etiqueta **"Evento cancelado"** o **"Fecha modificada"** (con la fecha anterior) si corresponde.
- **Notificaciones**: además de la campana, se envía un **correo** a cada persona con reserva. La campana del menú avisa a quienes tienen reserva cuando un evento **se cancela** o **cambia de día/hora**.
- **Aforo**: la reserva es una transacción con `SELECT … FOR UPDATE` → no hay sobreventa (`backend/src/services/reservationService.js`).

## Requisitos

- [XAMPP](https://www.apachefriends.org) (solo el módulo **MySQL**; Apache no hace falta)
- [HeidiSQL](https://www.heidisql.com)
- [Node.js 20 o superior](https://nodejs.org)

## Puesta en marcha

### 1. Crear la base de datos (XAMPP + HeidiSQL)
1. Abrí el **Panel de control de XAMPP** y presioná **Start** en el módulo **MySQL**.
2. Abrí **HeidiSQL → Nueva sesión**: Host `127.0.0.1`, Usuario `root`, Contraseña vacía (valor por defecto de XAMPP), Puerto `3306` → **Abrir**.
3. **Archivo → Cargar archivo SQL…** y elegí `backend/sql/base_de_datos_mysql.sql`.
4. Presioná **F9** (Ejecutar). Se crea la base `telon_eventos` con todas sus tablas. Se puede ejecutar más de una vez sin problema.
5. *(Recomendado)* Al final del script hay un bloque comentado para crear el usuario `telon_app` con permisos mínimos. Cambiá la clave, quitá los `-- `, ejecutalo y usá ese usuario en el `.env`.

> **¿Ya tenías la base creada de una versión anterior?** No la borres: ejecutá en HeidiSQL, en orden, `backend/sql/migracion_v3_perfil_notificaciones.sql` (si todavía no lo hiciste) y `backend/sql/migracion_v4_dni_y_fecha_reserva.sql`. Agregan las columnas y tablas nuevas sin perder datos.

### 2. Variables de entorno
```bash
cp .env.example .env      # en Windows: copy .env.example .env
```
Abrí **`.env`** (no `.env.example`) y completá:
- `DB_USER` / `DB_PASSWORD`: `root` y vacía si usás XAMPP por defecto, o `telon_app` y su clave.
- `JWT_SECRET`: generalo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

El resto de los valores sirven tal cual para desarrollo. Usá siempre **`localhost`** (no `127.0.0.1`) en las URLs del navegador.

### 3. Instalar y ejecutar
```bash
cd backend  && npm install && npm run dev      # API en http://localhost:3000
cd frontend && npm install && npm run dev      # App en http://localhost:5173
```
Si MySQL no está iniciado, el backend lo avisa con un mensaje claro y no arranca.

### 4. Crear el administrador
```bash
cd backend && npm run create-admin
```
Te pide email, nombre y contraseña (no se muestra al escribirla; mínimo 10 caracteres con mayúscula, minúscula y número). La cuenta queda lista y con el email verificado.

También podés promover una cuenta ya registrada desde HeidiSQL:
```sql
UPDATE telon_eventos.users SET role = 'admin', email_verified_at = UTC_TIMESTAMP() WHERE email = 'tu-email@ejemplo.com';
```
Desde el panel **Administración** podés luego promover organizadores por email.

### 5. Emails en local
Sin `SMTP_HOST` en el `.env`, **no se envía ningún correo**. En su lugar:
- El contenido (incluido el **enlace de verificación**) se imprime en la consola donde corre el backend.
- Se guarda una copia `.html` en `backend/mail-outbox/` para abrirla en el navegador.

Para enviar correos reales completá `SMTP_*` (por ejemplo, una cuenta de Gmail con contraseña de aplicación o un servidor de pruebas como Mailpit).

## Scripts

| Dónde | Comando | Acción |
|---|---|---|
| backend | `npm run dev` / `npm start` | API con recarga / producción |
| backend | `npm run create-admin` | Crea o promueve al administrador |
| backend | `npm run test:unit` | Pruebas de DNI y de la política de deshabilitación (no necesitan base de datos) |
| backend | `npm run test:policy` | Pruebas de la política de deshabilitación de cuentas (no necesita base de datos) |
| backend | `npm run test:concurrency` | Prueba de concurrencia del aforo contra MySQL |
| backend / frontend | `npm run audit` | `npm audit --omit=dev` |
| frontend | `npm run build` / `npm run preview` | Build de producción / vista previa |

## Prueba de concurrencia del aforo

`backend/tests/concurrency.test.js` crea usuarios y eventos temporales (y los borra al terminar) y verifica que:
1. 25 usuarios reservando **a la vez** un evento de 5 lugares → exactamente 5 reservas y 20 rechazos `sold_out`; el cupo queda en 0.
2. Un mismo usuario con 8 reservas en paralelo → solo 2 (límite por persona).
3. Cancelar devuelve exactamente 1 lugar.
4. La base rechaza un cupo negativo o mayor al máximo (restricción `CHECK`).

Con MySQL iniciado y el `.env` listo: `cd backend && npm run test:concurrency`. Opcional: `TEST_DB_NAME=otra_base` para no usar la base principal.

## Despliegue en producción

Pensado para local, pero si lo publicás:
- **HTTPS obligatorio** (Nginx/Caddy delante, o Render/Railway). Con `NODE_ENV=production` el backend exige orígenes `https`, SMTP, hCaptcha y `DB_PASSWORD` no vacía, y marca la cookie como `Secure`.
- **Frontend y API deben compartir dominio padre** (por ejemplo `app.tudominio.com` y `api.tudominio.com`): la cookie de sesión es `SameSite=Strict` y no viajaría entre sitios distintos.
- Editá `frontend/vercel.json` (o `public/_headers`) con el dominio real de tu API en la CSP.
- Detrás de un proxy: `TRUST_PROXY=1`. Usá un usuario de MySQL con permisos mínimos (`telon_app`) y hacé copias de seguridad de la base y de `backend/uploads`.

## Checklist de seguridad

- [x] Contraseñas con bcrypt (costo 12); nunca en texto plano ni en logs
- [x] JWT de 15 min en memoria (no en `localStorage`) + refresh token rotativo en cookie HttpOnly, con detección de reutilización
- [x] Bloqueo temporal tras 5 intentos fallidos, rate limit por IP y mensajes genéricos (sin enumerar cuentas)
- [x] Verificación de email obligatoria antes de reservar; enlaces de un solo uso que vencen a las 24 h
- [x] RBAC en middlewares + autorización por dueño del evento (anti-IDOR); el rol se lee de la base en cada request
- [x] Reserva transaccional (`FOR UPDATE`) + `CHECK` de aforo en la tabla
- [x] Consultas 100 % parametrizadas (sin SQL concatenado) y validación con zod (`.strict()` contra mass-assignment)
- [x] XSS: escape por defecto de Vue, sin `v-html`, CSP estricta, emails con escape HTML
- [x] CSRF: cookie `SameSite=Strict` + verificación de `Origin` + CORS por lista blanca
- [x] Subidas: límite 2 MB, whitelist por *magic bytes*, nombre aleatorio, fuera de carpeta pública, URLs firmadas con vencimiento
- [x] Helmet (HSTS, nosniff, frame-ancestors…), límites de body, timeouts, rate limits por endpoint
- [x] hCaptcha opcional en registro, ingreso, reenvío y reserva
- [x] Máx. 2 tickets por persona y evento (dentro del bloqueo transaccional)
- [x] Tickets = UUID v4 generados con `crypto.randomUUID()` (CSPRNG)
- [x] DNI único: no sirve por sí solo para ingresar (la contraseña se exige siempre) y no se puede cambiar una vez cargado
- [x] Solo un administrador puede deshabilitar organizadores/administradores; la cuenta pierde acceso al instante
- [x] Auditoría en `audit_logs` y errores genéricos con `requestId`
- [x] Secretos solo en `.env` (ignorado por git)

> **Diferencia con la versión de Supabase:** MySQL no tiene *Row Level Security*. La autorización la aplica el backend; como defensa adicional se recomienda el usuario `telon_app` con permisos mínimos y la base **no debe exponerse a la red** (puerto 3306 solo en localhost).

Detalle y modelo de amenazas: [`docs/seguridad.md`](docs/seguridad.md).

## Política de retención de datos y derecho al olvido

**Datos que se guardan**: nombre, email, hash de contraseña, rol, reservas (con estado de asistencia), sesiones y registros de auditoría.

**Retención**
- Cuenta y reservas: mientras la cuenta exista.
- Auditoría: 12 meses. Sesiones vencidas y tokens usados: se pueden limpiar periódicamente.
- Datos de eventos finalizados: se conservan para estadísticas del organizador.

**Derecho al olvido**: borrar la fila del usuario elimina en cascada sus reservas, sesiones y tokens; en `audit_logs` y `checked_in_by` el actor queda en `NULL`, conservando el hecho sin identificar a la persona. Plazo recomendado: 30 días.

```sql
-- Derecho al olvido
DELETE FROM telon_eventos.users WHERE email = 'persona@ejemplo.com';
-- Limpieza periódica
DELETE FROM telon_eventos.audit_logs   WHERE created_at < UTC_TIMESTAMP() - INTERVAL 12 MONTH;
DELETE FROM telon_eventos.refresh_tokens WHERE expires_at < UTC_TIMESTAMP() OR revoked_at IS NOT NULL;
DELETE FROM telon_eventos.email_tokens   WHERE expires_at < UTC_TIMESTAMP() OR used_at IS NOT NULL;
```

## Flujo de desarrollo seguro

1. `npm audit` (backend y frontend) antes de cada release; actualizar dependencias y revisar los *changelogs*.
2. Nunca versionar `.env`. Si un secreto se filtra: cambiar `JWT_SECRET` (cierra todas las sesiones) y las claves afectadas.
3. Cambios en `backend/sql/` → volver a correr `npm run test:concurrency`.

## Estado de verificación

La sintaxis de todo el backend y la resolución de imports de todo el proyecto se verificaron con Node. El proyecto **no se pudo instalar ni ejecutar** en el entorno donde se generó (sin red ni MySQL), así que `npm install`, el build de Vite, el script SQL y la prueba de concurrencia quedan por correr en tu máquina. Si algo falla, pasá el mensaje de error.
