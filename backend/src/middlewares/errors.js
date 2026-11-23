// Manejo centralizado de errores. Al cliente solo llega un código y un mensaje seguro:
// nunca stack traces, mensajes de SQL ni detalles internos. El detalle va al log.
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (_req, _res, next) =>
  next(new AppError(404, 'not_found', 'El recurso solicitado no existe.'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'internal_error';
  let message = 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'upload_error';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 2 MB.' : 'No pudimos procesar el archivo.';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'payload_too_large'; message = 'La solicitud es demasiado grande.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'invalid_json'; message = 'El cuerpo de la solicitud no es JSON válido.';
  } else if (err?.message === 'CORS_NOT_ALLOWED') {
    status = 403; code = 'cors_forbidden'; message = 'Origen no permitido.';
  }

  // 5xx → error; 4xx → warn (con el request id para correlacionar con lo que ve el usuario).
  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log({ err: { message: err.message, stack: err.stack }, requestId: req.id, path: req.path, status, userId: req.user?.id }, 'request failed');

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: req.id } });
}
