/**
 * Plantillas de automatización. Placeholders se rellenan en el motor.
 * El texto generado NO puede contener "{" "}".
 */

export const plantillas = {
  recordatorio_llegada:
    'Hola {nombre}, mañana te esperamos en {sede} ({direccion}). Check-in desde las {horaCheckIn}. Traslado: {traslado}.',
  rooming_pendiente:
    'Hola {contacto}, falta confirmar la lista de {empresa} para el turno que parte el {turnoInicio} en {sede}.',
  rooming_tarea:
    'Confirmar lista de {empresa} para {sede}, turno {turnoInicio}. Estado actual: {estado}.',
  cierre_mensual:
    'Hola {contacto}, el estado de cuenta de {empresa} ({periodo}) está listo: {noches} noches, total {total} CLP. La factura la emite el hotel.',
};

export function aplicarPlantilla(tpl, vars) {
  let out = String(tpl || '');
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{${k}}`).join(v == null ? '' : String(v));
  }
  out = out.replace(/\{[a-zA-Z]+\}/g, '').replace(/[ \t]+/g, ' ').trim();
  return out;
}

export function textoValido(texto, { allowDollar = false } = {}) {
  if (!texto) return true;
  if (texto.includes('{') || texto.includes('}')) return false;
  if (/\bpromo\b/i.test(texto)) return false;
  if (!allowDollar && texto.includes('$')) return false;
  return true;
}
