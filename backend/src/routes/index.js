// Mapa de rutas. Orden de middlewares en cada ruta protegida:
//   rate limit → autenticación → rol (RBAC) → validación → controlador
// La autorización a nivel de OBJETO (¿es el dueño de este evento?) se hace en los servicios.
import { Router } from 'express';
import { requireAuth, optionalAuth, requireVerifiedEmail } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';
import { validate } from '../middlewares/validate.js';
import { verifyCaptcha } from '../middlewares/captcha.js';
import { uploadCover as uploadCoverMiddleware } from '../middlewares/upload.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  reserveUserLimiter, reserveIpLimiter, writeLimiter, uploadLimiter,
  loginLimiter, registerLimiter, emailLimiter, refreshLimiter,
} from '../middlewares/rateLimit.js';
import * as S from '../validators/schemas.js';
import * as events from '../controllers/eventController.js';
import * as reservations from '../controllers/reservationController.js';
import * as attendance from '../controllers/attendanceController.js';
import * as users from '../controllers/userController.js';
import * as auth from '../controllers/authController.js';
import * as notifications from '../controllers/notificationController.js';
import { serveCover } from '../controllers/mediaController.js';

const router = Router();
const organizerOrAdmin = requireRole('organizer', 'admin');

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---- Autenticación (cuentas propias: bcrypt + JWT de vida corta + refresh token en cookie HttpOnly) ----
router.post('/auth/register', registerLimiter, validate(S.registerBody), verifyCaptcha, auth.register);
router.post('/auth/login', loginLimiter, validate(S.loginBody), verifyCaptcha, auth.login);
router.post('/auth/refresh', refreshLimiter, requireTrustedOrigin, auth.refresh);
router.post('/auth/logout', requireTrustedOrigin, auth.logout);
router.post('/auth/verify-email', emailLimiter, validate(S.verifyEmailBody), auth.verifyEmail);
router.post('/auth/resend-verification', emailLimiter, validate(S.resendBody), verifyCaptcha, auth.resendVerification);

// ---- Imágenes (URL firmada con vencimiento; sin autenticación porque se usan en <img>) ----
router.get('/media/covers/:file', serveCover);

// ---- Público ----
router.get('/events', validate(S.eventListQuery, 'query'), events.listEvents);
router.get('/events/:id', optionalAuth, validate(S.uuidParam, 'params'), events.getEvent);

// ---- Usuario autenticado ----
router.get('/me', requireAuth, users.me);
router.patch('/me', requireAuth, writeLimiter, validate(S.profileUpdateBody), users.updateMe);   // solo el propio perfil: el id sale del token
router.get('/me/reservations', requireAuth, reservations.myReservations);

// ---- Notificaciones (siempre las del propio usuario) ----
router.get('/notifications', requireAuth, validate(S.notificationsQuery, 'query'), notifications.list);
router.get('/notifications/unread-count', requireAuth, notifications.unreadCount);
router.post('/notifications/read-all', requireAuth, writeLimiter, notifications.markAllRead);
router.post('/notifications/:id/read', requireAuth, writeLimiter, validate(S.uuidParam, 'params'), notifications.markRead);

// Reserva: rate limit por IP y por usuario → auth → email verificado → validación → captcha → RPC transaccional.
router.post(
  '/events/:id/reservations',
  reserveIpLimiter, requireAuth, reserveUserLimiter, requireVerifiedEmail,
  validate(S.uuidParam, 'params'), validate(S.reserveBody, 'body'), verifyCaptcha,
  reservations.reserve,
);
router.delete('/reservations/:id', requireAuth, writeLimiter, validate(S.uuidParam, 'params'), reservations.cancel);

// ---- Organizador (y admin) ----
router.get('/organizer/events', requireAuth, organizerOrAdmin, events.listMyManagedEvents);
router.post('/events', requireAuth, organizerOrAdmin, writeLimiter, validate(S.eventCreateSchema), events.createEvent);
router.put('/events/:id', requireAuth, organizerOrAdmin, writeLimiter, validate(S.uuidParam, 'params'), validate(S.eventUpdateSchema), events.updateEvent);
router.delete('/events/:id', requireAuth, organizerOrAdmin, writeLimiter, validate(S.uuidParam, 'params'), events.deleteEvent);
router.post('/events/:id/cover', requireAuth, organizerOrAdmin, uploadLimiter, validate(S.uuidParam, 'params'), uploadCoverMiddleware, events.uploadCover);

router.get('/events/:id/attendees', requireAuth, organizerOrAdmin, validate(S.uuidParam, 'params'), attendance.listAttendees);
router.patch(
  '/events/:id/attendees/:reservationId',
  requireAuth, organizerOrAdmin, writeLimiter,
  validate(S.eventAndReservationParams, 'params'), validate(S.attendanceBody), attendance.setAttendance,
);
router.post('/events/:id/check-in/dni', requireAuth, organizerOrAdmin, writeLimiter, validate(S.uuidParam, 'params'), validate(S.dniCheckInBody), attendance.checkInByDni);
router.get('/tickets/:code', requireAuth, organizerOrAdmin, validate(S.ticketParam, 'params'), attendance.lookupTicket);
router.post('/tickets/:code/check-in', requireAuth, organizerOrAdmin, writeLimiter, validate(S.ticketParam, 'params'), attendance.checkInByTicket);

// ---- Admin ----
router.patch('/admin/roles', requireAuth, requireRole('admin'), writeLimiter, validate(S.roleChangeBody), users.updateRole);
// Habilitar/deshabilitar organizadores y administradores: SOLO administradores (ruta + política en el servicio).
router.get('/admin/users', requireAuth, requireRole('admin'), users.listUsers);
router.patch('/admin/users/:id/status', requireAuth, requireRole('admin'), writeLimiter, validate(S.uuidParam, 'params'), validate(S.userStatusBody), users.updateStatus);

export default router;
