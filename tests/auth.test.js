import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearStoreLocal, crearStorageMemoria } from '../engine/store-local.js';
import { CLAVE_DEMO } from '../data/tenants.js';

test('login bloquea tras 5 intentos aunque el 6º sea correcto', async () => {
  const storage = crearStorageMemoria();
  const store = crearStoreLocal('altodelsol', storage, { fechaRef: '2026-09-13' });
  for (let i = 0; i < 5; i += 1) {
    const bad = await store.login('recepcion@altodelsol.demo', 'mala');
    assert.equal(bad.ok, false);
    assert.equal(bad.status, i === 4 ? 429 : 401);
  }
  const locked = await store.login('recepcion@altodelsol.demo', CLAVE_DEMO);
  assert.equal(locked.ok, false);
  assert.equal(locked.status, 429);
  assert.equal(locked.error, 'bloqueado');
});

test('login correcto devuelve rol y empresaId del coordinador', async () => {
  const storage = crearStorageMemoria();
  const store = crearStoreLocal('altodelsol', storage, { fechaRef: '2026-09-13' });
  const ok = await store.login('coordinador@mineranorte.demo', CLAVE_DEMO);
  assert.equal(ok.ok, true);
  assert.equal(ok.usuario.rol, 'empresa');
  assert.equal(ok.usuario.empresaId, 'emp-norte');
});
