# Seguridad: modelo de amenazas y mitigaciones

Referencias: OWASP Top 10 (2021) y OWASP ASVS. Activos a proteger: cuentas y datos personales (nombre, email, hash de contraseña), integridad del aforo y de los tickets, privilegios de organizador/admin y secretos (`JWT_SECRET`, credenciales de base y SMTP).

## Actores y superficie
Visitante anónimo · asistente autenticado · organizador malicioso (contra eventos ajenos) · bot/scalper (acaparar cupos) · atacante de red o de la misma máquina (acceso a MySQL) · desarrollador que filtra secretos.

## Amenazas y mitigaciones

| # | Amenaza | OWASP | Mitigación aplicada | Dónde |
|---|---|---|---|---|
| 1 | Acceso a paneles/endpoints sin permiso | A01 | RBAC (`requireRole`) + autorización por objeto (`assertCanManage`, 404 para no revelar existencia) | `middlewares/roles.js`, `services/eventService.js` |
| 2 | IDOR: tocar reservas de otro evento cambiando IDs | A01 | Las consultas filtran por `event_id` Y `reservation_id`; "mis entradas" filtra por el `user_id` del token | `attendanceService.js`, `reservationService.js` |
| 3 | Escalada de privilegios | A01/A04 | El registro siempre crea `attendee` (el rol nunca viene del cliente); el rol se lee de la base en cada request; cambios solo vía admin auditado | `authService.js`, `middlewares/auth.js` |
| 4 | Sobreventa por reservas simultáneas | A04 | Transacción + `SELECT … FOR UPDATE` + `CHECK` de aforo; test de concurrencia | `reservationService.js`, `base_de_datos_mysql.sql` |
| 5 | Un usuario acapara cupos | A04 | Máx. 2 tickets/persona dentro del bloqueo; rate limit por usuario e IP; captcha; email verificado | `reservationService.js`, `rateLimit.js` |
| 6 | Fuerza bruta / credential stuffing | A07 | Bloqueo de 15 min tras 5 fallos, rate limit por IP, captcha opcional, mensaje genérico | `authService.js`, `rateLimit.js` |
| 7 | Enumeración de cuentas | A07 | Registro y reenvío responden igual exista o no el email; login con mensaje genérico y comparación contra hash falso (tiempo similar) | `authService.js`, `utils/passwords.js` |
| 8 | Contraseñas débiles / robo de la base | A02/A07 | Política de 10+ caracteres con complejidad; hash bcrypt costo 12; tokens guardados solo como hash sha256 | `schemas.js`, `utils/passwords.js` |
| 9 | Robo o reutilización de sesión | A07 | JWT de 15 min solo en memoria; refresh en cookie HttpOnly con rotación; si un refresh revocado reaparece se cierran todas las sesiones; JWT con algoritmo, emisor y audiencia fijados; cierre por inactividad (30 min) | `tokenService.js`, `authService.js`, `useIdleLogout.js` |
| 10 | Inyección SQL | A03 | Solo consultas con placeholders `?`; las columnas dinámicas del UPDATE salen de una lista fija; `LIMIT/OFFSET` son enteros validados | `lib/db.js`, `eventService.js` |
| 11 | XSS almacenado/reflejado | A03 | Vue escapa por defecto (sin `v-html`); texto sin HTML (`stripTags`); CSP estricta; emails con `escapeHtml`; API con CSP `default-src 'none'` | `schemas.js`, `vercel.json`, `email.js`, `app.js` |
| 12 | CSRF | A01 | Cookie de refresh `HttpOnly; SameSite=Strict; path=/api/auth`; verificación explícita de `Origin` en `/auth/refresh` y `/auth/logout`; CORS por lista blanca; el resto de la API usa `Authorization: Bearer` (el navegador no lo adjunta solo) | `authController.js`, `trustedOrigin.js`, `app.js` |
| 13 | Subida de archivos maliciosos | A04/A05 | Límite 2 MB, `files:1`, whitelist por *magic bytes*, nombre UUID generado por el servidor, almacenamiento fuera de carpeta pública, entrega solo con URL firmada y con vencimiento (HMAC), nombre validado contra whitelist (sin path traversal) | `upload.js`, `storageService.js`, `media.js`, `mediaController.js` |
| 14 | Mass assignment | A04 | Schemas zod `.strict()`; `organizer_id` lo asigna el servidor | `schemas.js` |
| 15 | Denegación de servicio | A05 | Rate limit global y por endpoint, límite de body 20 kB, timeouts HTTP, paginación acotada, pool de conexiones limitado | `app.js`, `server.js`, `db.js` |
| 16 | Mala configuración / cabeceras | A05 | Helmet (HSTS, nosniff, frame-ancestors, referrer), CORS por lista blanca, `x-powered-by` off, fail-fast de configuración (incluido `JWT_SECRET` de ejemplo) | `app.js`, `env.js` |
| 17 | Filtración de secretos | A02/A05 | Todo en `.env` (en `.gitignore`); Vite solo expone `VITE_*`; logs con credenciales redactadas | `.env.example`, `logger.js` |
| 18 | Fuga de información en errores | A05 | `errorHandler` devuelve código + mensaje genérico + `requestId`; el stack va solo al log | `middlewares/errors.js` |
| 19 | Falta de trazabilidad | A09 | `audit_logs` (registro, login, fallos, eventos, reservas, check-in, roles) con actor, IP y fecha | `auditService.js` |
| 20 | Dependencias vulnerables | A06 | Versiones actuales con `^`; `npm run audit` en el flujo de release | README |
| 21 | Falsificación de tickets | A02 | `ticket_code` UUID v4 con `crypto.randomUUID()` (122 bits); consulta solo para dueño del evento/admin; el check-in impide reutilizarlo | `reservationService.js`, `attendanceService.js` |
| 22 | Open redirect tras login | A01 | `safeRedirect` acepta solo rutas internas | `router/index.js` |
| 23 | Acceso directo a MySQL | A05 | Puerto 3306 solo en localhost; usuario `telon_app` con permisos mínimos (sin DROP/ALTER); contraseña obligatoria en producción | `base_de_datos_mysql.sql`, `env.js` |
| 24 | Transporte inseguro | A02 | HTTPS obligatorio en producción (cookie `Secure`, HSTS, orígenes `https` exigidos al arrancar) | `env.js`, README |
| 25 | Un organizador o asistente deshabilita cuentas | A01 | Ruta con `requireRole('admin')` **y** política `checkStatusChange` en el servicio (doble capa); solo organizadores/administradores son gestionables; no se puede deshabilitar a uno mismo ni al último admin activo (bloqueo de filas para evitar carreras); test sin base de datos | `routes/index.js`, `utils/userPolicy.js`, `adminService.js`, `tests/userStatusPolicy.test.js` |
| 26 | Cuenta deshabilitada que sigue usando su sesión | A07 | Al deshabilitar se revocan los refresh tokens; `requireAuth` consulta `is_active` en cada petición (un access token vigente deja de servir al instante); login y refresh la rechazan | `adminService.js`, `middlewares/auth.js`, `authService.js` |
| 27 | Editar el perfil de otra persona o escalar privilegios desde el perfil | A01/A04 | `PATCH /me` usa el id del token (nunca de la URL o el body); schema `.strict()` rechaza `email`, `role`, `id`; columnas editables desde una lista fija | `schemas.js`, `profileService.js` |
| 28 | Leer o marcar notificaciones ajenas | A01 | Todas las consultas filtran por el `user_id` del token; marcar un aviso ajeno responde 404 | `notificationService.js` |
| 29 | XSS vía título de evento en notificaciones | A03 | El título se guarda ya sin etiquetas y se muestra siempre con interpolación escapada de Vue | `schemas.js`, `NotificationBell.vue` |
| 30 | Tomar una cuenta sabiendo el DNI | A07 | El DNI **no es un secreto** (figura en la entrada): solo identifica la cuenta, la **contraseña se exige siempre**; el login por DNI y por email comparten bloqueo, límites y mensaje genérico | `authService.js`, `schemas.js` |
| 31 | Enumerar DNI/emails registrados | A07 | Registro con email o DNI existente responde igual (202) y no crea nada; login con DNI inexistente = mismo 401 genérico y mismo costo de CPU; al completar el DNI desde el perfil el error no confirma de quién es | `authService.js`, `profileService.js` |
| 32 | Cambiar el DNI para suplantar a otra persona | A01 | Solo se puede completar una vez (cuentas antiguas); después `409 dni_locked` y solo un administrador puede corregirlo (SQL); índice único en la base | `profileService.js`, `base_de_datos_mysql.sql` |
| 33 | Check-in fraudulento por DNI en la puerta | A04 | Solo organizador del evento/admin; marca **una** entrada pendiente por vez (no entra un acompañante sin reserva); bloqueo de filas ante dos escaneos simultáneos; la respuesta muestra el nombre para compararlo con el documento físico; queda auditado (`via: dni`) | `attendanceService.js` |
| 34 | Exposición de datos personales (DNI) | A02 | El DNI solo lo ve su titular (perfil, entrada, correo) y el organizador del evento/admin en la lista de inscriptos; no se registra en logs ni en auditoría; no se envía a terceros | `attendanceService.js`, `auditService.js` |
| 35 | Correos masivos que bloquean o filtran datos | A04/A09 | Se envían después del commit, de a 5 por vez, sin bloquear la respuesta; nombre y título escapados en HTML; un fallo de correo no revierte el cambio | `utils/email.js`, `eventService.js` |

## Riesgos residuales y recomendaciones
- **MySQL no tiene Row Level Security**: la autorización depende del código del backend. Mitigado con revisión de permisos en cada servicio, usuario de base con privilegios mínimos y pruebas de autorización recomendadas ante cada cambio.
- **XAMPP por defecto**: `root` sin contraseña. Aceptable solo en una máquina de desarrollo; para cualquier otro uso, asigná contraseña a `root` y usá `telon_app`.
- **Rate limit en memoria**: con varias instancias del backend, usar un store compartido (Redis).
- **Correo en local**: sin SMTP los enlaces se imprimen en la consola; esa consola contiene datos sensibles, no la compartas.
- **El DNI no está verificado**: el sistema valida el formato, no que el número pertenezca a quien lo escribe (no consulta ningún registro oficial). Alguien podría registrarse con un DNI ajeno. Por eso en la puerta siempre hay que pedir el documento y comparar el nombre.
- **Bloqueo de cuenta por terceros**: quien conozca tu DNI puede intentar ingresar con contraseñas erróneas y bloquear la cuenta 15 minutos (5 fallos). No permite entrar, pero molesta. En producción se mitiga con hCaptcha y los límites por IP.
- **Datos personales**: el DNI es un dato personal (en Argentina rige la Ley 25.326 de protección de datos personales). Si publicás el sistema, agregá un aviso de privacidad que explique para qué se usa y cómo pedir su supresión.
- **Cuentas de asistentes**: la función de deshabilitar cubre solo organizadores y administradores, como se pidió; un asistente abusivo no se puede bloquear desde la interfaz.
- **Eventos de un organizador deshabilitado**: se conservan publicados; un administrador puede editarlos o cancelarlos.
- **Cambio de email y de contraseña desde el perfil**: no incluidos (requieren reverificación del email y de la contraseña actual).
- **Recuperación de contraseña y 2FA**: no incluidas; recomendadas si crece el uso.
- **Re-encode de imágenes**: no se recomprimen; se puede agregar `sharp` para eliminar metadatos EXIF.
- **Borrar un evento con inscriptos**: elimina las reservas en cascada; preferir "Cancelado" y avisar a los inscriptos.
- **Revisión periódica**: `npm audit`, rotación de secretos y revisión de permisos de la base.
