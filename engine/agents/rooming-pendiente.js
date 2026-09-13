import { parseFecha, addDays, dayKey } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';

export function crearAgenteRoomingPendiente() {
  return {
    id: 'rooming_pendiente',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const horizonte = dayKey(addDays(fecha, 3));
      const out = [];
      const vistos = new Set();
      for (const rl of contexto.roomingLists || []) {
        if (rl.estado === 'confirmada') continue;
        if (rl.turnoInicio !== horizonte) continue;
        const dest = `emp:${rl.empresaId}`;
        if (vistos.has(dest)) continue;
        vistos.add(dest);
        const emp = (contexto.empresas || []).find((e) => e.id === rl.empresaId);
        const sede = (contexto.sedes || []).find((s) => s.id === rl.sedeId);
        const contacto = emp && emp.contacto ? emp.contacto.nombre.split(' ')[0] : 'equipo';
        const texto = aplicarPlantilla(plantillas.rooming_pendiente, {
          contacto,
          empresa: emp ? emp.nombre : rl.empresaId,
          turnoInicio: rl.turnoInicio,
          sede: sede ? sede.nombre : rl.sedeId,
        });
        const motivo = aplicarPlantilla(plantillas.rooming_tarea, {
          empresa: emp ? emp.nombre : rl.empresaId,
          sede: sede ? sede.nombre : rl.sedeId,
          turnoInicio: rl.turnoInicio,
          estado: rl.estado,
        });
        const persona = {
          id: dest,
          huespedId: dest,
          destinatarioId: dest,
          tenantId: rl.tenantId,
          sedeId: rl.sedeId,
        };
        if (textoValido(texto)) {
          out.push(base('rooming_pendiente', persona, fecha, 'mensaje', 'alta', 'lista pendiente', texto));
        }
        if (textoValido(motivo)) {
          out.push(base('rooming_pendiente', persona, fecha, 'tarea_equipo', 'alta', motivo, null));
        }
      }
      return out;
    },
    indicadores(contexto, fechaRef) {
      const horizonte = dayKey(addDays(parseFecha(fechaRef), 3));
      const n = (contexto.roomingLists || []).filter((r) => r.estado !== 'confirmada' && r.turnoInicio === horizonte).length;
      return { listasPendientes72h: n };
    },
  };
}
