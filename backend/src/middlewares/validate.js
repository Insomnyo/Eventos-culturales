// Valida body/query/params con zod. Los datos ya limpios quedan en req.valid.*
// Los controladores usan SOLO req.valid (nunca req.body crudo).
import { AppError } from '../utils/errors.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'validation_error', 'Revisá los datos ingresados.', fields));
  }
  req.valid = { ...(req.valid ?? {}), [source]: result.data };
  next();
};
