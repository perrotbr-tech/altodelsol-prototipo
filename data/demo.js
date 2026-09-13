import { listarTenants, TENANT_DEFAULT } from './tenants.js';
import { addDays, dayKey, fechaHoy } from '../engine/dates.js';

export const TEL_HUESPED_NORTE = '+56911110001';
export const TEL_TURISTA_SIN_RESERVA = '+56919990006';

const NOMBRES_NORTE = [
  'Patricia Soto', 'Luis Araya', 'Camila Rojas', 'Jorge Muñoz', 'Andrea Vargas',
  'Héctor Palma', 'Daniela Núñez', 'Ricardo Tapia', 'Valentina Lagos', 'Mario Contreras',
  'Claudia Fuentes', 'Pedro Salinas', 'Francisca Ortiz', 'Gonzalo Paredes', 'Isabel Castro',
  'Rodrigo Vega', 'Natalia Herrera', 'Felipe Carrasco',
];
const NOMBRES_ANDES = [
  'Marcela Díaz', 'Álvaro Espinoza', 'Josefa Miranda', 'Cristian Bravo', 'Paula Figueroa',
  'Sebastián Leiva', 'Karina Morales', 'Diego Sandoval', 'Alejandra Pinto', 'Mauricio Reyes',
];
const NOMBRES_PAMPA = [
  'Elena Gutiérrez', 'Tomás Navarro', 'Pilar Aguilera', 'Iván Cortés',
  'Sofía Maldonado', 'Hernán Quiroz', 'Lorena Campos', 'Matías Escobar',
];
const NOMBRES_TURISTA = [
  'Ana Beltrán', 'Carlo Ricci', 'Marta Godoy', 'Peter Walsh', 'Lucía Fernández', 'Hans Keller',
];

export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isoDay(fechaRef, delta) {
  return dayKey(addDays(fechaRef, delta));
}

function rutFicticio(n) {
  const cuerpo = String(10_000_000 + n * 137).padStart(8, '0');
  return `${cuerpo.slice(0, 2)}.${cuerpo.slice(2, 5)}.${cuerpo.slice(5, 8)}-${n % 9}`;
}

function tel(base, n) {
  return `+569${String(base + n).padStart(8, '0')}`;
}

function generarHabitaciones(cantidad) {
  const tipos = ['single', 'doble', 'twin'];
  const rooms = [];
  let n = 0;
  let piso = 1;
  while (n < cantidad) {
    for (let i = 1; i <= 12 && n < cantidad; i += 1) {
      rooms.push({ numero: String(piso * 100 + i), tipo: tipos[n % 3], piso });
      n += 1;
    }
    piso += 1;
  }
  return rooms;
}

function huesped(tenantId, id, empresaId, nombre, nTel, cargo, prefs = {}) {
  return {
    tenantId,
    id,
    empresaId,
    nombre,
    rut: rutFicticio(Number.parseInt(id.replace(/\D/g, ''), 10) || nTel),
    telefono: tel(11110000, nTel),
    cargo,
    preferencias: { piso: prefs.piso || 2, pisoAlto: Boolean(prefs.pisoAlto), silencioso: Boolean(prefs.silencioso) },
  };
}

function reserva({
  tenantId, seq, sedeId, habitacion, huespedId, empresaId,
  checkIn, checkOut, estado, origen, horaLlegada = null, extras = [],
}) {
  return {
    tenantId,
    id: `res-${String(seq).padStart(4, '0')}`,
    sedeId,
    habitacion,
    huespedId,
    empresaId,
    checkIn,
    checkOut,
    estado,
    origen,
    codigo: `ADS-${checkIn.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
    horaLlegada,
    extras,
  };
}

export function clonarDemo(tenantId = TENANT_DEFAULT, fechaRef) {
  const fecha = dayKey(fechaRef || fechaHoy());
  const D = (n) => isoDay(fecha, n);
  const tid = tenantId;

  const sedes = [
    {
      id: 'costanera',
      nombre: 'Antofagasta Costanera',
      direccion: 'Av. Grecia 1001, Antofagasta',
      habitaciones: generarHabitaciones(48),
    },
    {
      id: 'angamos',
      nombre: 'Antofagasta Angamos',
      direccion: 'Av. Angamos 01451, Antofagasta',
      habitaciones: generarHabitaciones(30),
    },
    {
      id: 'mejillones',
      nombre: 'Mejillones',
      direccion: 'Av. San Martín 450, Mejillones',
      habitaciones: generarHabitaciones(24),
    },
  ];

  const empresas = [
    {
      tenantId: tid,
      id: 'emp-norte',
      nombre: 'Minera Norte SpA',
      rut: '76.111.222-3',
      contacto: {
        nombre: 'Coordinador Minera Norte',
        telefono: '+56922220001',
        email: 'coordinador@mineranorte.demo',
      },
      convenio: {
        tarifaNoche: 52000,
        incluyeDesayuno: true,
        incluyeTraslado: true,
        formaPago: 'factura mensual',
      },
      turnos: ['7x7'],
      sedeHabitualId: 'costanera',
      activa: true,
    },
    {
      tenantId: tid,
      id: 'emp-andes',
      nombre: 'Contratista Andes Ltda.',
      rut: '76.333.444-5',
      contacto: {
        nombre: 'Coordinador Andes',
        telefono: '+56922220002',
        email: 'coordinador@andes.demo',
      },
      convenio: {
        tarifaNoche: 48000,
        incluyeDesayuno: true,
        incluyeTraslado: true,
        formaPago: 'factura mensual',
      },
      turnos: ['4x3'],
      sedeHabitualId: 'angamos',
      activa: true,
    },
    {
      tenantId: tid,
      id: 'emp-pampa',
      nombre: 'Servicios Pampa SpA',
      rut: '76.555.666-7',
      contacto: {
        nombre: 'Coordinador Pampa',
        telefono: '+56922220003',
        email: 'coordinador@pampa.demo',
      },
      convenio: {
        tarifaNoche: 45000,
        incluyeDesayuno: true,
        incluyeTraslado: false,
        formaPago: 'factura mensual',
      },
      turnos: ['14x14'],
      sedeHabitualId: 'mejillones',
      activa: true,
    },
  ];

  const huespedes = [];
  NOMBRES_NORTE.forEach((nombre, i) => {
    huespedes.push(huesped(tid, `h-n-${String(i + 1).padStart(2, '0')}`, 'emp-norte', nombre, i + 1, i % 2 ? 'Operador' : 'Supervisor', { piso: (i % 3) + 1, silencioso: i % 4 === 0 }));
  });
  NOMBRES_ANDES.forEach((nombre, i) => {
    huespedes.push(huesped(tid, `h-a-${String(i + 1).padStart(2, '0')}`, 'emp-andes', nombre, 21 + i, 'Técnico', { piso: 2 }));
  });
  NOMBRES_PAMPA.forEach((nombre, i) => {
    huespedes.push(huesped(tid, `h-p-${String(i + 1).padStart(2, '0')}`, 'emp-pampa', nombre, 41 + i, 'Mantención', { pisoAlto: i < 2 }));
  });
  NOMBRES_TURISTA.forEach((nombre, i) => {
    huespedes.push(huesped(tid, `h-t-${String(i + 1).padStart(2, '0')}`, null, nombre, 81 + i, i === 5 ? 'Particular' : 'Visitante', {}));
  });
  huespedes[0].telefono = TEL_HUESPED_NORTE;
  huespedes[huespedes.length - 1].telefono = TEL_TURISTA_SIN_RESERVA;

  const reservaHab = [];
  let seq = 1;
  const pushR = (opts) => {
    reservaHab.push(reserva({ tenantId: tid, seq, ...opts }));
    seq += 1;
  };

  // Norte: 8 en casa, 2 llegan hoy, 2 salen hoy. 6 van en rooming D+3.
  for (let i = 0; i < 8; i += 1) {
    pushR({
      sedeId: 'costanera',
      habitacion: String(101 + i),
      huespedId: `h-n-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-norte',
      checkIn: D(-3),
      checkOut: D(4),
      estado: 'en_casa',
      origen: 'rooming_list',
      extras: i === 0 ? [{ concepto: 'Frigobar', monto: 12000 }] : [],
    });
  }
  for (let i = 8; i < 10; i += 1) {
    pushR({
      sedeId: 'costanera',
      habitacion: String(101 + i),
      huespedId: `h-n-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-norte',
      checkIn: D(0),
      checkOut: D(7),
      estado: 'confirmada',
      origen: 'rooming_list',
      horaLlegada: i === 8 ? '08:00' : '09:30',
      extras: i === 8 ? [{ concepto: 'Lavandería', monto: 8500 }] : [],
    });
  }
  for (let i = 10; i < 12; i += 1) {
    pushR({
      sedeId: 'costanera',
      habitacion: String(101 + i),
      huespedId: `h-n-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-norte',
      checkIn: D(-7),
      checkOut: D(0),
      estado: 'en_casa',
      origen: 'rooming_list',
    });
  }

  // Andes
  for (let i = 0; i < 5; i += 1) {
    pushR({
      sedeId: 'angamos',
      habitacion: String(101 + i),
      huespedId: `h-a-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-andes',
      checkIn: D(-1),
      checkOut: D(3),
      estado: 'en_casa',
      origen: 'rooming_list',
    });
  }
  for (let i = 5; i < 8; i += 1) {
    pushR({
      sedeId: 'angamos',
      habitacion: String(101 + i),
      huespedId: `h-a-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-andes',
      checkIn: D(1),
      checkOut: D(5),
      estado: 'confirmada',
      origen: 'rooming_list',
      horaLlegada: '16:00',
    });
  }
  for (let i = 8; i < 10; i += 1) {
    pushR({
      sedeId: 'angamos',
      habitacion: String(101 + i),
      huespedId: `h-a-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-andes',
      checkIn: D(-3),
      checkOut: D(1),
      estado: 'en_casa',
      origen: 'rooming_list',
    });
  }

  // Pampa 14x14
  for (let i = 0; i < 8; i += 1) {
    pushR({
      sedeId: 'mejillones',
      habitacion: String(101 + i),
      huespedId: `h-p-${String(i + 1).padStart(2, '0')}`,
      empresaId: 'emp-pampa',
      checkIn: D(-2),
      checkOut: D(12),
      estado: 'en_casa',
      origen: 'rooming_list',
    });
  }

  // Turistas (el último no tiene reserva)
  pushR({
    sedeId: 'costanera', habitacion: '301', huespedId: 'h-t-01', empresaId: null,
    checkIn: D(-2), checkOut: D(3), estado: 'en_casa', origen: 'recepcion',
  });
  pushR({
    sedeId: 'costanera', habitacion: '302', huespedId: 'h-t-02', empresaId: null,
    checkIn: D(-1), checkOut: D(2), estado: 'en_casa', origen: 'asistente',
  });
  pushR({
    sedeId: 'costanera', habitacion: '303', huespedId: 'h-t-03', empresaId: null,
    checkIn: D(0), checkOut: D(2), estado: 'confirmada', origen: 'recepcion', horaLlegada: '16:00',
  });
  pushR({
    sedeId: 'costanera', habitacion: '305', huespedId: 'h-t-04', empresaId: null,
    checkIn: D(-3), checkOut: D(0), estado: 'en_casa', origen: 'recepcion',
  });
  pushR({
    sedeId: 'angamos', habitacion: '201', huespedId: 'h-t-05', empresaId: null,
    checkIn: D(-1), checkOut: D(4), estado: 'en_casa', origen: 'recepcion',
  });

  const byId = Object.fromEntries(reservaHab.map((r) => [r.huespedId, r]));

  const traslados = [
    { tenantId: tid, id: 'tr-01', reservaHabId: byId['h-n-09'].id, tipo: 'llegada', hora: '08:00', punto: 'Aeropuerto', estado: 'programado' },
    { tenantId: tid, id: 'tr-02', reservaHabId: byId['h-n-10'].id, tipo: 'llegada', hora: '09:30', punto: 'Terminal', estado: 'en_ruta' },
    { tenantId: tid, id: 'tr-03', reservaHabId: byId['h-n-11'].id, tipo: 'salida', hora: '11:00', punto: 'Faena', estado: 'programado' },
    { tenantId: tid, id: 'tr-04', reservaHabId: byId['h-n-12'].id, tipo: 'salida', hora: '12:00', punto: 'Aeropuerto', estado: 'programado' },
    { tenantId: tid, id: 'tr-05', reservaHabId: byId['h-t-03'].id, tipo: 'llegada', hora: '16:00', punto: 'Aeropuerto', estado: 'programado' },
    { tenantId: tid, id: 'tr-06', reservaHabId: byId['h-t-04'].id, tipo: 'salida', hora: '10:00', punto: 'Terminal', estado: 'realizado' },
  ];

  const filasProximo = NOMBRES_NORTE.slice(12, 18).map((nombre, i) => ({
    huespedId: `h-n-${String(i + 13).padStart(2, '0')}`,
    nombre,
    checkIn: D(3),
    checkOut: D(10),
    habitacionSolicitada: String(201 + i),
  }));

  const roomingLists = [
    {
      tenantId: tid,
      id: 'rl-norte-actual',
      empresaId: 'emp-norte',
      sedeId: 'costanera',
      turnoInicio: D(-3),
      turnoFin: D(4),
      filas: NOMBRES_NORTE.slice(0, 8).map((nombre, i) => ({
        huespedId: `h-n-${String(i + 1).padStart(2, '0')}`,
        nombre,
        checkIn: D(-3),
        checkOut: D(4),
        habitacionSolicitada: String(101 + i),
      })),
      estado: 'confirmada',
      confirmadaEl: D(-4),
      observacion: null,
    },
    {
      tenantId: tid,
      id: 'rl-norte-prox',
      empresaId: 'emp-norte',
      sedeId: 'costanera',
      turnoInicio: D(3),
      turnoFin: D(10),
      filas: filasProximo,
      estado: 'enviada',
      confirmadaEl: null,
      observacion: null,
    },
  ];

  const tareas = [
    {
      tenantId: tid,
      id: 'tar-01',
      origen: 'asistente',
      tipo: 'llegada_temprana',
      prioridad: 'alta',
      estado: 'abierta',
      huespedId: 'h-n-09',
      empresaId: 'emp-norte',
      sedeId: 'costanera',
      reservaHabId: byId['h-n-09'].id,
      titulo: 'Adelantar check-in',
      detalle: 'Huésped informa llegada a las 08:00. Recepción intentará adelantar.',
      creadaEl: `${D(0)}T08:00:00.000Z`,
    },
    {
      tenantId: tid,
      id: 'tar-02',
      origen: 'asistente',
      tipo: 'extender',
      prioridad: 'media',
      estado: 'abierta',
      huespedId: 'h-n-01',
      empresaId: 'emp-norte',
      sedeId: 'costanera',
      reservaHabId: byId['h-n-01'].id,
      titulo: 'Extensión de estadía',
      detalle: 'Solicita una noche extra. No confirmar por el asistente.',
      creadaEl: `${D(0)}T09:10:00.000Z`,
    },
    {
      tenantId: tid,
      id: 'tar-03',
      origen: 'portal',
      tipo: 'reemplazo',
      prioridad: 'alta',
      estado: 'abierta',
      huespedId: 'h-n-03',
      empresaId: 'emp-norte',
      sedeId: 'costanera',
      reservaHabId: byId['h-n-03'].id,
      titulo: 'Reemplazo de trabajador',
      detalle: 'Motivo: cambio de turno en faena.',
      creadaEl: `${D(-1)}T18:00:00.000Z`,
    },
  ];

  const conversations = [
    {
      tenantId: tid, id: 'conv-demo-1', sede: 'Antofagasta Costanera', status: 'active',
      paso: 'menu', data: {}, usuario: 'Patricia Soto', telefono: TEL_HUESPED_NORTE, motivo: null,
      messages: [
        { autor: 'bot', texto: 'Hola, soy el asistente de Hotel Alto del Sol. Te ayudo con tu llegada, traslado, desayuno y solicitudes. ¿Qué necesitas?', opciones: [], ia: false, hora: `${D(0)}T10:00:00.000Z` },
        { autor: 'user', texto: 'mi reserva', opciones: [], ia: false, hora: `${D(0)}T10:00:30.000Z` },
      ],
    },
    {
      tenantId: tid, id: 'conv-demo-2', sede: 'Antofagasta Costanera', status: 'active',
      paso: 'menu', data: {}, usuario: 'Isabel Castro', telefono: tel(11110000, 9), motivo: null,
      messages: [
        { autor: 'user', texto: 'llego a las 08:00', opciones: [], ia: false, hora: `${D(0)}T07:40:00.000Z` },
      ],
    },
    {
      tenantId: tid, id: 'conv-demo-3', sede: 'Antofagasta Costanera', status: 'active',
      paso: 'menu', data: {}, usuario: 'Ana Beltrán', telefono: tel(11110000, 81), motivo: null,
      messages: [
        { autor: 'user', texto: 'clave wifi', opciones: [], ia: false, hora: `${D(-1)}T21:00:00.000Z` },
      ],
    },
    {
      tenantId: tid, id: 'conv-demo-4', sede: 'Antofagasta Costanera', status: 'waiting_human',
      paso: 'done', data: {}, usuario: 'Luis Araya', telefono: tel(11110000, 2), motivo: 'Aire acondicionado',
      messages: [
        { autor: 'user', texto: 'el aire no enfría', opciones: [], ia: false, hora: `${D(0)}T22:00:00.000Z` },
      ],
    },
  ];

  return {
    tenantId: tid,
    sedes,
    empresas,
    huespedes,
    reservaHab,
    roomingLists,
    traslados,
    tareas,
    conversations,
    usuariosEquipo: [
      { tenantId: tid, email: 'recepcion@altodelsol.demo', nombre: 'Recepción Alto del Sol', rol: 'recepcion' },
      { tenantId: tid, email: 'admin@altodelsol.demo', nombre: 'Administración Alto del Sol', rol: 'administracion' },
      { tenantId: tid, email: 'coordinador@mineranorte.demo', nombre: 'Coordinador Minera Norte', rol: 'empresa', empresaId: 'emp-norte' },
    ],
    automation: {
      nextActionSeq: 1,
      agentesActivos: { recordatorio_llegada: true, rooming_pendiente: true, cierre_mensual: true },
      campanias: [],
      acciones: [],
    },
    nextReservaSeq: seq,
    nextConvSeq: 5,
    nextTareaSeq: 4,
    nextRoomingSeq: 3,
    nextLeadSeq: 1,
  };
}

export function clonarMundo(fechaRef) {
  return {
    tenants: listarTenants(),
    byTenant: {
      [TENANT_DEFAULT]: clonarDemo(TENANT_DEFAULT, fechaRef),
    },
  };
}
