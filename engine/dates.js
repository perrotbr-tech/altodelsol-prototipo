/** Utilidades de fecha. Zona por tenant (Chile: America/Santiago). Sin DOM. */

export const ZONA_DEFAULT = 'America/Santiago';

export function fechaEnZona(date = new Date(), zona = ZONA_DEFAULT) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona || ZONA_DEFAULT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

export function fechaHoy(zona = ZONA_DEFAULT) {
  return fechaEnZona(new Date(), zona);
}

export function fechaDesdeQuery(search) {
  const raw = String(search || '');
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw).get('fecha');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return null;
}

export function parseFecha(ref) {
  if (ref instanceof Date) {
    return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 12, 0, 0));
  }
  const s = String(ref || fechaHoy()).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDays(ref, n) {
  const d = parseFecha(ref);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function dayKey(ref) {
  return parseFecha(ref).toISOString().slice(0, 10);
}

export function daysAgo(visitISO, fechaRef) {
  const v = parseFecha(visitISO);
  const e = parseFecha(fechaRef);
  return Math.round((e - v) / 86400000);
}

export function weekdayEs(ref) {
  const d = parseFecha(ref);
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getUTCDay()];
}

export function dayNum(ref) {
  return parseFecha(ref).getUTCDate();
}

export function enVentana(visitISO, fechaRef, days) {
  const ago = daysAgo(visitISO, fechaRef);
  return ago >= 0 && ago < days;
}

export function anioDe(ref) {
  return String(parseFecha(ref).getUTCFullYear());
}
