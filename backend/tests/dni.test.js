// Pruebas del manejo de DNI (sin base de datos):  cd backend && node --test tests/dni.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDni, isValidDni, normalizeDni } from '../src/utils/dni.js';
import { dniField, loginBody, registerBody } from '../src/validators/schemas.js';

test('normaliza puntos, espacios y guiones', () => {
  assert.equal(normalizeDni('12.345.678'), '12345678');
  assert.equal(normalizeDni(' 12 345 678 '), '12345678');
  assert.equal(normalizeDni('12-345-678'), '12345678');
});

test('acepta DNI de 7 y 8 dígitos y rechaza el resto', () => {
  for (const ok of ['1234567', '12345678', '12.345.678', '99999999']) assert.equal(isValidDni(ok), true, ok);
  for (const bad of ['', '123456', '123456789', '01234567', '1234567a', 'abcdefgh', '12 34', null, undefined]) assert.equal(isValidDni(bad), false, String(bad));
});

test('formatea para mostrar', () => {
  assert.equal(formatDni('12345678'), '12.345.678');
  assert.equal(formatDni('1234567'), '1.234.567');
});

test('el schema devuelve el DNI normalizado (solo dígitos)', () => {
  assert.equal(dniField.parse('12.345.678'), '12345678');
  assert.throws(() => dniField.parse('12.345'));
});

test('el registro exige DNI y rechaza campos extra', () => {
  const base = { fullName: 'Ana Pérez', email: 'ana@example.com', password: 'ClaveSegura123' };
  assert.equal(registerBody.safeParse(base).success, false, 'sin DNI debe fallar');
  const ok = registerBody.safeParse({ ...base, dni: '12.345.678' });
  assert.equal(ok.success, true);
  assert.equal(ok.data.dni, '12345678');
  assert.equal(registerBody.safeParse({ ...base, dni: '12345678', role: 'admin' }).success, false, 'no se acepta "role"');
});

test('el login acepta email o DNI como identificador, siempre con contraseña', () => {
  assert.equal(loginBody.safeParse({ identifier: 'ana@example.com', password: 'x' }).success, true);
  assert.equal(loginBody.safeParse({ identifier: '12.345.678', password: 'x' }).success, true);
  assert.equal(loginBody.safeParse({ identifier: '12345678' }).success, false, 'sin contraseña no entra');
});
