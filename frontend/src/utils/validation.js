// Validación en el cliente (UX inmediata). La validación que cuenta es la del backend.
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Usá al menos 10 caracteres.')
  .max(72, 'Máximo 72 caracteres.')
  .regex(/[a-z]/, 'Incluí una minúscula.')
  .regex(/[A-Z]/, 'Incluí una mayúscula.')
  .regex(/[0-9]/, 'Incluí un número.');

// DNI argentino: 7 u 8 números, con o sin puntos. Se envía al servidor solo con dígitos.
export const dniSchema = z.string().trim()
  .transform((v) => v.replace(/[.\s-]/g, ''))
  .refine((v) => /^[1-9]\d{6,7}$/.test(v), 'Ingresá un DNI válido: 7 u 8 números, sin puntos.');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre.').max(80, 'Máximo 80 caracteres.').regex(/^[^<>]*$/, 'No uses los símbolos < o >.'),
  dni: dniSchema,
  email: z.string().trim().toLowerCase().email('Ingresá un email válido.').max(254),
  password: passwordSchema,
});

// El identificador es el DNI o el email: la contraseña se pide siempre.
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Ingresá tu DNI o tu email.').max(254),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export const profileSchema = z.object({
  dni: z.union([z.literal(''), dniSchema]),   // vacío = no se envía; solo editable si la cuenta aún no tiene DNI
  fullName: z.string().trim().min(2, 'Ingresá tu nombre.').max(80, 'Máximo 80 caracteres.').regex(/^[^<>]*$/, 'No uses los símbolos < o >.'),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres.').regex(/^[0-9+()\-\s]*$/, 'Solo números, espacios y + - ( ).'),
  city: z.string().trim().max(80, 'Máximo 80 caracteres.'),
  bio: z.string().trim().max(300, 'Máximo 300 caracteres.'),
});

export const eventFormSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120, 'Máximo 120 caracteres.'),
  description: z.string().trim().min(10, 'Contá un poco más (mínimo 10 caracteres).').max(4000, 'Máximo 4000 caracteres.'),
  category: z.enum(['teatro', 'concierto', 'charla', 'danza', 'cine', 'otros'], { message: 'Elegí una categoría.' }),
  startsAtLocal: z.string().min(1, 'Elegí fecha y hora.'),
  location: z.string().trim().min(3, 'Indicá el lugar.').max(200, 'Máximo 200 caracteres.'),
  capacity: z.coerce.number({ message: 'Ingresá un número.' }).int('Debe ser entero.').min(1, 'Mínimo 1.').max(5000, 'Máximo 5000.'),
  status: z.enum(['draft', 'published', 'cancelled']),
});

/** Devuelve { campo: mensaje } o null si es válido. */
export function collectErrors(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, errors: null };
  const errors = {};
  for (const issue of result.error.issues) errors[issue.path[0]] ??= issue.message;
  return { data: null, errors };
}

/** Puntaje 0-4 para el medidor de fortaleza de contraseña. */
export function passwordStrength(value) {
  let score = 0;
  if (value.length >= 10) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 16) score++;
  return score;
}

export const COVER_RULES = { maxBytes: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] };
