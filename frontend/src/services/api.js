// Cliente HTTP del backend.
//  · El access token (JWT, 15 min) vive SOLO en memoria: no se guarda en localStorage, así un XSS no puede robarlo.
//  · La sesión persiste gracias a una cookie HttpOnly con el refresh token que maneja el servidor.
//  · Ante un 401 por token vencido se renueva la sesión UNA vez y se reintenta la petición.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken = null;
let refreshPromise = null;
let onSessionLost = () => {};
export const setSessionLostHandler = (handler) => { onSessionLost = handler; };

async function send(path, { method = 'GET', body, form, withCookie = false, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`${API_URL}${path}`, {
      method, headers,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      credentials: withCookie ? 'include' : 'omit',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(0, 'network', 'No pudimos conectarnos al servidor. ¿Está iniciado el backend?');
  }
}

async function parse(response) {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload?.error ?? {};
    throw new ApiError(response.status, err.code ?? 'error', err.message ?? 'Ocurrió un error inesperado.', err.details);
  }
  return payload;
}

/** Renueva el access token con la cookie de refresh. Devuelve la sesión o null. Una sola renovación a la vez. */
export function refreshSession() {
  refreshPromise ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST', withCookie: true });
      if (!response.ok) { accessToken = null; return null; }
      const session = await response.json();
      accessToken = session.accessToken;
      return session;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path, { auth = true, ...options } = {}) {
  let response = await send(path, { ...options, token: auth ? accessToken : undefined });

  // Cuenta deshabilitada por un administrador: se cierra la sesión local de inmediato.
  if (response.status === 403 && auth && accessToken) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error?.code === 'account_disabled') { accessToken = null; onSessionLost(); }
  }

  if (response.status === 401 && auth) {
    const session = await refreshSession();
    if (session) {
      response = await send(path, { ...options, token: accessToken });
    } else {
      onSessionLost();    // la sesión terminó: el store limpia el estado y el router redirige
    }
  }
  return parse(response);
}

async function startSession(path, body) {
  const session = await parse(await send(path, { method: 'POST', body, withCookie: true }));
  accessToken = session.accessToken;
  return session;
}

export const api = {
  // ---- Autenticación ----
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data) => startSession('/auth/login', data),
  logout: async () => {
    try { await parse(await send('/auth/logout', { method: 'POST', withCookie: true })); } catch { /* ya sin sesión */ }
    accessToken = null;
  },
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token }, auth: false }),
  resendVerification: (email, captchaToken) =>
    request('/auth/resend-verification', { method: 'POST', body: captchaToken ? { email, captchaToken } : { email }, auth: false }),
  me: () => request('/me'),
  updateProfile: (data) => request('/me', { method: 'PATCH', body: data }),

  // ---- Eventos ----
  listEvents: (params = {}) => request(`/events?${new URLSearchParams(params)}`, { auth: false }),
  getEvent: (id) => request(`/events/${id}`),
  myReservations: () => request('/me/reservations'),
  reserve: (eventId, captchaToken) => request(`/events/${eventId}/reservations`, { method: 'POST', body: captchaToken ? { captchaToken } : {} }),
  cancelReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),

  organizerEvents: () => request('/organizer/events'),
  createEvent: (data) => request('/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: data }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  uploadCover: (id, file) => {
    const form = new FormData();
    form.append('cover', file);
    return request(`/events/${id}/cover`, { method: 'POST', form });
  },
  checkInByDni: (eventId, dni) => request(`/events/${eventId}/check-in/dni`, { method: 'POST', body: { dni } }),
  attendees: (eventId) => request(`/events/${eventId}/attendees`),
  setAttendance: (eventId, reservationId, attendance_status) =>
    request(`/events/${eventId}/attendees/${reservationId}`, { method: 'PATCH', body: { attendance_status } }),
  checkInByTicket: (code) => request(`/tickets/${code}/check-in`, { method: 'POST' }),

  changeRole: (email, role) => request('/admin/roles', { method: 'PATCH', body: { email, role } }),
  adminUsers: () => request('/admin/users'),
  setUserStatus: (id, active, reason) =>
    request(`/admin/users/${id}/status`, { method: 'PATCH', body: reason ? { active, reason } : { active } }),

  // ---- Notificaciones ----
  notifications: (limit = 20) => request(`/notifications?limit=${limit}`),
  unreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
};
