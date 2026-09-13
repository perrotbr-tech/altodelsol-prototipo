import express from 'express';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarMundo, clonar } from '../data/demo.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO } from '../data/tenants.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { crearMemoria } from '../engine/store.js';
import { fechaHoy, fechaDesdeQuery } from '../engine/dates.js';
import {
  COOKIE, parseCookies, firmarSesion, leerSesion, cookieSesion, cookieLogout,
  intentarLogin, usuariosConHash, hashClave, resetLocks,
} from '../engine/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

const SESSION_SECRET = process.env.SESSION_SECRET || 'ads-demo-hmac';
const HASH_DEMO = hashClave('demo1234');

function loadState() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    const seed = clonarMundo();
    writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  if (!parsed.byTenant) {
    const seed = clonarMundo();
    writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return parsed;
}

export function crearApp({ mundo = null, persist = true, sessionSecret = SESSION_SECRET } = {}) {
  let state = mundo ? clonar(mundo) : loadState();
  const memoria = crearMemoria(state);
  const engines = {
    [TENANT_DEFAULT]: crearEngine({ memoria }, TENANT_DEFAULT),
  };
  const autos = {
    [TENANT_DEFAULT]: crearAutomation(memoria.sliceExport(TENANT_DEFAULT), TENANT_DEFAULT),
  };
  const usuarios = usuariosConHash(HASH_DEMO);
  const secret = sessionSecret;

  function saveState() {
    const snap = memoria.snapshot();
    for (const id of Object.keys(autos)) {
      const a = autos[id].exportar();
      if (snap.byTenant[id]) {
        snap.byTenant[id].huespedes = a.huespedes;
        snap.byTenant[id].reservaHab = a.reservaHab;
        snap.byTenant[id].automation = a.automation;
      }
    }
    state = snap;
    if (persist) {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(snap, null, 2));
    }
  }

  function tenantOf(req) {
    const slug = req.get('X-Tenant') || TENANT_DEFAULT;
    return tenantActivo(slug);
  }

  function fechaDeReq(req) {
    const q = (req.query && req.query.fecha) || (req.body && req.body.fecha);
    return fechaDesdeQuery(`fecha=${q || ''}`) || fechaHoy(req.tenant && req.tenant.zonaHoraria);
  }

  function requireTenant(req, res, next) {
    const t = tenantOf(req);
    if (!t) return res.status(400).json({ error: 'tenant_not_found' });
    req.tenant = t;
    req.engine = engines[t.id];
    req.auto = autos[t.id];
    if (req.engine && req.engine.setFechaRef) req.engine.setFechaRef(fechaDeReq(req));
    next();
  }

  function sesionDe(req) {
    const cookies = parseCookies(req.headers.cookie);
    const payload = leerSesion(cookies[COOKIE], secret);
    if (!payload || !payload.email) return null;
    return payload;
  }

  function requireAuth(req, res, next) {
    const s = sesionDe(req);
    if (!s || s.tenantId !== req.tenant.id) return res.status(401).json({ error: 'unauthorized' });
    req.usuario = s;
    next();
  }

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'api' });
  });

  app.get('/api/tenants/:slug/theme', (req, res) => {
    const t = tenantActivo(req.params.slug);
    if (!t) return res.status(400).json({ error: 'tenant_not_found' });
    res.json({
      slug: t.slug,
      nombre: t.nombre,
      marca: t.marca,
      textosBot: t.textosBot,
      demo: t.demo,
      vars: varsMarca(t.marca),
      sedes: t.sedes,
    });
  });

  app.post('/api/login', requireTenant, (req, res) => {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const r = intentarLogin({
      tenantId: req.tenant.id,
      email,
      password,
      usuarios,
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    const token = firmarSesion({ ...r.usuario, iat: Date.now() }, secret);
    res.setHeader('Set-Cookie', cookieSesion(token));
    res.json({ ok: true, usuario: r.usuario });
  });

  app.post('/api/logout', requireTenant, (_req, res) => {
    res.setHeader('Set-Cookie', cookieLogout());
    res.json({ ok: true });
  });

  app.get('/api/me', requireTenant, (req, res) => {
    const s = sesionDe(req);
    if (!s || s.tenantId !== req.tenant.id) return res.status(401).json({ error: 'unauthorized' });
    res.json({
      usuario: {
        email: s.email, nombre: s.nombre, rol: s.rol, tenantId: s.tenantId, empresaId: s.empresaId || null,
      },
    });
  });

  app.post('/api/conversations', requireTenant, (req, res) => {
    const result = req.engine.iniciar();
    saveState();
    res.json(result);
  });

  app.post('/api/conversations/:id/messages', requireTenant, (req, res) => {
    const text = req.body && req.body.text;
    const result = req.engine.procesar(req.params.id, text);
    saveState();
    res.json(result);
  });

  app.get('/api/reservas', requireTenant, requireAuth, (req, res) => {
    res.json({ reservas: memoria.listarReservasHab(req.tenant.id, req.usuario) });
  });

  app.get('/api/conversations', requireTenant, requireAuth, (req, res) => {
    res.json({ conversations: req.engine.listarConversaciones() });
  });

  app.post('/api/demo/reset', requireTenant, requireAuth, (req, res) => {
    const seed = clonarMundo();
    memoria.hidratar(seed);
    engines[TENANT_DEFAULT] = crearEngine({ memoria }, TENANT_DEFAULT);
    autos[TENANT_DEFAULT] = crearAutomation(memoria.sliceExport(TENANT_DEFAULT), TENANT_DEFAULT);
    saveState();
    res.json({ ok: true });
  });

  app.post('/api/automation/run', requireTenant, requireAuth, (req, res) => {
    const fecha = fechaDeReq(req);
    const campania = req.auto.ejecutarCiclo(fecha);
    saveState();
    res.json({ ok: true, campania, summary: req.auto.summary(fecha) });
  });

  app.get('/api/automation/summary', requireTenant, requireAuth, (req, res) => {
    res.json(req.auto.summary(fechaDeReq(req)));
  });

  app.get('/api/automation/actions', requireTenant, requireAuth, (req, res) => {
    res.json({
      actions: req.auto.listarAcciones({
        agente: req.query.agente,
        sede: req.query.sede,
        estado: req.query.estado,
      }),
    });
  });

  app.post('/api/automation/actions/:id/estado', requireTenant, requireAuth, (req, res) => {
    const acc = req.auto.setEstado(req.params.id, req.body && req.body.estado);
    if (!acc) return res.status(404).json({ error: 'not found' });
    saveState();
    res.json({ action: acc });
  });

  app.post('/api/automation/agentes/:id/activo', requireTenant, requireAuth, (req, res) => {
    const activos = req.auto.setAgenteActivo(req.params.id, req.body && req.body.activo);
    saveState();
    res.json({ agentesActivos: activos });
  });

  app.use(express.static(ROOT));

  return {
    app,
    memoria,
    engines,
    autos,
    saveState,
    resetLocks,
    usuarios,
    demoUsers: USUARIOS_DEMO,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app } = crearApp();
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  app.listen(port, () => {
    console.log(`Alto del Sol prototipo en http://localhost:${port}`);
  });
}
