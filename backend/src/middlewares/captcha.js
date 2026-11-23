// Verificación server-side de hCaptcha. El token lo genera el widget en el navegador;
// solo el backend, con HCAPTCHA_SECRET, puede comprobar que es válido.
import { env } from '../config/env.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const verifyCaptcha = asyncHandler(async (req, _res, next) => {
  // Solo en desarrollo se permite omitirlo si no hay secret configurado. En producción env.js exige el secret.
  if (!env.HCAPTCHA_SECRET) {
    if (env.isProduction) throw new AppError(500, 'captcha_misconfigured', 'Error de configuración.');
    return next();
  }
  const token = req.valid?.body?.captchaToken;
  if (!token) throw new AppError(400, 'captcha_required', 'Completá la verificación anti-bots.');

  let verdict;
  try {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.HCAPTCHA_SECRET, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(5000),
    });
    verdict = await response.json();
  } catch (err) {
    logger.error({ err: err.message }, 'No se pudo contactar a hCaptcha');
    throw new AppError(503, 'captcha_unavailable', 'No pudimos verificar el anti-bots. Probá de nuevo.');
  }
  if (!verdict.success) throw new AppError(400, 'captcha_failed', 'La verificación anti-bots falló. Probá de nuevo.');
  next();
});
