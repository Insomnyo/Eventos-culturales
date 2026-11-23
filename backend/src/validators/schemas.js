// Schemas de validación (zod). Todo input externo pasa por acá antes de tocar la lógica de negocio.
import { z } from 'zod';
import { isValidDni, normalizeDni } from '../utils/dni.js';

export const CATEGORIES = ['teatro', 'concierto', 'charla', 'danza', 'cine', 'otros'];

// Sanitización de texto (defensa en profundidad; la defensa principal contra XSS es que
// el frontend escapa todo al renderizar y que la CSP bloquea scripts inline):
//  - elimina caracteres de control (salvo salto de línea/tab en textos largos)
//  - elimina etiquetas HTML
const stripControl = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const stripTags = (s) => s.replace(/<[^>]*>/g, '');
const cleanLine = (min, max) =>
  z.string().trim().min(min).max(max).transform((s) => stripTags(stripControl(s)).replace(/\s+/g, ' ').trim());
const cleanBlock = (min, max) =>
  z.string().trim().min(min).max(max).transform((s) => stripTags(stripControl(s)).trim());

export const uuidParam = z.object({ id: z.string().uuid() }).strict();
export const eventAndReservationParams = z.object({ id: z.string().uuid(), reservationId: z.string().uuid() }).strict();
export const ticketParam = z.object({ code: z.string().uuid() }).strict();

const eventShape = {
  title: cleanLine(3, 120),
  description: cleanBlock(10, 4000),
  category: z.enum(CATEGORIES),
  starts_at: z.string().datetime({ offset: true }),
  location: cleanLine(3, 200),
  capacity: z.number().int().min(1).max(5000),
};

export const eventCreateSchema = z
  .object({
    ...eventShape,
    starts_at: eventShape.starts_at.refine((d) => new Date(d) > new Date(), 'La fecha debe ser futura.'),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .strict(); // .strict(): rechaza campos desconocidos (evita mass assignment: organizer_id, available_spots...)

export const eventUpdateSchema = z
  .object({ ...eventShape, status: z.enum(['draft', 'published', 'cancelled']) })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'No hay cambios para guardar.');

export const eventListQuery = z
  .object({
    category: z.enum(CATEGORIES).optional(),
    q: z.string().trim().max(80).transform((s) => s.replace(/[%_\\,()]/g, ' ').trim()).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
  })
  .strict();

export const reserveBody = z.object({ captchaToken: z.string().min(1).max(4096).optional() }).strict();

export const attendanceBody = z.object({ attendance_status: z.enum(['pending', 'attended', 'no_show']) }).strict();

// ---- Autenticación ----
const password = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.') // bcrypt solo usa los primeros 72 bytes
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula.')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir un número.');
const email = z.string().trim().toLowerCase().email('Email inválido.').max(254);
const captchaToken = z.string().min(1).max(4096).optional();

export const passwordRule = password;

// DNI: se acepta con o sin puntos ("12.345.678") y se guarda solo con dígitos.
export const dniField = z.string().trim().max(15)
  .refine(isValidDni, 'Ingresá un DNI válido: 7 u 8 números, sin puntos.')
  .transform(normalizeDni);

export const registerBody = z.object({ fullName: cleanLine(2, 80), dni: dniField, email, password, captchaToken }).strict();
// `identifier` es el email O el DNI de la persona; la contraseña se exige siempre.
export const loginBody = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(72), captchaToken }).strict();
export const verifyEmailBody = z.object({ token: z.string().min(20).max(200) }).strict();
export const resendBody = z.object({ email, captchaToken }).strict();

// ---- Perfil del propio usuario (el email y el rol NO se pueden editar desde acá) ----
const optionalText = (max, minLength = 0) =>
  z.string().trim().max(max)
    .transform((v) => stripTags(stripControl(v)).replace(/\s+/g, ' ').trim())
    .refine((v) => v === '' || v.length >= minLength, `Mínimo ${minLength} caracteres.`)
    .transform((v) => (v === '' ? null : v));

export const profileUpdateBody = z
  .object({
    fullName: cleanLine(2, 80),
    dni: dniField,   // solo se puede completar UNA vez (cuentas antiguas); después queda bloqueado
    phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, 'El teléfono solo puede tener números, espacios y + - ( ).')
      .transform((v) => (v === '' ? null : v)),
    city: optionalText(80),
    bio: optionalText(300),
  })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'No hay cambios para guardar.');

// ---- Administración de cuentas ----
export const userStatusBody = z
  .object({ active: z.boolean(), reason: optionalText(200).optional() })
  .strict();

// ---- Notificaciones ----
// Check-in en la puerta por DNI (organizador)
export const dniCheckInBody = z.object({ dni: dniField }).strict();

export const notificationsQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();

export const roleChangeBody = z
  .object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(['attendee', 'organizer', 'admin']) })
  .strict();
