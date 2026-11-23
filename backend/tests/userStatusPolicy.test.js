// Pruebas de la política de deshabilitación de cuentas. NO necesitan base de datos:
//   cd backend && node --test tests/userStatusPolicy.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStatusChange } from '../src/utils/userPolicy.js';

const admin = { id: 'a1', role: 'admin' };
const otherAdmin = { id: 'a2', role: 'admin', is_active: 1 };
const organizer = { id: 'o1', role: 'organizer', is_active: 1 };
const attendee = { id: 't1', role: 'attendee', is_active: 1 };

test('un administrador puede deshabilitar a un organizador', () => {
  assert.equal(checkStatusChange({ actor: admin, target: organizer, active: false, activeAdminCount: 2 }), null);
});

test('un administrador puede deshabilitar a OTRO administrador', () => {
  assert.equal(checkStatusChange({ actor: admin, target: otherAdmin, active: false, activeAdminCount: 2 }), null);
});

test('un organizador NO puede deshabilitar a nadie (ni a otro organizador ni a un admin)', () => {
  for (const target of [{ ...organizer, id: 'o2' }, otherAdmin]) {
    const result = checkStatusChange({ actor: organizer, target, active: false, activeAdminCount: 2 });
    assert.equal(result?.status, 403);
    assert.equal(result?.code, 'forbidden');
  }
});

test('un asistente NO puede deshabilitar a nadie', () => {
  assert.equal(checkStatusChange({ actor: attendee, target: organizer, active: false, activeAdminCount: 2 })?.status, 403);
});

test('sin actor (no autenticado) se rechaza', () => {
  assert.equal(checkStatusChange({ actor: null, target: organizer, active: false, activeAdminCount: 2 })?.status, 403);
});

test('solo se gestionan organizadores y administradores: un asistente como objetivo se rechaza', () => {
  assert.equal(checkStatusChange({ actor: admin, target: attendee, active: false, activeAdminCount: 2 })?.code, 'role_not_manageable');
});

test('un administrador no puede deshabilitarse a sí mismo', () => {
  const self = { ...admin, is_active: 1 };
  assert.equal(checkStatusChange({ actor: admin, target: self, active: false, activeAdminCount: 2 })?.code, 'cannot_disable_self');
});

test('no se puede deshabilitar al único administrador activo', () => {
  assert.equal(checkStatusChange({ actor: admin, target: otherAdmin, active: false, activeAdminCount: 1 })?.code, 'last_admin');
});

test('habilitar una cuenta deshabilitada está permitido; repetir el mismo estado se informa', () => {
  const disabled = { ...organizer, is_active: 0 };
  assert.equal(checkStatusChange({ actor: admin, target: disabled, active: true, activeAdminCount: 1 }), null);
  assert.equal(checkStatusChange({ actor: admin, target: organizer, active: true, activeAdminCount: 1 })?.code, 'no_change');
  assert.equal(checkStatusChange({ actor: admin, target: disabled, active: false, activeAdminCount: 2 })?.code, 'no_change');
});

test('un usuario inexistente responde 404', () => {
  assert.equal(checkStatusChange({ actor: admin, target: undefined, active: false, activeAdminCount: 2 })?.status, 404);
});
