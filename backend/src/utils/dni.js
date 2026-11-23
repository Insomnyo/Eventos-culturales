// Helpers de DNI argentino. Se guarda SIEMPRE normalizado: solo dígitos, sin puntos ni espacios.
export const normalizeDni = (value) => String(value ?? '').replace(/[.\s-]/g, '');

// 7 u 8 dígitos, sin cero inicial (los DNI argentinos van de ~1.000.000 a ~99.999.999).
// OJO: valida el FORMATO, no que el número pertenezca a la persona (no hay consulta al RENAPER).
export const isValidDni = (value) => /^[1-9]\d{6,7}$/.test(normalizeDni(value));

/** "12345678" → "12.345.678" (solo para mostrar). */
export const formatDni = (value) => {
  const digits = normalizeDni(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
