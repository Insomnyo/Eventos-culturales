import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const ISSUER = 'telon-api';
const AUDIENCE = 'telon-web';

/** Access token: vida corta (15 min por defecto). Solo lleva el id; el rol se lee de la base en cada request. */
export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`, issuer: ISSUER, audience: AUDIENCE,
  });
}

export function verifyAccessToken(token) {
  try {
    // Se fija el algoritmo permitido (evita ataques de "alg: none" o confusión de algoritmos).
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError(401, 'token_expired', 'Tu sesión expiró.');
    throw new AppError(401, 'invalid_token', 'Sesión inválida. Volvé a iniciar sesión.');
  }
}
