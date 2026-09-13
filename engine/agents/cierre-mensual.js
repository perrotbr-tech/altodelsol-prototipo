import { parseFecha, dayKey } from '../dates.js';
import { plantillas, aplicarPlantilla, textoValido } from '../../data/templates.js';
import { base } from './accion.js';
import { nochesEnMes } from '../store.js';

export function crearAgenteCierreMensual() {
  return {
    id: 'cierre_mensual',
    evaluar(contexto, fechaRef) {
      const fecha = parseFecha(fechaRef);
      const periodo = dayKey(fecha).slice(0, 7);
      const out = [];
      const vistos = new Set();
      for (const emp of contexto.empresas || []) {
        if (!emp.activa) continue;
        const dest = `emp:${emp.id}`;
        if (vistos.has(dest)) continue;
        vistos.add(dest);
        const tarifa = emp.convenio && emp.convenio.tarifaNoche ? emp.convenio.tarifaNoche : 0;
        const reservas = (contexto.reservas || []).filter((r) => r.empresaId === emp.id && r.estado !== 'cancelada' && r.estado !== 'no_show');
        let noches = 0;
        let extras = 0;
        for (const r of reservas) {
          noches += nochesEnMes(r.checkIn, r.checkOut, periodo);
          extras += (r.extras || []).reduce((acc, x) => acc + Number(x.monto || 0), 0);
        }
        const total = noches * tarifa + extras;
        const contacto = emp.contacto ? emp.contacto.nombre.split(' ')[0] : 'equipo';
        const texto = aplicarPlantilla(plantillas.cierre_mensual, {
          contacto,
          empresa: emp.nombre,
          periodo,
          noches: String(noches),
          total: String(total),
        });
        if (!textoValido(texto)) continue;
        out.push(base(
          'cierre_mensual',
          { id: dest, huespedId: dest, destinatarioId: dest, tenantId: emp.tenantId, sedeId: emp.sedeHabitualId || '' },
          fecha,
          'mensaje',
          'media',
          'cierre mensual',
          texto,
        ));
      }
      return out;
    },
    indicadores(contexto) {
      return { empresasActivas: (contexto.empresas || []).filter((e) => e.activa).length };
    },
  };
}
