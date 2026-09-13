import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { USUARIOS_DEMO, CLAVE_DEMO } from '../data/tenants.js';

export const LOCK_MS = 10 * 60 * 1000;
export const MAX_FALLOS = 5;
export const COOKIE = 'ads_session';

const locks = new Map();

export function claveLock(tenantId, email) {
  return `${tenantId}:${String(email || '').trim().toLowerCase()}`;
}

export function estadoBloqueo(tenantId, email, now = Date.now()) {
  const row = locks.get(claveLock(tenantId, email));
  if (!row) return { fallos: 0, lockedUntil: 0, bloqueado: false };
  if (row.lockedUntil && row.lockedUntil > now) return { ...row, bloqueado: true };
  if (row.lockedUntil && row.lockedUntil <= now) {
    locks.delete(claveLock(tenantId, email));
    return { fallos: 0, lockedUntil: 0, bloqueado: false };
  }
  return { ...row, bloqueado: false };
}

export function registrarFallo(tenantId, email, now = Date.now()) {
  const k = claveLock(tenantId, email);
  const prev = locks.get(k) || { fallos: 0, lockedUntil: 0 };
  const fallos = prev.fallos + 1;
  const lockedUntil = fallos >= MAX_FALLOS ? now + LOCK_MS : 0;
  const row = { fallos, lockedUntil };
  locks.set(k, row);
  return { ...row, bloqueado: lockedUntil > now };
}

export function limpiarFallos(tenantId, email) {
  locks.delete(claveLock(tenantId, email));
}

export function resetLocks() {
  locks.clear();
}

export function hashClave(clave) {
  return bcrypt.hashSync(clave, 10);
}

export function verificarClave(clave, hash) {
  if (!hash) return clave === CLAVE_DEMO;
  return bcrypt.compareSync(String(clave || ''), hash);
}

export function usuariosConHash(hash) {
  return USUARIOS_DEMO.map((u) => ({
    tenantId: u.tenantId,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    empresaId: u.empresaId || null,
    hash,
  }));
}

export function buscarUsuario(lista, tenantId, email) {
  const e = String(email || '').trim().toLowerCase();
  return (lista || []).find((u) => u.tenantId === tenantId && String(u.email).toLowerCase() === e) || null;
}

export function firmarSesion(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function leerSesion(token, secret) {
  if (!token || !String(token).includes('.')) return null;
  const [body, sig] = String(token).split('.');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function cookieSesion(token) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`;
}

export function cookieLogout() {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function intentarLogin({ tenantId, email, password, usuarios, now = Date.now() }) {
  const lock = estadoBloqueo(tenantId, email, now);
  if (lock.bloqueado) {
    return { ok: false, error: 'bloqueado', status: 429, lock };
  }
  const user = buscarUsuario(usuarios, tenantId, email);
  if (!user || !verificarClave(password, user.hash)) {
    const next = registrarFallo(tenantId, email, now);
    return { ok: false, error: next.bloqueado ? 'bloqueado' : 'credenciales', status: next.bloqueado ? 429 : 401, lock: next };
  }
  limpiarFallos(tenantId, email);
  return {
    ok: true,
    usuario: {
      tenantId: user.tenantId,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      empresaId: user.empresaId || null,
    },
  };
}

export function nonce() {
  return randomBytes(8).toString('hex');
}
