import { crearEngine } from './conversation.js';
import { crearAutomation } from './automation.js';
import { clonarDemo } from '../data/demo.js';
import { fechaHoy } from './dates.js';
import { USUARIOS_DEMO, CLAVE_DEMO } from '../data/tenants.js';

export function claveEstado(tenantId) {
  return `ads_demo_state_${tenantId}`;
}

export function crearStoreLocal(tenantId, storage, opts = {}) {
  const fechaRef = opts.fechaRef || fechaHoy();
  const KEY = claveEstado(tenantId);
  let datos = clonarDemo(tenantId, fechaRef);
  try {
    const raw = storage.getItem(KEY);
    if (raw) datos = JSON.parse(raw);
  } catch {
    datos = clonarDemo(tenantId, fechaRef);
  }
  const engine = crearEngine(datos, tenantId, { fechaRef });
  const auto = crearAutomation(datos, tenantId);

  function persist() {
    const slice = engine.exportar();
    const a = auto.exportar();
    slice.automation = a.automation;
    storage.setItem(KEY, JSON.stringify(slice));
  }

  persist();

  function mem() {
    return engine.memoria;
  }

  return {
    engine,
    auto,
    persist,
    async iniciarConversacion() {
      const r = engine.iniciar();
      persist();
      return r;
    },
    async enviarMensaje(id, text) {
      const r = engine.procesar(id, text);
      persist();
      return r;
    },
    async listarReservasHab(usuario) { return mem().listarReservasHab(tenantId, usuario); },
    async listarHuespedes(usuario) { return mem().listarHuespedes(tenantId, usuario); },
    async listarEmpresas(usuario) { return mem().listarEmpresas(tenantId, usuario); },
    async listarSedes() { return mem().listarSedes(tenantId); },
    async listarTareas(usuario) { return mem().listarTareas(tenantId, usuario); },
    async listarRoomingLists(usuario) { return mem().listarRoomingLists(tenantId, usuario); },
    async listarConversaciones() { return engine.listarConversaciones(); },
    async ocupacionPorSede() { return mem().ocupacionPorSede(tenantId, fechaRef); },
    async alertasSobreventa() { return mem().alertasSobreventa(tenantId, fechaRef); },
    async mapaHabitaciones(sedeId) { return mem().mapaHabitaciones(tenantId, sedeId, fechaRef); },
    async llegadas(usuario) { return mem().movimientoDelDia(tenantId, fechaRef, 'llegada', usuario); },
    async salidas(usuario) { return mem().movimientoDelDia(tenantId, fechaRef, 'salida', usuario); },
    async estadoCuenta(empresaId, usuario) { return mem().estadoCuenta(tenantId, empresaId, fechaRef, usuario); },
    async confirmarRooming(id) {
      const r = mem().confirmarRoomingList(tenantId, id, fechaRef);
      persist();
      return r;
    },
    async devolverRooming(id, observacion) {
      const r = mem().devolverRooming(tenantId, id, observacion);
      persist();
      return r;
    },
    async enviarRooming(id) {
      const r = mem().enviarRooming(tenantId, id);
      persist();
      return r;
    },
    async conflictosRooming(id) {
      const rl = mem().getRooming(tenantId, id);
      if (!rl) return { conflictos: [] };
      return { conflictos: mem().detectarConflictosRooming(tenantId, rl) };
    },
    async parsearCsv(texto) { return mem().parsearCsvRooming(texto); },
    async aplicarCsv(opts) {
      const r = mem().aplicarCsvEmpresa(tenantId, opts);
      persist();
      return r;
    },
    async reemplazarFila(roomingId, huespedId, nuevo, motivo, usuario) {
      const r = mem().reemplazarFilaRooming(tenantId, roomingId, huespedId, nuevo, motivo, usuario);
      persist();
      return r;
    },
    async resolverTarea(id) {
      const r = mem().resolverTarea(tenantId, id);
      persist();
      return r;
    },
    async reset() {
      engine.reset();
      auto.reset();
      persist();
      return { ok: true };
    },
    async runAutomation() {
      const campania = auto.ejecutarCiclo(fechaRef);
      persist();
      return { ok: true, campania, summary: auto.summary(fechaRef) };
    },
    async automationSummary() { return auto.summary(fechaRef); },
    async automationActions(q = {}) { return auto.listarAcciones(q); },
    async setActionEstado(id, estado) {
      const action = auto.setEstado(id, estado);
      persist();
      return { action };
    },
    async setAgenteActivo(id, activo) {
      const agentesActivos = auto.setAgenteActivo(id, activo);
      persist();
      return { agentesActivos };
    },
    async login(email, password) {
      const lockKey = 'ads_login_lock';
      let lock = {};
      try { lock = JSON.parse(storage.getItem(lockKey) || '{}'); } catch { lock = {}; }
      const k = `${tenantId}:${String(email || '').trim().toLowerCase()}`;
      const row = lock[k] || { fallos: 0, lockedUntil: 0 };
      if (row.lockedUntil && row.lockedUntil > Date.now()) return { ok: false, error: 'bloqueado', status: 429 };
      const user = USUARIOS_DEMO.find((u) => u.tenantId === tenantId && u.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user || password !== CLAVE_DEMO) {
        row.fallos += 1;
        if (row.fallos >= 5) row.lockedUntil = Date.now() + 10 * 60 * 1000;
        lock[k] = row;
        storage.setItem(lockKey, JSON.stringify(lock));
        return { ok: false, error: row.fallos >= 5 ? 'bloqueado' : 'credenciales', status: row.fallos >= 5 ? 429 : 401 };
      }
      delete lock[k];
      storage.setItem(lockKey, JSON.stringify(lock));
      const usuario = {
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        tenantId: user.tenantId,
        empresaId: user.empresaId || null,
      };
      storage.setItem('ads_session', JSON.stringify(usuario));
      return { ok: true, usuario };
    },
    async me() {
      try {
        const raw = storage.getItem('ads_session');
        if (!raw) return null;
        const u = JSON.parse(raw);
        return u.tenantId === tenantId ? u : null;
      } catch {
        return null;
      }
    },
  };
}

export function crearStorageMemoria() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
  };
}
