import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../engine/store.js';
import { clonarDemo, clonar } from '../data/demo.js';
import { listarTenants } from '../data/tenants.js';

const FECHA = '2026-09-13';

function mundoDos() {
  const a = clonarDemo('altodelsol', FECHA);
  const b = {
    tenantId: 'hotelb',
    sedes: [{ id: 'otra', nombre: 'Otra Sede', direccion: 'Iquique', habitaciones: [{ numero: '1', tipo: 'single', piso: 1 }] }],
    empresas: [{ tenantId: 'hotelb', id: 'emp-x', nombre: 'Faena Sur', convenio: { tarifaNoche: 1000 }, activa: true }],
    huespedes: [{
      tenantId: 'hotelb', id: 'hx-1', empresaId: 'emp-x', nombre: 'Huésped Aislado',
      rut: '22.222.222-2', telefono: '+56988880001', cargo: 'Operador',
      preferencias: { piso: 1, pisoAlto: false, silencioso: false },
    }],
    reservaHab: [{
      tenantId: 'hotelb', id: 'rx-1', sedeId: 'otra', habitacion: '1', huespedId: 'hx-1',
      empresaId: 'emp-x', checkIn: FECHA, checkOut: '2026-09-20', estado: 'confirmada',
      origen: 'recepcion', codigo: 'HTB-2026-0001', horaLlegada: null, extras: [],
    }],
    roomingLists: [],
    traslados: [],
    tareas: [],
    conversations: [],
    usuariosEquipo: [],
    automation: { nextActionSeq: 1, agentesActivos: {}, campanias: [], acciones: [] },
    nextReservaSeq: 2,
    nextConvSeq: 1,
    nextTareaSeq: 1,
    nextRoomingSeq: 1,
  };
  return {
    tenants: [
      ...listarTenants(),
      { id: 'hotelb', slug: 'hotelb', activo: true, codigoPrefix: 'HTB', sedes: b.sedes },
    ],
    byTenant: { altodelsol: a, hotelb: b },
  };
}

test('aislamiento por tenant: reservas, huéspedes, listas y tareas no cruzan', () => {
  const mem = crearMemoria(mundoDos());
  for (const row of mem.listarReservasHab('altodelsol')) assert.equal(row.tenantId, 'altodelsol');
  for (const row of mem.listarReservasHab('hotelb')) assert.equal(row.tenantId, 'hotelb');
  for (const row of mem.listarHuespedes('altodelsol')) assert.equal(row.tenantId, 'altodelsol');
  for (const row of mem.listarHuespedes('hotelb')) assert.equal(row.tenantId, 'hotelb');
  assert.equal(mem.listarReservasHab('altodelsol').some((r) => String(r.codigo).startsWith('HTB-')), false);
  assert.equal(mem.listarReservasHab('hotelb').some((r) => String(r.codigo).startsWith('ADS-')), false);
  assert.equal(mem.listarHuespedes('hotelb').some((h) => h.nombre === 'Patricia Soto'), false);
  mem.crearTarea('hotelb', { titulo: 'Solo hotel B', detalle: 'aislada', sedeId: 'otra' });
  assert.equal(mem.listarTareas('altodelsol').some((t) => t.titulo === 'Solo hotel B'), false);
  assert.equal(mem.listarTareas('hotelb').some((t) => t.titulo === 'Solo hotel B'), true);
});

test('aislamiento por empresa: el rol empresa solo ve lo suyo', () => {
  const mem = crearMemoria(clonar(clonarDemo('altodelsol', FECHA)));
  const norte = { rol: 'empresa', empresaId: 'emp-norte', tenantId: 'altodelsol' };
  const hues = mem.listarHuespedes('altodelsol', norte);
  assert.equal(hues.every((h) => h.empresaId === 'emp-norte'), true);
  assert.equal(hues.some((h) => /Andes|Pampa|Beltrán|Ricci/.test(h.nombre)), false);
  const reservas = mem.listarReservasHab('altodelsol', norte);
  assert.equal(reservas.every((r) => r.empresaId === 'emp-norte'), true);
  const cuentaN = mem.estadoCuenta('altodelsol', 'emp-norte', FECHA, norte);
  assert.ok(cuentaN);
  let threw = false;
  try {
    mem.estadoCuenta('altodelsol', 'emp-andes', FECHA, norte);
  } catch (e) {
    threw = e.code === 'FORBIDDEN';
  }
  assert.equal(threw, true);
});
