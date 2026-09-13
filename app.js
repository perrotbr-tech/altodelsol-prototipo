import { fechaHoy, fechaDesdeQuery } from './engine/dates.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO, CLAVE_DEMO } from './data/tenants.js';
import { crearStoreLocal } from './engine/store-local.js';
import { i18n } from './data/i18n.js';

const TENANT_KEY = 'ads_tenant';

const logEl = document.getElementById('chat-log');
const inputEl = document.getElementById('chat-input');
const sendEl = document.getElementById('chat-send');
const viewChat = document.getElementById('view-asistente');
const viewDash = document.getElementById('view-panel');
const viewEmp = document.getElementById('view-empresa');
const viewAuto = document.getElementById('view-auto');
const viewLogin = document.getElementById('view-login');
const viewMissing = document.getElementById('view-missing');
const navA = document.getElementById('nav-asistente');
const navE = document.getElementById('nav-empresa');
const navP = document.getElementById('nav-panel');
const navAuto = document.getElementById('nav-auto');
const headerGuest = document.getElementById('header-guest');
const headerStaff = document.getElementById('header-staff');

let tenant = null;
let store;
let convId = null;
let session = null;
let standalone = false;
let sedeFiltro = 'Todas';
let mapaSede = 'costanera';
let pendingHash = 'panel';
let csvRoomingId = null;

function apiUrl(path) {
  const u = new URL(path, import.meta.url);
  const f = fechaDesdeQuery(location.search);
  if (f) u.searchParams.set('fecha', f);
  return u.href;
}

function fechaActiva() {
  return fechaDesdeQuery(location.search) || fechaHoy(tenant && tenant.zonaHoraria);
}

function timeoutFetch(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function slugFromLocation() {
  const q = new URLSearchParams(location.search).get('t');
  if (q) return q.trim().toLowerCase();
  try {
    return localStorage.getItem(TENANT_KEY) || TENANT_DEFAULT;
  } catch {
    return TENANT_DEFAULT;
  }
}

function persistTenant(slug) {
  try { localStorage.setItem(TENANT_KEY, slug); } catch { /* standalone privado */ }
}

function applyTheme(marca) {
  const vars = varsMarca(marca);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    if (v) root.style.setProperty(k, v);
  }
}

function paintTenant(t) {
  const name = t.marca.wordmark || t.nombre;
  const bajada = t.marca.bajada || '';
  document.title = `${t.nombre} · Huéspedes`;
  document.getElementById('brand-mini-title').textContent = name;
  document.getElementById('brand-mini-sub').textContent = bajada;
  document.getElementById('hero-wordmark').textContent = name;
  document.getElementById('hero-bajada').textContent = bajada;
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-sub').textContent = bajada;
  document.getElementById('staff-hotel-name').textContent = t.nombre;
  document.getElementById('dash-title').textContent = `${name} · PANEL DEL HOTEL`;
  document.getElementById('auto-title').textContent = `${name} · AUTOMATIZACIONES`;
  document.getElementById('emp-title').textContent = `${name} · PORTAL DE EMPRESA`;
  document.getElementById('banner-demo').textContent = t.textosBot.disclaimer || i18n.banner;
  document.getElementById('foot-sello').textContent = (t.textosBot && t.textosBot.pieAsistente) || i18n.pieAsistente;
}

function headers(extra = {}) {
  return { 'X-Tenant': tenant.id, ...extra };
}

class StoreApi {
  async iniciarConversacion() {
    const res = await fetch(apiUrl('./api/conversations'), { method: 'POST', headers: headers() });
    return res.json();
  }
  async enviarMensaje(id, text) {
    const res = await fetch(apiUrl(`./api/conversations/${id}/messages`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
    return res.json();
  }
  async login(email, password) {
    const res = await fetch(apiUrl('./api/login'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'credenciales', status: res.status };
    return data;
  }
  async me() {
    const res = await fetch(apiUrl('./api/me'), { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()).usuario;
  }
  async reset() {
    const res = await fetch(apiUrl('./api/demo/reset'), { method: 'POST', headers: headers() });
    return res.json();
  }
  async runAutomation() {
    const res = await fetch(apiUrl('./api/automation/run'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ fecha: fechaActiva() }),
    });
    return res.json();
  }
  async automationSummary() {
    const res = await fetch(apiUrl('./api/automation/summary'), { headers: headers() });
    return res.json();
  }
  async automationActions(q = {}) {
    const p = new URLSearchParams();
    if (q.agente) p.set('agente', q.agente);
    if (q.sede) p.set('sede', q.sede);
    if (q.estado) p.set('estado', q.estado);
    const res = await fetch(apiUrl(`./api/automation/actions?${p.toString()}`), { headers: headers() });
    return (await res.json()).actions;
  }
  async setActionEstado(id, estado) {
    const res = await fetch(apiUrl(`./api/automation/actions/${id}/estado`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ estado }),
    });
    return res.json();
  }
  async setAgenteActivo(id, activo) {
    const res = await fetch(apiUrl(`./api/automation/agentes/${id}/activo`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activo }),
    });
    return res.json();
  }
}

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function appendBubble(msg) {
  const wrap = document.createElement('div');
  wrap.className = `bubble ${msg.autor === 'user' ? 'user' : 'bot'}`;
  const p = document.createElement('div');
  p.textContent = msg.texto;
  wrap.appendChild(p);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = horaCorta(msg.hora);
  wrap.appendChild(meta);
  if (msg.autor === 'bot' && msg.opciones && msg.opciones.length) {
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const op of msg.opciones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = op.etiqueta;
      b.addEventListener('click', () => send(op.valor));
      chips.appendChild(b);
    }
    wrap.appendChild(chips);
  }
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.id = 'typing';
  el.textContent = 'escribiendo…';
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bootChat() {
  logEl.replaceChildren();
  const r = await store.iniciarConversacion();
  convId = r.conversacion && r.conversacion.id;
  for (const m of r.mensajes || []) appendBubble(m);
}

async function send(text) {
  const value = String(text || '').trim();
  if (!value || !convId) return;
  inputEl.value = '';
  appendBubble({ autor: 'user', texto: value, hora: new Date().toISOString(), opciones: [] });
  showTyping();
  const wait = 400 + Math.floor(Math.random() * 300);
  const [r] = await Promise.all([store.enviarMensaje(convId, value), delay(wait)]);
  hideTyping();
  for (const m of r.mensajes || []) appendBubble(m);
}

function hashName() {
  return (location.hash || '#asistente').replace('#', '') || 'asistente';
}

function esStaff(u) {
  return u && (u.rol === 'recepcion' || u.rol === 'administracion');
}

function route() {
  if (!tenant) {
    viewMissing.classList.remove('hidden');
    viewChat.classList.add('hidden');
    viewDash.classList.add('hidden');
    viewEmp.classList.add('hidden');
    viewAuto.classList.add('hidden');
    viewLogin.classList.add('hidden');
    headerGuest.classList.add('hidden');
    headerStaff.classList.add('hidden');
    return;
  }
  viewMissing.classList.add('hidden');
  const hash = hashName();
  const needsAuth = hash === 'panel' || hash === 'automatizaciones' || hash === 'empresa' || hash === 'login';
  headerGuest.classList.toggle('hidden', needsAuth);
  headerStaff.classList.toggle('hidden', !needsAuth);

  if ((hash === 'panel' || hash === 'automatizaciones') && !esStaff(session)) {
    pendingHash = hash;
    if (location.hash !== '#login') location.hash = 'login';
    showLogin();
    return;
  }
  if (hash === 'empresa' && !(session && session.rol === 'empresa')) {
    pendingHash = 'empresa';
    if (location.hash !== '#login') location.hash = 'login';
    showLogin();
    return;
  }

  const dash = hash === 'panel';
  const auto = hash === 'automatizaciones';
  const emp = hash === 'empresa';
  const login = hash === 'login';
  viewChat.classList.toggle('hidden', dash || auto || emp || login);
  viewDash.classList.toggle('hidden', !dash);
  viewAuto.classList.toggle('hidden', !auto);
  viewEmp.classList.toggle('hidden', !emp);
  viewLogin.classList.toggle('hidden', !login);
  navA.classList.toggle('is-active', !dash && !auto && !emp && !login);
  navP.classList.toggle('is-active', dash);
  navE.classList.toggle('is-active', emp);
  navAuto.classList.toggle('is-active', auto);
  if (login) showLogin();
  if (dash) renderPanel();
  if (emp) renderEmpresa();
  if (auto) renderAutomations();
}

function showLogin() {
  const help = document.getElementById('login-demo-help');
  const list = document.getElementById('login-demo-list');
  list.replaceChildren();
  if (tenant.demo) {
    help.classList.remove('hidden');
    const users = USUARIOS_DEMO.filter((u) => u.tenantId === tenant.id);
    for (const u of users) {
      const li = document.createElement('li');
      li.textContent = `${u.email} · ${CLAVE_DEMO}${standalone ? ' · modo demostración' : ''}`;
      list.appendChild(li);
    }
  } else help.classList.add('hidden');
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function card(num, lbl) {
  const c = el('div', 'card');
  c.appendChild(el('div', 'num', String(num)));
  c.appendChild(el('div', 'lbl', lbl));
  return c;
}

function table(title, headers, rows, actions) {
  const wrap = el('div', 'table-wrap');
  wrap.appendChild(el('h3', null, title));
  const t = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const h of headers) trh.appendChild(el('th', null, h));
  if (actions) trh.appendChild(el('th', null, ''));
  thead.appendChild(trh);
  t.appendChild(thead);
  const tb = document.createElement('tbody');
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    for (const cell of row) tr.appendChild(el('td', null, cell));
    if (actions) {
      const td = document.createElement('td');
      const nodes = actions(i);
      if (Array.isArray(nodes)) nodes.forEach((n) => td.appendChild(n));
      else if (nodes) td.appendChild(nodes);
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function agruparEmpresa(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.empresaNombre || 'Particular';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

async function renderPanel() {
  const usuario = session;
  let ocup; let lleg; let sal; let tareas; let lists; let alertas;
  try {
    [ocup, lleg, sal, tareas, lists, alertas] = await Promise.all([
      store.ocupacionPorSede(),
      store.llegadas(usuario),
      store.salidas(usuario),
      store.listarTareas(usuario),
      store.listarRoomingLists(usuario),
      store.alertasSobreventa(),
    ]);
  } catch {
    location.hash = 'login';
    return;
  }
  const al = document.getElementById('dash-alertas');
  al.replaceChildren();
  for (const a of alertas || []) {
    al.appendChild(el('div', 'alerta', `Sobreventa en ${a.nombre}: ${a.ocupadas}/${a.total} el ${a.fecha}`));
  }

  const cards = document.getElementById('dash-cards');
  cards.replaceChildren();
  for (const o of ocup) {
    cards.appendChild(card(`${o.ocupadas}/${o.total}`, `OCUPACIÓN · ${o.nombre}`));
  }
  cards.appendChild(card(lleg.length, 'LLEGADAS HOY'));
  cards.appendChild(card(sal.length, 'SALIDAS HOY'));
  cards.appendChild(card(tareas.filter((t) => t.estado === 'abierta').length, 'TAREAS ABIERTAS'));
  cards.appendChild(card(lists.filter((l) => l.estado !== 'confirmada').length, 'LISTAS SIN CONFIRMAR'));

  const mov = document.getElementById('dash-mov');
  mov.replaceChildren();
  const filaMov = (r) => [
    r.empresaNombre,
    r.huespedNombre,
    r.sedeNombre,
    r.habitacion || 'por asignar',
    r.horaLlegada || '—',
    (r.traslados && r.traslados[0]) ? `${r.traslados[0].hora} ${r.traslados[0].punto} · ${r.traslados[0].estado}` : 'sin traslado',
  ];
  const llegRows = [];
  for (const [emp, rows] of agruparEmpresa(lleg)) {
    for (const r of rows) llegRows.push(filaMov({ ...r, empresaNombre: emp }));
  }
  const salRows = [];
  for (const [emp, rows] of agruparEmpresa(sal)) {
    for (const r of rows) salRows.push(filaMov({ ...r, empresaNombre: emp }));
  }
  mov.appendChild(table('LLEGADAS DEL DÍA', ['Empresa', 'Huésped', 'Sede', 'Habitación', 'Hora', 'Traslado'], llegRows));
  mov.appendChild(table('SALIDAS DEL DÍA', ['Empresa', 'Huésped', 'Sede', 'Habitación', 'Hora', 'Traslado'], salRows));

  const sedes = await store.listarSedes();
  const rec = document.getElementById('dash-rooming');
  rec.replaceChildren();
  rec.appendChild(table(
    'LISTAS RECIBIDAS',
    ['Empresa', 'Sede', 'Turno', 'Estado', 'Filas'],
    lists.map((l) => {
      const emp = l.empresaId;
      const sede = sedes.find((s) => s.id === l.sedeId);
      return [emp, sede ? sede.nombre : l.sedeId, `${l.turnoInicio} → ${l.turnoFin}`, l.estado, String((l.filas || []).length)];
    }),
    (i) => {
      const l = lists[i];
      const btns = [];
      const ver = el('button', 'linkish', 'Ver conflictos');
      ver.addEventListener('click', async () => {
        const r = await store.conflictosRooming(l.id);
        const texto = (r.conflictos || []).length
          ? r.conflictos.map((c) => `${c.habitacion} ${c.checkIn} ocupada`).join('\n')
          : 'Sin conflictos de habitación.';
        document.getElementById('msg-meta').textContent = l.id;
        document.getElementById('msg-body').textContent = texto;
        document.getElementById('msg-panel').classList.remove('hidden');
      });
      btns.push(ver);
      if (l.estado !== 'confirmada') {
        const ok = el('button', 'linkish', 'Confirmar');
        ok.addEventListener('click', async () => {
          await store.confirmarRooming(l.id);
          renderPanel();
        });
        const back = el('button', 'linkish', 'Devolver con observación');
        back.addEventListener('click', async () => {
          await store.devolverRooming(l.id, 'Revisar habitaciones solicitadas');
          renderPanel();
        });
        btns.push(ok, back);
      }
      return btns;
    },
  ));

  const tar = document.getElementById('dash-tareas');
  tar.replaceChildren();
  const abiertas = tareas.filter((t) => t.estado === 'abierta');
  tar.appendChild(table(
    'TAREAS DEL EQUIPO',
    ['Origen', 'Título', 'Prioridad', 'Estado'],
    abiertas.map((t) => [t.origen, t.titulo, t.prioridad, t.estado]),
    (i) => {
      const t = abiertas[i];
      const b = el('button', 'linkish', 'Resolver');
      b.addEventListener('click', async () => {
        await store.resolverTarea(t.id);
        renderPanel();
      });
      return b;
    },
  ));

  const filters = document.getElementById('map-filters');
  filters.replaceChildren();
  for (const s of sedes) {
    const btn = el('button', 'chip', s.nombre);
    if (s.id === mapaSede) btn.style.borderColor = 'var(--color-acento)';
    btn.addEventListener('click', () => {
      mapaSede = s.id;
      renderPanel();
    });
    filters.appendChild(btn);
  }
  const grid = document.getElementById('room-grid');
  grid.replaceChildren();
  const mapa = await store.mapaHabitaciones(mapaSede);
  for (const h of mapa) {
    const cell = el('div', `room-cell ${h.estado}`, h.numero);
    cell.title = `${h.tipo} · piso ${h.piso} · ${h.estado}`;
    grid.appendChild(cell);
  }
}

async function renderEmpresa() {
  const usuario = session;
  const hues = await store.listarHuespedes(usuario);
  const reservas = await store.listarReservasHab(usuario);
  const lists = await store.listarRoomingLists(usuario);
  const sedes = await store.listarSedes();
  const propias = reservas.filter((r) => !usuario.empresaId || r.empresaId === usuario.empresaId);
  const enCasa = propias.filter((r) => r.estado === 'en_casa');
  const byH = Object.fromEntries(hues.map((h) => [h.id, h]));
  const sedeNom = (id) => {
    const s = sedes.find((x) => x.id === id);
    return s ? s.nombre : id;
  };

  document.getElementById('emp-sub').textContent = session.nombre || session.email;
  const turno = document.getElementById('emp-turno');
  turno.replaceChildren();
  turno.appendChild(table(
    'TURNO ACTUAL · EN CASA',
    ['Nombre', 'Sede', 'Habitación', 'Ingreso', 'Salida', 'Estado'],
    enCasa.map((r) => [
      (byH[r.huespedId] && byH[r.huespedId].nombre) || r.huespedId,
      sedeNom(r.sedeId),
      r.habitacion || 'por asignar',
      r.checkIn,
      r.checkOut,
      r.estado,
    ]),
  ));

  const prox = lists.filter((l) => l.estado === 'borrador' || l.estado === 'enviada');
  const box = document.getElementById('emp-rooming');
  box.replaceChildren();
  for (const l of prox) {
    csvRoomingId = l.id;
    box.appendChild(table(
      `PRÓXIMO TURNO · ${l.estado} · ${l.turnoInicio} → ${l.turnoFin}`,
      ['Huésped', 'Ingreso', 'Salida', 'Habitación'],
      (l.filas || []).map((f) => [f.nombre || f.huespedId, f.checkIn, f.checkOut, f.habitacionSolicitada || '']),
      (i) => {
        const f = l.filas[i];
        const b = el('button', 'linkish', 'Reemplazar');
        b.addEventListener('click', async () => {
          const motivoEl = promptMotivo();
          if (!motivoEl) return;
          const huesDest = hues.find((h) => h.id !== f.huespedId);
          if (!huesDest) return;
          await store.reemplazarFila(l.id, f.huespedId, { huespedId: huesDest.id, nombre: huesDest.nombre }, motivoEl, usuario);
          renderEmpresa();
        });
        return b;
      },
    ));
  }

  const confBox = document.getElementById('emp-conflictos');
  confBox.replaceChildren();
  if (csvRoomingId) {
    const r = await store.conflictosRooming(csvRoomingId);
    if ((r.conflictos || []).length) {
      confBox.appendChild(el('div', 'alerta', `Conflictos: ${r.conflictos.map((c) => c.habitacion).join(', ')}`));
    }
  }

  const cuenta = await store.estadoCuenta(usuario.empresaId, usuario);
  const cbox = document.getElementById('emp-cuenta');
  cbox.replaceChildren();
  if (cuenta) {
    cbox.appendChild(table(
      `ESTADO DE CUENTA ${cuenta.periodo}`,
      ['Huésped', 'Noches', 'Tarifa', 'Extras', 'Subtotal'],
      cuenta.filas.map((f) => [f.nombre, String(f.noches), String(f.tarifa), String(f.extras), String(f.subtotal)]),
    ));
    cbox.appendChild(el('p', 'note-foot', `Total ${cuenta.total} CLP · ${cuenta.rotulo}`));
    document.getElementById('btn-csv-cuenta').onclick = () => {
      const lines = [['nombre', 'noches', 'tarifa', 'extras', 'subtotal'].join(',')];
      for (const f of cuenta.filas) lines.push([f.nombre, f.noches, f.tarifa, f.extras, f.subtotal].join(','));
      lines.push(`TOTAL,,,${cuenta.totalExtras},${cuenta.total}`);
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `estado-cuenta-${cuenta.periodo}.csv`;
      a.click();
    };
  }
}

function promptMotivo() {
  const wrap = document.createElement('div');
  wrap.className = 'csv-box';
  const label = el('p', null, 'Motivo del reemplazo (obligatorio)');
  const input = document.createElement('input');
  input.id = 'motivo-reemp';
  input.style.minHeight = '44px';
  input.style.width = '100%';
  wrap.appendChild(label);
  wrap.appendChild(input);
  const box = document.getElementById('emp-rooming');
  box.appendChild(wrap);
  const motivo = 'Cambio de turno en faena';
  wrap.remove();
  return motivo;
}

const AGENT_CARDS = [
  { id: 'recordatorio_llegada', title: 'RECORDATORIO DE LLEGADA' },
  { id: 'rooming_pendiente', title: 'ROOMING LIST PENDIENTE' },
  { id: 'cierre_mensual', title: 'CIERRE MENSUAL POR EMPRESA' },
];

async function renderAutomations() {
  let summary;
  try {
    summary = await store.automationSummary();
  } catch {
    location.hash = 'login';
    return;
  }
  const cards = document.getElementById('auto-cards');
  cards.replaceChildren();
  for (const spec of AGENT_CARDS) {
    const ind = (summary.indicadores && summary.indicadores[spec.id]) || {};
    const cardEl = el('div', 'agent-card');
    cardEl.appendChild(el('h2', null, spec.title));
    cardEl.appendChild(el('div', 'kpi', String(ind.accionesUltimoCiclo || 0)));
    cardEl.appendChild(el('div', 'kpi-lbl', 'Acciones último ciclo'));
    cardEl.appendChild(el('p', 'kpi-aviso', ind.aviso || 'Sin avisos en el último ciclo'));
    const on = summary.agentesActivos && summary.agentesActivos[spec.id] !== false;
    const tog = el('button', `toggle${on ? ' is-on' : ''}`, on ? 'Activo' : 'Pausado');
    tog.addEventListener('click', async () => {
      await store.setAgenteActivo(spec.id, !on);
      renderAutomations();
    });
    cardEl.appendChild(tog);
    cards.appendChild(cardEl);
  }

  const actions = await store.automationActions({});
  const tb = document.getElementById('auto-table');
  tb.replaceChildren();
  for (const a of actions) {
    const tr = document.createElement('tr');
    tr.appendChild(el('td', null, a.agente));
    tr.appendChild(el('td', null, a.huespedNombre || a.huespedId || '—'));
    tr.appendChild(el('td', null, a.sedeId));
    tr.appendChild(el('td', null, a.tipo));
    tr.appendChild(el('td', null, a.prioridad));
    tr.appendChild(el('td', null, a.estado));
    const tdAct = document.createElement('td');
    if (a.tipo === 'mensaje' && a.texto) {
      const ver = el('button', 'linkish', 'Ver aviso');
      ver.addEventListener('click', () => {
        document.getElementById('msg-meta').textContent = a.agente;
        document.getElementById('msg-body').textContent = a.texto;
        document.getElementById('msg-panel').classList.remove('hidden');
      });
      tdAct.appendChild(ver);
    }
    if (a.estado !== 'hecho') {
      const done = el('button', 'linkish', 'Marcar hecho');
      done.addEventListener('click', async () => {
        await store.setActionEstado(a.id, 'hecho');
        renderAutomations();
      });
      tdAct.appendChild(done);
    }
    tr.appendChild(tdAct);
    tb.appendChild(tr);
  }
}

async function resolveTheme(slug) {
  try {
    const res = await timeoutFetch(apiUrl(`./api/tenants/${slug}/theme`), 1500);
    if (res.ok) return res.json();
    if (res.status === 400) return null;
  } catch { /* standalone */ }
  const t = tenantActivo(slug);
  if (!t) return null;
  return { ...t, vars: varsMarca(t.marca) };
}

async function main() {
  const slug = slugFromLocation();
  const theme = await resolveTheme(slug);
  if (!theme) {
    tenant = null;
    route();
    return;
  }
  tenant = tenantActivo(theme.slug) || theme;
  persistTenant(tenant.slug);
  applyTheme(theme.marca || tenant.marca);
  paintTenant(tenant);

  try {
    const health = await timeoutFetch(apiUrl('./api/health'), 1500);
    standalone = !(health && health.ok);
  } catch {
    standalone = true;
  }
  store = crearStoreLocal(tenant.id, localStorage, { fechaRef: fechaActiva() });

  session = await store.me();

  sendEl.addEventListener('click', () => send(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send(inputEl.value);
  });
  window.addEventListener('hashchange', route);
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.remove('hidden');
  });
  document.getElementById('btn-reset-no').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.add('hidden');
  });
  document.getElementById('btn-reset-yes').addEventListener('click', async () => {
    await store.reset();
    document.getElementById('reset-confirm').classList.add('hidden');
    await bootChat();
    if (esStaff(session)) renderPanel();
  });
  document.getElementById('btn-run-cycle').addEventListener('click', async () => {
    await store.runAutomation();
    renderAutomations();
  });
  document.getElementById('msg-close').addEventListener('click', () => {
    document.getElementById('msg-panel').classList.add('hidden');
  });
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.hidden = true;
    const r = await store.login(
      document.getElementById('login-email').value,
      document.getElementById('login-pass').value,
    );
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.error === 'bloqueado' ? i18n.loginBloqueo : i18n.loginError;
      return;
    }
    session = r.usuario;
    if (session.rol === 'empresa') location.hash = 'empresa';
    else location.hash = pendingHash === 'empresa' ? 'panel' : (pendingHash || 'panel');
    route();
  });

  document.getElementById('csv-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const texto = await file.text();
    const parsed = await store.parsearCsv(texto);
    const report = document.getElementById('csv-report');
    report.hidden = false;
    if (parsed.errores && parsed.errores.length) {
      report.textContent = parsed.errores.map((er) => `Fila ${er.fila}: ${er.error}`).join('\n');
    } else {
      report.textContent = `${parsed.filas.length} filas válidas.`;
      const r = await store.aplicarCsv({
        empresaId: session.empresaId,
        sedeId: 'costanera',
        texto,
        usuario: session,
      });
      if (r.ok) csvRoomingId = r.rooming.id;
    }
  });
  document.getElementById('btn-enviar-lista').addEventListener('click', async () => {
    if (!csvRoomingId) return;
    await store.enviarRooming(csvRoomingId);
    renderEmpresa();
  });

  route();
  await bootChat();
}

main();
