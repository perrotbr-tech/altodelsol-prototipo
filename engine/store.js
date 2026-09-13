import { clonarDemo, clonarMundo, clonar } from '../data/demo.js';
import { buscarTenant, listarTenants, TENANT_DEFAULT } from '../data/tenants.js';
import { anioDe, fechaHoy, parseFecha, dayKey } from './dates.js';

export { clonar };

const ESTADOS_OCUPA = new Set(['confirmada', 'en_casa']);

function anioCodigo(fechaRef) {
  return anioDe(fechaRef || fechaHoy());
}

function toWorld(datosIniciales) {
  if (!datosIniciales) return clonarMundo();
  if (datosIniciales.byTenant) return clonar(datosIniciales);
  const tenantId = datosIniciales.tenantId || TENANT_DEFAULT;
  const slice = clonar(datosIniciales);
  slice.tenantId = tenantId;
  stampSlice(slice, tenantId);
  return {
    tenants: listarTenants(),
    byTenant: { [tenantId]: slice },
  };
}

function stampSlice(slice, tenantId) {
  const keys = [
    'sedes', 'empresas', 'huespedes', 'reservaHab', 'roomingLists',
    'traslados', 'tareas', 'conversations', 'usuariosEquipo',
  ];
  for (const k of keys) {
    if (!Array.isArray(slice[k])) continue;
    slice[k] = slice[k].map((row) => ({ tenantId, ...row }));
  }
  if (slice.automation) {
    slice.automation.campanias = (slice.automation.campanias || []).map((c) => ({ tenantId, ...c }));
    slice.automation.acciones = (slice.automation.acciones || []).map((a) => ({ tenantId, ...a }));
  }
  return slice;
}

export function nochesEntre(checkIn, checkOut) {
  const a = parseFecha(checkIn);
  const b = parseFecha(checkOut);
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function nochesEnMes(checkIn, checkOut, yearMonth) {
  const start = parseFecha(checkIn);
  const end = parseFecha(checkOut);
  const mesStart = parseFecha(`${yearMonth}-01`);
  const mesEnd = new Date(mesStart);
  mesEnd.setUTCMonth(mesEnd.getUTCMonth() + 1);
  const from = start > mesStart ? start : mesStart;
  const to = end < mesEnd ? end : mesEnd;
  return Math.max(0, Math.round((to - from) / 86400000));
}

export function ocupaNoche(reserva, noche) {
  if (!ESTADOS_OCUPA.has(reserva.estado)) return false;
  const n = dayKey(noche);
  return reserva.checkIn <= n && reserva.checkOut > n;
}

export function seSolapan(a, b) {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export function crearMemoria(datosIniciales) {
  let state = toWorld(datosIniciales);

  function ensure(tenantId) {
    const id = tenantId || TENANT_DEFAULT;
    if (!state.byTenant[id]) {
      const t = buscarTenant(id) || (state.tenants || []).find((x) => x.id === id || x.slug === id);
      if (!t || t.activo === false) return null;
      state.byTenant[id] = buscarTenant(id) ? clonarDemo(id) : stampSlice({
        tenantId: id,
        sedes: t.sedes || [],
        empresas: [],
        huespedes: [],
        reservaHab: [],
        roomingLists: [],
        traslados: [],
        tareas: [],
        conversations: [],
        usuariosEquipo: [],
        automation: { nextActionSeq: 1, agentesActivos: {}, campanias: [], acciones: [] },
        nextReservaSeq: 1,
        nextConvSeq: 1,
        nextTareaSeq: 1,
        nextRoomingSeq: 1,
      }, id);
    }
    return state.byTenant[id];
  }

  function requireSlice(tenantId) {
    const s = ensure(tenantId);
    if (!s) {
      const err = new Error('tenant_not_found');
      err.code = 'TENANT_NOT_FOUND';
      throw err;
    }
    return s;
  }

  function snapshot() {
    return clonar(state);
  }

  function hidratar(datos) {
    state = toWorld(datos);
  }

  function getTenant(tenantId) {
    return buscarTenant(tenantId)
      || (state.tenants || []).find((t) => t.id === tenantId || t.slug === tenantId)
      || null;
  }

  function listarTenantsMem() {
    return clonar(state.tenants || listarTenants());
  }

  function listarSedes(tenantId) {
    const t = getTenant(tenantId);
    const s = requireSlice(tenantId);
    const extra = s.sedes || [];
    const base = (t && t.sedes) || extra;
    return clonar(base.map((sede) => {
      const hit = extra.find((x) => x.id === sede.id) || {};
      return { ...sede, ...hit, habitaciones: hit.habitaciones || sede.habitaciones || [] };
    }));
  }

  function getSede(tenantId, sedeId) {
    return listarSedes(tenantId).find((s) => s.id === sedeId || s.nombre === sedeId) || null;
  }

  function listarEmpresas(tenantId, usuario) {
    const rows = requireSlice(tenantId).empresas || [];
    return clonar(filtrarEmpresa(rows, usuario));
  }

  function getEmpresa(tenantId, empresaId) {
    return clonar((requireSlice(tenantId).empresas || []).find((e) => e.id === empresaId) || null);
  }

  function listarHuespedes(tenantId, usuario) {
    const rows = requireSlice(tenantId).huespedes || [];
    return clonar(filtrarEmpresa(rows, usuario));
  }

  function buscarHuespedPorTelefono(tenantId, telefono) {
    const s = requireSlice(tenantId);
    const tel = normalizarTelefono(telefono) || telefono;
    return (s.huespedes || []).find((row) => (normalizarTelefono(row.telefono) || row.telefono) === tel) || null;
  }

  function getHuesped(tenantId, id) {
    return (requireSlice(tenantId).huespedes || []).find((h) => h.id === id) || null;
  }

  function listarReservasHab(tenantId, usuario) {
    const rows = requireSlice(tenantId).reservaHab || [];
    return clonar(filtrarEmpresa(rows, usuario).filter((r) => r.tenantId === tenantId || !r.tenantId));
  }

  function reservasDeTelefono(tenantId, telefono) {
    const h = buscarHuespedPorTelefono(tenantId, telefono);
    if (!h) return [];
    return listarReservasHab(tenantId).filter((r) => r.huespedId === h.id);
  }

  function reservaActivaDeTelefono(tenantId, telefono, fechaRef) {
    const dia = dayKey(fechaRef || fechaHoy());
    const rows = reservasDeTelefono(tenantId, telefono)
      .filter((r) => r.estado !== 'cancelada' && r.estado !== 'no_show')
      .sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));
    return rows.find((r) => r.checkIn <= dia && r.checkOut > dia)
      || rows.find((r) => r.checkIn >= dia)
      || rows[rows.length - 1]
      || null;
  }

  function siguienteCodigo(tenantId, fechaRef) {
    const s = requireSlice(tenantId);
    const tenant = getTenant(tenantId);
    const prefix = (tenant && tenant.codigoPrefix) || 'ADS';
    const seq = s.nextReservaSeq || 1;
    s.nextReservaSeq = seq + 1;
    return `${prefix}-${anioCodigo(fechaRef)}-${String(seq).padStart(4, '0')}`;
  }

  function listarTraslados(tenantId, usuario) {
    const s = requireSlice(tenantId);
    const reservas = listarReservasHab(tenantId, usuario);
    const ids = new Set(reservas.map((r) => r.id));
    return clonar((s.traslados || []).filter((t) => ids.has(t.reservaHabId)));
  }

  function trasladoDeReserva(tenantId, reservaHabId) {
    const s = requireSlice(tenantId);
    return clonar((s.traslados || []).filter((t) => t.reservaHabId === reservaHabId));
  }

  function listarTareas(tenantId, usuario) {
    const rows = requireSlice(tenantId).tareas || [];
    return clonar(filtrarEmpresa(rows, usuario));
  }

  function listarRoomingLists(tenantId, usuario) {
    const rows = requireSlice(tenantId).roomingLists || [];
    return clonar(filtrarEmpresa(rows, usuario));
  }

  function getRooming(tenantId, id) {
    return clonar((requireSlice(tenantId).roomingLists || []).find((r) => r.id === id) || null);
  }

  function listarConversaciones(tenantId) {
    return clonar(requireSlice(tenantId).conversations);
  }

  function listarAcciones(tenantId, filtro = {}) {
    const s = requireSlice(tenantId);
    const rows = (s.automation && s.automation.acciones) || [];
    return rows
      .filter((a) => a.tenantId === tenantId || !a.tenantId)
      .filter((a) => !filtro.agente || a.agente === filtro.agente)
      .filter((a) => !filtro.sede || a.sedeId === filtro.sede)
      .filter((a) => !filtro.estado || a.estado === filtro.estado)
      .map((a) => clonar(a));
  }

  function listarCampanias(tenantId) {
    const s = requireSlice(tenantId);
    return clonar((s.automation && s.automation.campanias) || []);
  }

  function crearConversacion(tenantId, base = {}) {
    const s = requireSlice(tenantId);
    const id = `conv-${tenantId}-${s.nextConvSeq || 1}`;
    s.nextConvSeq = (s.nextConvSeq || 1) + 1;
    const conv = {
      id,
      tenantId,
      sede: null,
      status: 'active',
      paso: 'menu',
      data: {},
      usuario: null,
      telefono: null,
      motivo: null,
      messages: [],
      ...base,
    };
    s.conversations.push(conv);
    return conv;
  }

  function getConversacion(tenantId, id) {
    const s = requireSlice(tenantId);
    return s.conversations.find((c) => c.id === id) || null;
  }

  function crearAccion(tenantId, accion) {
    const s = requireSlice(tenantId);
    if (!s.automation) {
      s.automation = { nextActionSeq: 1, agentesActivos: {}, campanias: [], acciones: [] };
    }
    s.automation.nextActionSeq = (s.automation.nextActionSeq || 0) + 1;
    const row = {
      id: `act-${s.automation.nextActionSeq}`,
      tenantId,
      canal: 'simulado',
      estado: accion.tipo === 'mensaje' ? 'enviado' : 'pendiente',
      fechaISO: new Date().toISOString(),
      ...accion,
    };
    s.automation.acciones.push(row);
    return clonar(row);
  }

  function crearTarea(tenantId, tarea) {
    const s = requireSlice(tenantId);
    s.nextTareaSeq = (s.nextTareaSeq || 1);
    const id = tarea.id || `tar-${String(s.nextTareaSeq).padStart(2, '0')}`;
    s.nextTareaSeq += 1;
    const row = {
      tenantId,
      id,
      origen: 'asistente',
      prioridad: 'media',
      estado: 'abierta',
      creadaEl: new Date().toISOString(),
      ...tarea,
    };
    s.tareas.push(row);
    crearAccion(tenantId, {
      agente: 'asistente',
      tipo: 'tarea_equipo',
      huespedId: row.huespedId || null,
      socioId: row.huespedId || null,
      texto: null,
      motivo: row.detalle || row.titulo,
      prioridad: row.prioridad,
      sedeId: row.sedeId || '',
    });
    return clonar(row);
  }

  function resolverTarea(tenantId, id) {
    const s = requireSlice(tenantId);
    const t = (s.tareas || []).find((x) => x.id === id);
    if (!t) return null;
    t.estado = 'resuelta';
    t.resueltaEl = new Date().toISOString();
    return clonar(t);
  }

  function registrarHoraLlegada(tenantId, reservaId, hora) {
    const s = requireSlice(tenantId);
    const r = (s.reservaHab || []).find((x) => x.id === reservaId);
    if (!r) return { ok: false, error: 'reserva_no_encontrada' };
    r.horaLlegada = hora;
    return { ok: true, reserva: clonar(r) };
  }

  function conflictosHabitacion(tenantId, { sedeId, habitacion, checkIn, checkOut, ignoreId }) {
    const rows = requireSlice(tenantId).reservaHab || [];
    return rows.filter((r) => {
      if (ignoreId && r.id === ignoreId) return false;
      if (r.sedeId !== sedeId) return false;
      if (String(r.habitacion) !== String(habitacion)) return false;
      if (!ESTADOS_OCUPA.has(r.estado)) return false;
      return seSolapan(r, { checkIn, checkOut });
    }).map((r) => clonar(r));
  }

  function detectarConflictosRooming(tenantId, rooming) {
    const conflictos = [];
    for (const fila of rooming.filas || []) {
      if (!fila.habitacionSolicitada) continue;
      const hits = conflictosHabitacion(tenantId, {
        sedeId: rooming.sedeId,
        habitacion: fila.habitacionSolicitada,
        checkIn: fila.checkIn,
        checkOut: fila.checkOut,
      });
      if (hits.length) {
        conflictos.push({
          huespedId: fila.huespedId,
          habitacion: fila.habitacionSolicitada,
          checkIn: fila.checkIn,
          checkOut: fila.checkOut,
          ocupadaPor: hits.map((h) => h.codigo),
        });
      }
    }
    return conflictos;
  }

  function confirmarRoomingList(tenantId, roomingId, fechaRef) {
    const s = requireSlice(tenantId);
    const rl = (s.roomingLists || []).find((x) => x.id === roomingId);
    if (!rl) return { ok: false, error: 'lista_no_encontrada' };
    const conflictos = detectarConflictosRooming(tenantId, rl);
    const creadas = [];
    const omitidas = [];
    for (const fila of rl.filas || []) {
      const conflicto = conflictos.find((c) => c.huespedId === fila.huespedId
        && c.habitacion === fila.habitacionSolicitada);
      if (conflicto) {
        omitidas.push(conflicto);
        continue;
      }
      const existente = (s.reservaHab || []).find(
        (r) => r.huespedId === fila.huespedId
          && r.sedeId === rl.sedeId
          && r.checkIn === fila.checkIn
          && ESTADOS_OCUPA.has(r.estado),
      );
      if (existente) {
        existente.habitacion = fila.habitacionSolicitada || existente.habitacion;
        existente.checkOut = fila.checkOut;
        existente.empresaId = rl.empresaId;
        existente.origen = 'rooming_list';
        creadas.push(clonar(existente));
        continue;
      }
      const row = {
        tenantId,
        id: `res-${String(s.nextReservaSeq || 1).padStart(4, '0')}`,
        sedeId: rl.sedeId,
        habitacion: fila.habitacionSolicitada || null,
        huespedId: fila.huespedId,
        empresaId: rl.empresaId,
        checkIn: fila.checkIn,
        checkOut: fila.checkOut,
        estado: 'confirmada',
        origen: 'rooming_list',
        codigo: siguienteCodigo(tenantId, fechaRef),
        horaLlegada: null,
        extras: [],
      };
      s.reservaHab.push(row);
      creadas.push(clonar(row));
    }
    rl.estado = 'confirmada';
    rl.confirmadaEl = dayKey(fechaRef || fechaHoy());
    return { ok: true, rooming: clonar(rl), creadas, conflictos: omitidas };
  }

  function devolverRooming(tenantId, roomingId, observacion) {
    const s = requireSlice(tenantId);
    const rl = (s.roomingLists || []).find((x) => x.id === roomingId);
    if (!rl) return { ok: false, error: 'lista_no_encontrada' };
    rl.estado = 'borrador';
    rl.observacion = String(observacion || 'Devuelta a la empresa');
    return { ok: true, rooming: clonar(rl) };
  }

  function enviarRooming(tenantId, roomingId) {
    const s = requireSlice(tenantId);
    const rl = (s.roomingLists || []).find((x) => x.id === roomingId);
    if (!rl) return { ok: false, error: 'lista_no_encontrada' };
    rl.estado = 'enviada';
    return { ok: true, rooming: clonar(rl) };
  }

  function crearRoomingDesdeFilas(tenantId, { empresaId, sedeId, turnoInicio, turnoFin, filas }) {
    const s = requireSlice(tenantId);
    s.nextRoomingSeq = (s.nextRoomingSeq || 1) + 1;
    const row = {
      tenantId,
      id: `rl-${s.nextRoomingSeq}`,
      empresaId,
      sedeId,
      turnoInicio,
      turnoFin,
      filas,
      estado: 'borrador',
      confirmadaEl: null,
      observacion: null,
    };
    s.roomingLists.push(row);
    return clonar(row);
  }

  function reemplazarFilaRooming(tenantId, roomingId, huespedId, nuevo, motivo, usuario) {
    const s = requireSlice(tenantId);
    const rl = (s.roomingLists || []).find((x) => x.id === roomingId);
    if (!rl) return { ok: false, error: 'lista_no_encontrada' };
    if (usuario && usuario.rol === 'empresa' && usuario.empresaId !== rl.empresaId) {
      return { ok: false, error: 'forbidden' };
    }
    if (!String(motivo || '').trim()) return { ok: false, error: 'motivo_obligatorio' };
    const fila = (rl.filas || []).find((f) => f.huespedId === huespedId);
    if (!fila) return { ok: false, error: 'fila_no_encontrada' };
    const anterior = { ...fila };
    fila.huespedId = nuevo.huespedId || fila.huespedId;
    if (nuevo.nombre) fila.nombre = nuevo.nombre;
    if (nuevo.checkIn) fila.checkIn = nuevo.checkIn;
    if (nuevo.checkOut) fila.checkOut = nuevo.checkOut;
    if (nuevo.habitacionSolicitada) fila.habitacionSolicitada = nuevo.habitacionSolicitada;
    const tarea = crearTarea(tenantId, {
      origen: 'portal',
      tipo: 'reemplazo',
      prioridad: 'alta',
      huespedId: fila.huespedId,
      empresaId: rl.empresaId,
      sedeId: rl.sedeId,
      titulo: 'Reemplazo de trabajador',
      detalle: `Reemplazo en lista ${rl.id}: ${anterior.nombre || anterior.huespedId} por ${fila.nombre || fila.huespedId}. Motivo: ${motivo}`,
    });
    return { ok: true, fila: clonar(fila), tarea };
  }

  function alertasSobreventa(tenantId, fechaRef) {
    const dia = dayKey(fechaRef || fechaHoy());
    const sedes = listarSedes(tenantId);
    const reservas = requireSlice(tenantId).reservaHab || [];
    const alertas = [];
    for (const sede of sedes) {
      const total = (sede.habitaciones || []).length;
      const ocupadas = reservas.filter((r) => r.sedeId === sede.id && ocupaNoche(r, dia)).length;
      if (total > 0 && ocupadas > total) {
        alertas.push({
          sedeId: sede.id,
          nombre: sede.nombre,
          fecha: dia,
          ocupadas,
          total,
        });
      }
    }
    return alertas;
  }

  function ocupacionPorSede(tenantId, fechaRef) {
    const dia = dayKey(fechaRef || fechaHoy());
    const reservas = requireSlice(tenantId).reservaHab || [];
    return listarSedes(tenantId).map((sede) => {
      const total = (sede.habitaciones || []).length;
      const ocupadas = reservas.filter((r) => r.sedeId === sede.id && ocupaNoche(r, dia)).length;
      return {
        sedeId: sede.id,
        nombre: sede.nombre,
        ocupadas,
        total,
        demostrativa: Boolean(sede.demostrativa),
      };
    });
  }

  function mapaHabitaciones(tenantId, sedeId, fechaRef) {
    const dia = dayKey(fechaRef || fechaHoy());
    const sede = getSede(tenantId, sedeId);
    if (!sede) return [];
    const reservas = (requireSlice(tenantId).reservaHab || []).filter((r) => r.sedeId === sede.id);
    return (sede.habitaciones || []).map((h) => {
      const enNoche = reservas.find((r) => String(r.habitacion) === String(h.numero) && ocupaNoche(r, dia));
      const llega = reservas.find((r) => String(r.habitacion) === String(h.numero) && r.checkIn === dia && r.estado !== 'cancelada');
      const sale = reservas.find((r) => String(r.habitacion) === String(h.numero) && r.checkOut === dia && r.estado !== 'cancelada');
      let estado = 'libre';
      if (enNoche) estado = 'ocupada';
      if (llega) estado = 'llegada';
      if (sale && !llega) estado = 'salida';
      return { ...h, estado, reserva: enNoche || llega || sale || null };
    });
  }

  function movimientoDelDia(tenantId, fechaRef, tipo, usuario) {
    const dia = dayKey(fechaRef || fechaHoy());
    const campo = tipo === 'llegada' ? 'checkIn' : 'checkOut';
    return listarReservasHab(tenantId, usuario)
      .filter((r) => r[campo] === dia && r.estado !== 'cancelada' && r.estado !== 'no_show')
      .map((r) => {
        const h = getHuesped(tenantId, r.huespedId);
        const emp = r.empresaId ? getEmpresa(tenantId, r.empresaId) : null;
        const sede = getSede(tenantId, r.sedeId);
        const tras = trasladoDeReserva(tenantId, r.id);
        return {
          ...r,
          huespedNombre: h ? h.nombre : r.huespedId,
          empresaNombre: emp ? emp.nombre : 'Particular',
          sedeNombre: sede ? sede.nombre : r.sedeId,
          traslados: tras,
        };
      });
  }

  function estadoCuenta(tenantId, empresaId, fechaRef, usuario) {
    if (usuario && usuario.rol === 'empresa' && usuario.empresaId !== empresaId) {
      const err = new Error('forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
    const emp = getEmpresa(tenantId, empresaId);
    if (!emp) return null;
    const periodo = dayKey(fechaRef || fechaHoy()).slice(0, 7);
    const tarifa = emp.convenio.tarifaNoche;
    const huespedes = (requireSlice(tenantId).huespedes || []).filter((h) => h.empresaId === empresaId);
    const reservas = (requireSlice(tenantId).reservaHab || [])
      .filter((r) => r.empresaId === empresaId && r.estado !== 'cancelada' && r.estado !== 'no_show');
    const filas = [];
    for (const h of huespedes) {
      const delH = reservas.filter((r) => r.huespedId === h.id);
      let noches = 0;
      let extras = 0;
      for (const r of delH) {
        noches += nochesEnMes(r.checkIn, r.checkOut, periodo);
        extras += (r.extras || []).reduce((acc, x) => acc + Number(x.monto || 0), 0);
      }
      if (noches === 0 && extras === 0) continue;
      filas.push({
        huespedId: h.id,
        nombre: h.nombre,
        noches,
        tarifa,
        extras,
        subtotal: noches * tarifa + extras,
      });
    }
    const totalNoches = filas.reduce((a, f) => a + f.noches, 0);
    const totalExtras = filas.reduce((a, f) => a + f.extras, 0);
    const total = filas.reduce((a, f) => a + f.subtotal, 0);
    return {
      empresaId,
      empresaNombre: emp.nombre,
      periodo,
      tarifaNoche: tarifa,
      filas,
      totalNoches,
      totalExtras,
      total,
      rotulo: 'Estado de cuenta informativo · la factura la emite el hotel',
    };
  }

  function parsearCsvRooming(texto) {
    const lines = String(texto || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) {
      return { filas: [], errores: [{ fila: 0, error: 'archivo vacío' }] };
    }
    const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name) => header.findIndex((h) => h === name);
    const iNom = idx('nombre');
    const iRut = idx('rut');
    const iTel = idx('telefono');
    const iIn = idx('checkin');
    const iOut = idx('checkout');
    const iHab = idx('habitacionsolicitada') >= 0 ? idx('habitacionsolicitada') : idx('habitacion');
    if (iNom < 0 || iTel < 0 || iIn < 0 || iOut < 0) {
      return { filas: [], errores: [{ fila: 1, error: 'encabezado incompleto' }] };
    }
    const filas = [];
    const errores = [];
    const vistosTel = new Map();
    const vistosRut = new Map();
    lines.slice(1).forEach((line, n) => {
      const filaN = n + 2;
      const cols = splitCsv(line);
      const nombre = (cols[iNom] || '').trim();
      const rut = iRut >= 0 ? (cols[iRut] || '').trim() : '';
      const telefonoRaw = (cols[iTel] || '').trim();
      const checkIn = (cols[iIn] || '').trim();
      const checkOut = (cols[iOut] || '').trim();
      const habitacionSolicitada = iHab >= 0 ? (cols[iHab] || '').trim() : '';
      const telefono = normalizarTelefono(telefonoRaw);
      if (!telefono) errores.push({ fila: filaN, error: 'teléfono inválido', nombre });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
        errores.push({ fila: filaN, error: 'fecha inválida', nombre });
      } else if (checkOut <= checkIn) {
        errores.push({ fila: filaN, error: 'fechas invertidas', nombre });
      }
      if (telefono && vistosTel.has(telefono)) {
        errores.push({ fila: filaN, error: 'duplicado', nombre, duplicaFila: vistosTel.get(telefono) });
      }
      if (rut && vistosRut.has(rut)) {
        errores.push({ fila: filaN, error: 'duplicado', nombre, duplicaFila: vistosRut.get(rut) });
      }
      if (telefono) vistosTel.set(telefono, filaN);
      if (rut) vistosRut.set(rut, filaN);
      filas.push({
        fila: filaN,
        nombre,
        rut,
        telefono: telefono || telefonoRaw,
        checkIn,
        checkOut,
        habitacionSolicitada,
        ok: errores.every((e) => e.fila !== filaN),
      });
    });
    return { filas, errores };
  }

  function aplicarCsvEmpresa(tenantId, { empresaId, sedeId, texto, usuario }) {
    if (usuario && usuario.rol === 'empresa' && usuario.empresaId !== empresaId) {
      return { ok: false, error: 'forbidden' };
    }
    const parsed = parsearCsvRooming(texto);
    if (parsed.errores.length) return { ok: false, ...parsed };
    const s = requireSlice(tenantId);
    const filas = parsed.filas.map((f) => {
      let h = buscarHuespedPorTelefono(tenantId, f.telefono);
      if (!h) {
        const id = `h-csv-${(s.huespedes.length + 1)}`;
        h = {
          tenantId,
          id,
          empresaId,
          nombre: f.nombre,
          rut: f.rut,
          telefono: f.telefono,
          cargo: 'Turno',
          preferencias: { piso: 2, pisoAlto: false, silencioso: false },
        };
        s.huespedes.push(h);
      }
      return {
        huespedId: h.id,
        nombre: f.nombre,
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        habitacionSolicitada: f.habitacionSolicitada,
      };
    });
    const inicio = filas.map((f) => f.checkIn).sort()[0];
    const fin = filas.map((f) => f.checkOut).sort().slice(-1)[0];
    const rl = crearRoomingDesdeFilas(tenantId, {
      empresaId,
      sedeId,
      turnoInicio: inicio,
      turnoFin: fin,
      filas,
    });
    return { ok: true, rooming: rl, filas: parsed.filas, errores: [] };
  }

  function sliceExport(tenantId) {
    return clonar(requireSlice(tenantId));
  }

  return {
    snapshot,
    hidratar,
    getTenant,
    listarTenants: listarTenantsMem,
    listarSedes,
    getSede,
    listarEmpresas,
    getEmpresa,
    listarHuespedes,
    buscarHuespedPorTelefono,
    getHuesped,
    listarReservasHab,
    reservasDeTelefono,
    reservaActivaDeTelefono,
    listarTraslados,
    trasladoDeReserva,
    listarTareas,
    listarRoomingLists,
    getRooming,
    listarConversaciones,
    listarAcciones,
    listarCampanias,
    crearConversacion,
    getConversacion,
    crearAccion,
    crearTarea,
    resolverTarea,
    registrarHoraLlegada,
    conflictosHabitacion,
    detectarConflictosRooming,
    confirmarRoomingList,
    devolverRooming,
    enviarRooming,
    crearRoomingDesdeFilas,
    reemplazarFilaRooming,
    alertasSobreventa,
    ocupacionPorSede,
    mapaHabitaciones,
    movimientoDelDia,
    estadoCuenta,
    parsearCsvRooming,
    aplicarCsvEmpresa,
    siguienteCodigo,
    sliceExport,
    hidratarTenant(tenantId, slice) {
      const s = clonar(slice);
      s.tenantId = tenantId;
      stampSlice(s, tenantId);
      if (!state.byTenant) state.byTenant = {};
      state.byTenant[tenantId] = s;
    },
    requireSlice,
  };
}

function filtrarEmpresa(rows, usuario) {
  if (usuario && usuario.rol === 'empresa') {
    return rows.filter((r) => r.empresaId === usuario.empresaId);
  }
  return rows;
}

function splitCsv(line) {
  return String(line || '').split(',').map((c) => c.trim());
}

export function normalizarTelefono(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('569')) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
  return null;
}

export function nombreValido(raw) {
  const n = String(raw || '').trim();
  return n.length >= 2 && n.length <= 60;
}

export function parseHora(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
