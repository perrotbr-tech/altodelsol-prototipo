/**
 * Comprensión de lenguaje (demo local, sin LLM).
 */

export const INTENCIONES = Object.freeze({
  MI_RESERVA: 'mi_reserva',
  LLEGADA: 'llegada',
  TRASLADO: 'traslado',
  DESAYUNO_WIFI: 'desayuno_wifi',
  EXTENDER: 'extender',
  CAMBIO_HABITACION: 'cambio_habitacion',
  FACTURA: 'factura',
  RECLAMO: 'reclamo',
  TURISTA: 'turista',
  MENU: 'menu',
  AYUDA: 'ayuda',
  DESCONOCIDA: 'desconocida',
});

export function crearIntentService() {
  return {
    detectar(texto) {
      const t = normalizar(texto);
      if (!t) return pack(INTENCIONES.DESCONOCIDA, 0);
      if (t === 'menu' || t === 'inicio' || t === 'volver') return pack(INTENCIONES.MENU, 1);
      if (t === 'ayuda' || t === 'help') return pack(INTENCIONES.AYUDA, 0.8);
      if (esReclamo(t)) return pack(INTENCIONES.RECLAMO, 0.92);
      if (esFactura(t)) return pack(INTENCIONES.FACTURA, 0.9);
      if (esCambio(t)) return pack(INTENCIONES.CAMBIO_HABITACION, 0.9);
      if (esExtender(t)) return pack(INTENCIONES.EXTENDER, 0.9);
      if (esTurista(t)) return pack(INTENCIONES.TURISTA, 0.9);
      if (esTraslado(t)) return pack(INTENCIONES.TRASLADO, 0.9);
      if (esDesayuno(t)) return pack(INTENCIONES.DESAYUNO_WIFI, 0.9);
      if (esLlegada(t)) return pack(INTENCIONES.LLEGADA, 0.9);
      if (esReserva(t)) return pack(INTENCIONES.MI_RESERVA, 0.9);
      return pack(INTENCIONES.DESCONOCIDA, 0.2);
    },
  };
}

function pack(intencion, confianza) {
  return { intencion, entidades: {}, confianza };
}

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿?¡!.,;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tiene(t, frases) {
  return frases.some((f) => t.includes(f));
}

function esReserva(t) {
  return tiene(t, ['mi reserva', 'consultar reserva', 'ver reserva', 'habitacion asignada', 'donde me aloj']);
}

function esLlegada(t) {
  return tiene(t, ['llegada', 'estoy llegando', 'hora de llegada', 'llego a las', 'check in', 'checkin']);
}

function esTraslado(t) {
  return tiene(t, ['traslado', 'transfer', 'aeropuerto', 'van', 'bus de llegada']);
}

function esDesayuno(t) {
  return tiene(t, ['desayuno', 'wifi', 'wi fi', 'clave wifi', 'internet', 'contraseña wifi']);
}

function esExtender(t) {
  return tiene(t, ['extender', 'una noche mas', 'quedarme un dia', 'alargar estadia', 'noche extra']);
}

function esCambio(t) {
  return tiene(t, ['cambio de habitacion', 'cambiar habitacion', 'otra habitacion', 'cambiar de pieza']);
}

function esFactura(t) {
  return tiene(t, ['factura', 'boleta', 'estado de cuenta', 'cobro']);
}

function esReclamo(t) {
  return tiene(t, ['reclamo', 'queja', 'no funciona', 'problema', 'aire', 'ruido', 'sucio']);
}

function esTurista(t) {
  return tiene(t, ['turista', 'sin reserva', 'quiero reservar', 'hay habitacion', 'disponibilidad']);
}
