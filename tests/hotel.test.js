import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria, nochesEnMes } from '../engine/store.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { clonarDemo, TEL_HUESPED_NORTE, TEL_TURISTA_SIN_RESERVA } from '../data/demo.js';
import { textoValido } from '../data/templates.js';
import { i18n, TEXTOS_PROHIBIDOS } from '../data/i18n.js';
import { readFileSync } from 'node:fs';

const FECHA = '2026-09-13';
const TID = 'altodelsol';

function textosDe(obj, acc = []) {
  if (typeof obj === 'string') acc.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => textosDe(x, acc));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((x) => textosDe(x, acc));
  return acc;
}

function lineas(texto) {
  return String(texto || '').split('\n').filter((l) => l.length > 0).length;
}

test('correlativo ADS-YYYY-NNNN consecutivo', () => {
  const mem = crearMemoria(clonarDemo(TID, FECHA));
  const a = mem.siguienteCodigo(TID, FECHA);
  const b = mem.siguienteCodigo(TID, FECHA);
  assert.match(a, /^ADS-2026-\d{4}$/);
  assert.match(b, /^ADS-2026-\d{4}$/);
  assert.equal(Number(b.slice(-4)), Number(a.slice(-4)) + 1);
});

test('rooming list confirmada crea reservas y detecta conflicto de habitación', () => {
  const demo = clonarDemo(TID, FECHA);
  const mem = crearMemoria(demo);
  const rl = mem.listarRoomingLists(TID).find((x) => x.id === 'rl-norte-prox');
  assert.ok(rl);
  mem.requireSlice(TID).reservaHab.push({
    tenantId: TID,
    id: 'res-conflicto',
    sedeId: 'costanera',
    habitacion: '201',
    huespedId: 'h-t-01',
    empresaId: null,
    checkIn: rl.turnoInicio,
    checkOut: rl.turnoFin,
    estado: 'confirmada',
    origen: 'recepcion',
    codigo: 'ADS-2026-9999',
    horaLlegada: null,
    extras: [],
  });
  const antes = mem.listarReservasHab(TID).length;
  const r = mem.confirmarRoomingList(TID, 'rl-norte-prox', FECHA);
  assert.equal(r.ok, true);
  assert.equal(r.conflictos.length, 1);
  assert.equal(r.conflictos[0].habitacion, '201');
  assert.equal(r.creadas.length, rl.filas.length - 1);
  assert.equal(mem.listarReservasHab(TID).length, antes + r.creadas.length);
  assert.equal(r.creadas.every((x) => /^ADS-2026-\d{4}$/.test(x.codigo)), true);
  assert.equal(mem.getRooming(TID, 'rl-norte-prox').estado, 'confirmada');
});

test('sobreventa genera alerta', () => {
  const mem = crearMemoria(clonarDemo(TID, FECHA));
  const s = mem.requireSlice(TID);
  for (let i = 0; i < 20; i += 1) {
    s.reservaHab.push({
      tenantId: TID,
      id: `ov-${i}`,
      sedeId: 'mejillones',
      habitacion: String(401 + i),
      huespedId: `h-p-01`,
      empresaId: 'emp-pampa',
      checkIn: FECHA,
      checkOut: '2026-09-20',
      estado: 'confirmada',
      origen: 'recepcion',
      codigo: `ADS-2026-8${String(i).padStart(3, '0')}`,
      horaLlegada: null,
      extras: [],
    });
  }
  const alertas = mem.alertasSobreventa(TID, FECHA);
  assert.equal(alertas.some((a) => a.sedeId === 'mejillones' && a.ocupadas > a.total), true);
});

test('CSV valida filas, duplicados, teléfono inválido y fechas invertidas', () => {
  const mem = crearMemoria(clonarDemo(TID, FECHA));
  const csv = [
    'nombre,rut,telefono,checkIn,checkOut,habitacionSolicitada',
    'Ana Test,11.111.111-1,+56991111111,2026-10-01,2026-10-05,210',
    'Mal Tel,11.111.111-2,123,2026-10-01,2026-10-05,211',
    'Fechas Inv,11.111.111-3,+56991111113,2026-10-05,2026-10-01,212',
    'Ana Test,11.111.111-1,+56991111111,2026-10-01,2026-10-05,213',
  ].join('\n');
  const parsed = mem.parsearCsvRooming(csv);
  const tipos = parsed.errores.map((e) => e.error);
  assert.equal(tipos.includes('teléfono inválido'), true);
  assert.equal(tipos.includes('fechas invertidas'), true);
  assert.equal(tipos.includes('duplicado'), true);
  const ok = mem.parsearCsvRooming([
    'nombre,rut,telefono,checkIn,checkOut,habitacionSolicitada',
    'Ana Test,11.111.111-1,+56991111111,2026-10-01,2026-10-05,210',
  ].join('\n'));
  assert.equal(ok.errores.length, 0);
  assert.equal(ok.filas[0].ok, true);
});

test('estado de cuenta = noches × tarifa + extras', () => {
  const mem = crearMemoria(clonarDemo(TID, FECHA));
  const cuenta = mem.estadoCuenta(TID, 'emp-norte', FECHA);
  const emp = mem.getEmpresa(TID, 'emp-norte');
  const tarifa = emp.convenio.tarifaNoche;
  let noches = 0;
  let extras = 0;
  for (const r of mem.listarReservasHab(TID).filter((x) => x.empresaId === 'emp-norte' && x.estado !== 'cancelada')) {
    noches += nochesEnMes(r.checkIn, r.checkOut, '2026-09');
    extras += (r.extras || []).reduce((a, x) => a + x.monto, 0);
  }
  assert.equal(cuenta.totalNoches, noches);
  assert.equal(cuenta.totalExtras, extras);
  assert.equal(cuenta.total, noches * tarifa + extras);
  assert.match(cuenta.rotulo, /informativo/);
});

test('huésped solo ve su propia reserva', () => {
  const mem = crearMemoria(clonarDemo(TID, FECHA));
  const propias = mem.reservasDeTelefono(TID, TEL_HUESPED_NORTE);
  assert.ok(propias.length >= 1);
  const h = mem.buscarHuespedPorTelefono(TID, TEL_HUESPED_NORTE);
  assert.equal(propias.every((r) => r.huespedId === h.id), true);
  const ajenas = mem.listarReservasHab(TID).filter((r) => r.huespedId !== h.id);
  assert.ok(ajenas.length > 0);
  assert.equal(propias.some((r) => r.huespedId !== h.id), false);
});

test('asistente: cada intención ≤ 6 líneas, sin llaves; raro no lanza', () => {
  const engine = crearEngine(clonarDemo(TID, FECHA), TID, { fechaRef: FECHA });
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  const bienvenida = engine.memoria.getConversacion(TID, id).messages[0];
  assert.match(bienvenida.texto, /asistente de Hotel Alto del Sol/);
  assert.equal(lineas(bienvenida.texto) <= 6, true);

  const casos = [
    ['mi reserva', TEL_HUESPED_NORTE],
    ['llegada', '13:30'],
    ['menu', null],
    ['traslado', TEL_HUESPED_NORTE],
    ['desayuno', null],
    ['extender', TEL_HUESPED_NORTE],
    ['cambio habitacion', TEL_HUESPED_NORTE],
    ['factura', TEL_HUESPED_NORTE],
    ['reclamo', TEL_HUESPED_NORTE],
    ['turista', TEL_TURISTA_SIN_RESERVA],
  ];

  function responder(intencion, extra) {
    const e = crearEngine(clonarDemo(TID, FECHA), TID, { fechaRef: FECHA });
    const s = e.iniciar();
    const cid = s.conversacion.id;
    let r = e.procesar(cid, intencion);
    const pideTel = /teléfono/i.test(r.mensajes[0].texto);
    if (pideTel) r = e.procesar(cid, extra || TEL_HUESPED_NORTE);
    if (/hora estimas/i.test(r.mensajes[0].texto)) r = e.procesar(cid, extra || '13:30');
    return r;
  }

  for (const [intencion, extra] of casos) {
    const r = responder(intencion, extra);
    assert.ok(r.mensajes.length >= 1, intencion);
    for (const m of r.mensajes) {
      assert.equal(lineas(m.texto) <= 6, true, `${intencion}: ${m.texto}`);
      assert.equal(/\{|\}/.test(m.texto), false, m.texto);
      assert.equal(m.texto.includes('undefined'), false, m.texto);
    }
  }

  const e2 = crearEngine(clonarDemo(TID, FECHA), TID, { fechaRef: FECHA });
  const s2 = e2.iniciar();
  const raro = `😀✨ ${'x'.repeat(2000)} <>\\n\u0000`;
  const r2 = e2.procesar(s2.conversacion.id, raro);
  assert.equal(r2.mensajes.length >= 1, true);
  for (const m of r2.mensajes) {
    assert.equal(/\{|\}/.test(m.texto), false);
    assert.equal(lineas(m.texto) <= 6, true);
  }
});

test('los 3 agentes producen acciones coherentes y sin duplicados', () => {
  const auto = crearAutomation(clonarDemo(TID, FECHA), TID);
  auto.ejecutarCiclo(FECHA);
  const acciones = auto.listarAcciones();
  const ids = new Set(acciones.map((a) => a.agente));
  for (const ag of ['recordatorio_llegada', 'rooming_pendiente', 'cierre_mensual']) {
    assert.equal(ids.has(ag), true, ag);
  }
  for (const a of acciones) {
    if (a.texto) assert.equal(textoValido(a.texto), true, a.texto);
    if (a.motivo) assert.equal(textoValido(a.motivo), true, a.motivo);
  }
  const msgs = acciones.filter((a) => a.tipo === 'mensaje');
  const keys = msgs.map((a) => `${a.agente}:${a.destinatarioId || a.huespedId}`);
  assert.equal(keys.length, new Set(keys).size);
});

test('ningún texto visible contiene palabras prohibidas', () => {
  const demo = textosDe(clonarDemo(TID, FECHA)).join('\n');
  const ui = textosDe(i18n).join('\n');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/class="[^"]*"/g, '')
    .replace(/id="[^"]*"/g, '');
  const blob = `${demo}\n${ui}\n${html}`;
  for (const w of TEXTOS_PROHIBIDOS) {
    const re = new RegExp(w, 'i');
    assert.equal(re.test(blob), false, w);
  }
});
