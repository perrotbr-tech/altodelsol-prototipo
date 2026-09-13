import { parseFecha, addDays, dayKey } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';

export function crearAgenteRecordatorioLlegada() {
  return {
    id: 'recordatorio_llegada',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const manana = dayKey(addDays(fecha, 1));
      const out = [];
      const vistos = new Set();
      for (const r of contexto.reservas || []) {
        if (r.checkIn !== manana || r.estado === 'cancelada' || r.estado === 'no_show') continue;
        const key = r.huespedId;
        if (vistos.has(key)) continue;
        vistos.add(key);
        const h = (contexto.huespedes || []).find((x) => x.id === r.huespedId);
        const sede = (contexto.sedes || []).find((s) => s.id === r.sedeId);
        const tras = (contexto.traslados || []).find((t) => t.reservaHabId === r.id && t.tipo === 'llegada');
        const trasladoTxt = tras
          ? `${tras.hora} desde ${tras.punto} (${tras.estado})`
          : 'sin traslado programado; coordina con recepción';
        const texto = aplicarPlantilla(plantillas.recordatorio_llegada, {
          nombre: h ? h.nombre.split(' ')[0] : 'huésped',
          sede: sede ? sede.nombre : r.sedeId,
          direccion: sede ? sede.direccion : '',
          horaCheckIn: r.horaLlegada || (contexto.checkInHora || '14:00'),
          traslado: trasladoTxt,
        });
        if (!textoValido(texto)) continue;
        out.push(base(
          'recordatorio_llegada',
          { ...h, id: r.huespedId, sedeId: r.sedeId, tenantId: r.tenantId },
          fecha,
          'mensaje',
          'media',
          'recordatorio de llegada',
          texto,
        ));
      }
      return out;
    },
    indicadores(contexto, fechaRef) {
      const manana = dayKey(addDays(parseFecha(fechaRef), 1));
      const n = (contexto.reservas || []).filter((r) => r.checkIn === manana && r.estado !== 'cancelada').length;
      return { llegadasManana: n };
    },
  };
}
