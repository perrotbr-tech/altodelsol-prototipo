/** Configuración del tenant demo. Textos visibles al usuario viven aquí o en i18n. */

export const TENANT_DEFAULT = 'altodelsol';

export const tenants = [
  {
    id: 'altodelsol',
    slug: 'altodelsol',
    nombre: 'Hotel Alto del Sol',
    pais: 'CL',
    moneda: 'CLP',
    zonaHoraria: 'America/Santiago',
    idioma: 'es-CL',
    codigoPrefix: 'ADS',
    demo: true,
    activo: true,
    marca: {
      colorFondo: '#0F1F33',
      colorSuperficie: '#16304B',
      colorPanel: '#1B3A58',
      colorAcento: '#D9B36A',
      colorAcentoSecundario: '#3DA5D9',
      colorTexto: '#F4F1EA',
      colorTextoMuted: '#B7C0C9',
      colorOnAcento: '#0F1F33',
      wordmark: 'ALTO DEL SOL',
      bajada: 'HUÉSPEDES CORPORATIVOS',
      logoTexto: 'ALTO DEL SOL',
      wordmarkItalic: false,
      letterSpacing: '3px',
      fontWeight: '800',
    },
    textosBot: {
      bienvenida: 'Hola, soy el asistente de Hotel Alto del Sol. Te ayudo con tu llegada, traslado, desayuno y solicitudes. ¿Qué necesitas?',
      despedida: 'Gracias por escribirnos. Recepción sigue atenta.',
      disclaimer: 'Datos demostrativos · prototipo',
      lookupEjemplo: 'ADS-2026-0001',
      pieAsistente: 'Prototipo · Perrot Tech',
      checkIn: '14:00',
      checkOut: '12:00',
    },
    sedes: [
      {
        id: 'costanera',
        nombre: 'Antofagasta Costanera',
        direccion: 'Av. Grecia 1001, Antofagasta',
        habitacionesPublicadas: 48,
        demostrativa: false,
        desayuno: '06:30 a 09:30',
        wifiRed: 'ADS-Costanera',
        wifiClave: 'SolCostanera26',
      },
      {
        id: 'angamos',
        nombre: 'Antofagasta Angamos',
        direccion: 'Av. Angamos 01451, Antofagasta',
        habitacionesPublicadas: 30,
        demostrativa: true,
        desayuno: '06:30 a 09:30',
        wifiRed: 'ADS-Angamos',
        wifiClave: 'SolAngamos26',
      },
      {
        id: 'mejillones',
        nombre: 'Mejillones',
        direccion: 'Av. San Martín 450, Mejillones',
        habitacionesPublicadas: 24,
        demostrativa: true,
        desayuno: '06:30 a 09:30',
        wifiRed: 'ADS-Mejillones',
        wifiClave: 'SolMejillones26',
      },
    ],
  },
];

export function listarTenants() {
  return tenants.map((t) => ({
    ...t,
    marca: { ...t.marca },
    textosBot: { ...t.textosBot },
    sedes: t.sedes.map((s) => ({ ...s })),
  }));
}

export function buscarTenant(slug) {
  const key = String(slug || '').trim().toLowerCase();
  return tenants.find((t) => t.slug === key || t.id === key) || null;
}

export function tenantActivo(slug) {
  const t = buscarTenant(slug);
  return t && t.activo ? t : null;
}

export function varsMarca(marca) {
  const m = marca || {};
  return {
    '--color-fondo': m.colorFondo,
    '--color-superficie': m.colorSuperficie,
    '--color-panel': m.colorPanel,
    '--color-acento': m.colorAcento,
    '--color-acento-2': m.colorAcentoSecundario,
    '--color-texto': m.colorTexto,
    '--color-texto-muted': m.colorTextoMuted,
    '--color-on-acento': m.colorOnAcento,
    '--wordmark-spacing': m.letterSpacing || '3px',
    '--wordmark-weight': m.fontWeight || '800',
  };
}

export const USUARIOS_DEMO = [
  {
    tenantId: 'altodelsol',
    email: 'recepcion@altodelsol.demo',
    nombre: 'Recepción Alto del Sol',
    rol: 'recepcion',
  },
  {
    tenantId: 'altodelsol',
    email: 'admin@altodelsol.demo',
    nombre: 'Administración Alto del Sol',
    rol: 'administracion',
  },
  {
    tenantId: 'altodelsol',
    email: 'coordinador@mineranorte.demo',
    nombre: 'Coordinador Minera Norte',
    rol: 'empresa',
    empresaId: 'emp-norte',
  },
];

export const CLAVE_DEMO = 'demo1234';
