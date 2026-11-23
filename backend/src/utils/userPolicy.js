// Política de deshabilitación de cuentas. Es una función PURA (sin base de datos) para poder
// probarla de forma aislada (tests/userStatusPolicy.test.js).
//
// Regla de negocio:
//   · SOLO un administrador puede deshabilitar/habilitar cuentas.
//   · Solo se pueden gestionar cuentas con rol organizador o administrador.
//   · Ningún otro rol (organizador, asistente) puede hacerlo, ni siquiera sobre sí mismo.
export const MANAGEABLE_ROLES = ['organizer', 'admin'];

/**
 * @returns {null | { status: number, code: string, message: string }}  null = permitido
 */
export function checkStatusChange({ actor, target, active, activeAdminCount }) {
  if (!actor || actor.role !== 'admin') {
    return { status: 403, code: 'forbidden', message: 'Solo un administrador puede habilitar o deshabilitar cuentas.' };
  }
  if (!target) {
    return { status: 404, code: 'user_not_found', message: 'No encontramos ese usuario.' };
  }
  if (!MANAGEABLE_ROLES.includes(target.role)) {
    return { status: 400, code: 'role_not_manageable', message: 'Solo se pueden deshabilitar cuentas de organizadores y administradores.' };
  }
  if (!active && actor.id === target.id) {
    return { status: 400, code: 'cannot_disable_self', message: 'No podés deshabilitar tu propia cuenta.' };
  }
  if (Boolean(target.is_active) === Boolean(active)) {
    return { status: 409, code: 'no_change', message: active ? 'La cuenta ya está habilitada.' : 'La cuenta ya está deshabilitada.' };
  }
  // Evita quedarse sin administradores activos (nadie podría volver a gestionar el sistema).
  if (!active && target.role === 'admin' && activeAdminCount <= 1) {
    return { status: 409, code: 'last_admin', message: 'No se puede deshabilitar al único administrador activo.' };
  }
  return null;
}
