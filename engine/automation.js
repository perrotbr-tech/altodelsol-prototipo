/**
 * Motor de automatizaciones. Agentes: evaluar(contexto, fechaRef) → acciones[].
 */

import { clonar } from './store.js';
import { clonarDemo } from '../data/demo.js';
import { fechaHoy, dayKey, parseFecha } from './dates.js';
import { textoValido } from '../data/templates.js';
import { TENANT_DEFAULT } from '../data/tenants.js';
import { crearAgenteRecordatorioLlegada } from './agents/recordatorio-llegada.js';
import { crearAgenteRoomingPendiente } from './agents/rooming-pendiente.js';
import { crearAgenteCierreMensual } from './agents/cierre-mensual.js';

const AGENTES = [
  crearAgenteRecordatorioLlegada(),
  crearAgenteRoomingPendiente(),
  crearAgenteCierreMensual(),
];

export function crearAutomation(datosIniciales, tenantId = TENANT_DEFAULT) {
  let state = extraer(datosIniciales || clonarDemo(tenantId), tenantId);

  function contexto() {
    const t = state;
    return {
      tenantId: t.tenantId,
      huespedes: t.huespedes,
      reservas: t.reservaHab,
      empresas: t.empresas,
      sedes: t.sedes,
      roomingLists: t.roomingLists,
      traslados: t.traslados,
      campanias: t.automation.campanias,
      checkInHora: '14:00',
    };
  }

  function resolverFecha(fechaRef) {
    if (fechaRef && typeof fechaRef === 'object' && !(fechaRef instanceof Date) && fechaRef.fechaRef) {
      return parseFecha(fechaRef.fechaRef);
    }
    return parseFecha(fechaRef || fechaHoy());
  }

  function ejecutarCiclo(fechaRef = fechaHoy(), agentesFiltro = null) {
    const fecha = resolverFecha(fechaRef);
    const dia = dayKey(fecha);
    const ctx = contexto();
    const activos = state.automation.agentesActivos || {};
    const lista = AGENTES.filter((a) => {
      if (agentesFiltro && !agentesFiltro.includes(a.id)) return false;
      return activos[a.id] !== false;
    });

    const existed = state.automation.campanias.some((c) => c.fecha === dia);
    const acciones = [];
    const mensajesDest = new Set();
    for (const ag of lista) {
      const produced = ag.evaluar(ctx, fecha) || [];
      for (const acc of produced) {
        if (acc.texto && !textoValido(acc.texto)) continue;
        const dest = acc.destinatarioId || acc.huespedId || acc.socioId;
        const dupAgente = acciones.some((x) => x.agente === acc.agente && x.tipo === 'mensaje' && (x.destinatarioId || x.huespedId) === dest);
        if (acc.tipo === 'mensaje' && dupAgente) continue;
        if (acc.tipo === 'mensaje' && dest && mensajesDest.has(`${acc.agente}:${dest}`)) continue;
        if (acc.tipo === 'mensaje' && dest) mensajesDest.add(`${acc.agente}:${dest}`);
        acc.tenantId = state.tenantId;
        state.automation.nextActionSeq += 1;
        acc.id = `act-${state.tenantId}-${state.automation.nextActionSeq}`;
        acc.estado = acc.tipo === 'mensaje' ? 'enviado' : 'pendiente';
        acciones.push(acc);
      }
    }

    const campania = {
      id: `camp-${dia}`,
      fecha: dia,
      fechaISO: fecha.toISOString(),
      clasificacion: [],
      acciones: clonar(acciones),
      replaced: existed,
    };

    state.automation.campanias = state.automation.campanias.filter((c) => c.fecha !== dia);
    state.automation.campanias.push(campania);
    state.automation.acciones = [
      ...state.automation.acciones.filter((a) => dayKey(a.fechaISO) !== dia),
      ...acciones,
    ];
    return clonar(campania);
  }

  function summary(fechaRef = fechaHoy()) {
    const porAgente = {};
    const porTipo = { mensaje: 0, tarea_equipo: 0 };
    const porEstado = { pendiente: 0, enviado: 0, hecho: 0 };
    for (const a of state.automation.acciones) {
      porAgente[a.agente] = (porAgente[a.agente] || 0) + 1;
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;
      porEstado[a.estado] = (porEstado[a.estado] || 0) + 1;
    }
    const ultimo = [...(state.automation.campanias || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
    const delCiclo = (ultimo && ultimo.acciones) || [];
    const indicadores = {};
    const ctx = contexto();
    const fecha = resolverFecha(fechaRef);
    for (const ag of AGENTES) {
      const deAg = delCiclo.filter((x) => x.agente === ag.id);
      const avisoAcc = deAg.find((x) => x.texto) || deAg.find((x) => x.motivo);
      indicadores[ag.id] = {
        ...(ag.indicadores ? ag.indicadores(ctx, fecha) : {}),
        accionesUltimoCiclo: deAg.length,
        aviso: avisoAcc ? (avisoAcc.texto || avisoAcc.motivo || '') : '',
      };
    }
    return {
      porAgente,
      porTipo,
      porEstado,
      indicadores,
      agentesActivos: clonar(state.automation.agentesActivos),
      campanias: state.automation.campanias.length,
    };
  }

  function listarAcciones({ agente, sede, estado } = {}) {
    return state.automation.acciones
      .filter((a) => !agente || a.agente === agente)
      .filter((a) => !sede || a.sedeId === sede)
      .filter((a) => !estado || a.estado === estado)
      .map((a) => enriquecer(a));
  }

  function enriquecer(a) {
    const h = (state.huespedes || []).find((s) => s.id === a.huespedId);
    return {
      ...clonar(a),
      huespedNombre: h ? h.nombre : a.huespedId,
    };
  }

  function setEstado(id, estado) {
    const acc = state.automation.acciones.find((a) => a.id === id);
    if (!acc) return null;
    if (!['pendiente', 'enviado', 'hecho'].includes(estado)) return acc;
    acc.estado = estado;
    return enriquecer(acc);
  }

  function setAgenteActivo(id, activo) {
    state.automation.agentesActivos[id] = Boolean(activo);
    return clonar(state.automation.agentesActivos);
  }

  return {
    ejecutarCiclo,
    summary,
    listarAcciones,
    setEstado,
    setAgenteActivo,
    exportar() {
      return {
        tenantId: state.tenantId,
        huespedes: clonar(state.huespedes),
        reservaHab: clonar(state.reservaHab),
        empresas: clonar(state.empresas),
        sedes: clonar(state.sedes),
        roomingLists: clonar(state.roomingLists),
        traslados: clonar(state.traslados),
        automation: clonar(state.automation),
      };
    },
    hidratar(datos) {
      state = extraer(datos, state.tenantId);
    },
    reset() {
      state = extraer(clonarDemo(state.tenantId), state.tenantId);
    },
    agentes() {
      return AGENTES.map((a) => a.id);
    },
  };
}

function extraer(datos, tenantId = TENANT_DEFAULT) {
  const src = (datos && datos.byTenant && datos.byTenant[tenantId]) ? datos.byTenant[tenantId] : datos;
  const seed = clonarDemo(tenantId);
  return {
    tenantId,
    huespedes: clonar(src.huespedes || seed.huespedes),
    reservaHab: clonar(src.reservaHab || seed.reservaHab),
    empresas: clonar(src.empresas || seed.empresas),
    sedes: clonar(src.sedes || seed.sedes),
    roomingLists: clonar(src.roomingLists || seed.roomingLists),
    traslados: clonar(src.traslados || seed.traslados),
    automation: clonar(src.automation || seed.automation),
  };
}

export { AGENTES, fechaHoy };
