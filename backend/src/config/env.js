// Carga y VALIDA las variables de entorno al arrancar (fail-fast): si falta algo crítico,
// el proceso no inicia y el mensaje dice qué variable revisar.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');
dotenv.config({ path: path.resolve(backendRoot, '../.env') }); // .env en la raíz del proyecto
dotenv.config({ path: path.resolve(backendRoot, '.env') });    // o backend/.env (no pisa lo ya cargado)

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().optional().default(''),
  DB_NAME: z.string().min(1).default('telon_eventos'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(120).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(7),

  FRONTEND_ORIGIN: z.string().min(1),
  FRONTEND_URL: z.string().url().optional(),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  MAX_TICKETS_PER_USER: z.coerce.number().int().min(1).max(10).default(2),
  EVENT_TIMEZONE: z.string().default('America/Argentina/Buenos_Aires'),
  UPLOADS_DIR: z.string().default('./uploads'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Telón <entradas@localhost>'),

  HCAPTCHA_SECRET: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Solo se muestran NOMBRES de variables inválidas, nunca sus valores.
  const names = parsed.error.issues.map((i) => `${i.path.join('.')} (${i.message})`).join('; ');
  console.error(`[config] Variables de entorno inválidas o ausentes: ${names}`);
  console.error('[config] Revisá que exista el archivo ".env" (copia de ".env.example") en la raíz del proyecto.');
  process.exit(1);
}

const raw = parsed.data;
if (/CAMBIAR/i.test(raw.JWT_SECRET)) {
  console.error('[config] JWT_SECRET sigue con el valor de ejemplo. Generá uno con:');
  console.error('         node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const allowedOrigins = raw.FRONTEND_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  allowedOrigins,
  FRONTEND_URL: (raw.FRONTEND_URL ?? allowedOrigins[0]).replace(/\/$/, ''),
  PUBLIC_API_URL: raw.PUBLIC_API_URL.replace(/\/$/, ''),
  uploadsDir: path.resolve(backendRoot, raw.UPLOADS_DIR),
  backendRoot,
};

if (env.isProduction) {
  const problems = [];
  if (env.allowedOrigins.some((o) => !o.startsWith('https://'))) problems.push('FRONTEND_ORIGIN debe ser https en producción');
  if (!env.SMTP_HOST) problems.push('SMTP_HOST es obligatorio en producción');
  if (!env.HCAPTCHA_SECRET) problems.push('HCAPTCHA_SECRET es obligatoria en producción');
  if (!env.DB_PASSWORD) problems.push('DB_PASSWORD no puede estar vacía en producción');
  if (problems.length) {
    console.error(`[config] ${problems.join('; ')}`);
    process.exit(1);
  }
}
