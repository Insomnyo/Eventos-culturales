import { env } from '../config/env.js';
import { asyncHandler } from '../utils/errors.js';
import * as authService from '../services/authService.js';

const COOKIE_NAME = 'telon_refresh';

// Cookie del refresh token: HttpOnly (JavaScript no puede leerla → un XSS no la roba),
// SameSite=Strict (el navegador no la envía desde otros sitios → anti-CSRF), Secure en producción,
// y limitada a /api/auth (no viaja en el resto de las peticiones).
const cookieOptions = (expires) => ({
  httpOnly: true, secure: env.isProduction, sameSite: 'strict', path: '/api/auth', expires,
});
const setRefreshCookie = (res, refresh) => res.cookie(COOKIE_NAME, refresh.token, cookieOptions(refresh.expiresAt));
const clearRefreshCookie = (res) => res.clearCookie(COOKIE_NAME, { ...cookieOptions(), expires: undefined });

const sessionBody = ({ accessToken, profile }) => ({ accessToken, expiresInSeconds: env.ACCESS_TOKEN_TTL_MIN * 60, profile });

export const register = asyncHandler(async (req, res) => {
  await authService.register({ ...req.valid.body, ip: req.ip });
  // Respuesta idéntica exista o no el email (no revela qué cuentas existen).
  res.status(202).json({ message: 'Si el email es válido, te enviamos un enlace para verificar tu cuenta.' });
});

export const login = asyncHandler(async (req, res) => {
  const session = await authService.login({ ...req.valid.body, ip: req.ip });
  setRefreshCookie(res, session.refresh);
  res.json(sessionBody(session));
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refreshSession(req.cookies?.[COOKIE_NAME]);
    setRefreshCookie(res, session.refresh);
    res.json(sessionBody(session));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[COOKIE_NAME]);
  clearRefreshCookie(res);
  res.status(204).end();
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.valid.body.token);
  res.json({ message: 'Email verificado.' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.valid.body.email);
  res.status(202).json({ message: 'Si la cuenta existe y falta verificarla, te enviamos un nuevo enlace.' });
});
