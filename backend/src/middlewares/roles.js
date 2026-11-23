// RBAC: restringe una ruta a ciertos roles. Debe ir DESPUÉS de requireAuth.
import { AppError } from '../utils/errors.js';

export const requireRole = (...allowedRoles) => (req, _res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new AppError(403, 'forbidden', 'No tenés permiso para realizar esta acción.'));
  }
  next();
};
