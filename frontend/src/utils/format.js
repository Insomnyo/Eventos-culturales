// Formateo de fechas/textos. Se usa Intl con zona horaria de Argentina por defecto.
const TZ = 'America/Argentina/Buenos_Aires';

export const formatDateLong = (iso) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const formatDay = (iso) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', timeZone: TZ }).format(new Date(iso));
export const formatMonthShort = (iso) =>
  new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: TZ }).format(new Date(iso)).replace('.', '');
export const formatTime = (iso) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

/** ISO → valor para <input type="datetime-local"> (hora local del navegador). */
export function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const CATEGORY_LABELS = {
  teatro: 'Teatro', concierto: 'Música sinfónica', charla: 'Charlas', danza: 'Danza', cine: 'Cine', otros: 'Otros',
};
export const shortTicket = (code) => String(code).slice(0, 8).toUpperCase();

/** "sáb 20 dic, 21:00 h" */
export const formatDateShort = (iso) =>
  `${new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso)).replace(/\./g, '')} h`;

export const formatDateOnly = (iso) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso));

/** "hace 5 min", "hace 2 h", "ayer"… */
export function formatRelative(iso) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'justo ahora';
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return 'justo ahora';
}

export const ROLE_LABELS = { attendee: 'Asistente', organizer: 'Organizador', admin: 'Administrador' };

/** "12345678" → "12.345.678" (solo para mostrar). */
export const formatDni = (value) => String(value ?? '').replace(/[.\s-]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
