import path from 'node:path';
import { AppError } from '../utils/errors.js';
import { isValidCoverSignature } from '../utils/media.js';
import { coversDir } from '../services/storageService.js';

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Sirve una portada solo si la URL está firmada y no venció. */
export function serveCover(req, res, next) {
  const { file } = req.params;
  const { exp, sig } = req.query;
  if (!isValidCoverSignature(file, exp, sig)) return next(new AppError(403, 'invalid_signature', 'El enlace de la imagen no es válido o venció.'));

  res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file)]);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');   // el frontend (otro puerto/dominio) muestra la imagen en <img>
  res.setHeader('Cache-Control', 'private, max-age=600');
  // `file` ya pasó una whitelist estricta (UUID + extensión): no hay path traversal posible.
  res.sendFile(path.join(coversDir(), file), { dotfiles: 'deny' }, (err) => {
    if (err) next(new AppError(404, 'not_found', 'La imagen no existe.'));
  });
}
