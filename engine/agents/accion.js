import { parseFecha } from '../dates.js';

export function baseAccion(agente, persona, fecha, tipo, prioridad, motivo, texto) {
  const huespedId = persona && (persona.huespedId || persona.id) || null;
  return {
    id: null,
    tenantId: (persona && persona.tenantId) || null,
    agente,
    tipo,
    huespedId,
    socioId: huespedId,
    destinatarioId: (persona && persona.destinatarioId) || huespedId,
    canal: 'simulado',
    texto,
    motivo,
    prioridad,
    estado: 'pendiente',
    fechaISO: parseFecha(fecha).toISOString(),
    sedeId: (persona && (persona.sedeId || persona.sede)) || '',
  };
}

export { baseAccion as base };
