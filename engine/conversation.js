import { clonarDemo } from '../data/demo.js';
import { TENANT_DEFAULT } from '../data/tenants.js';
import { i18n } from '../data/i18n.js';
import { crearIntentService, INTENCIONES, normalizar } from './intent.js';
import { crearMemoria, clonar, normalizarTelefono, parseHora } from './store.js';
import { fechaHoy } from './dates.js';

const MENU = i18n.menu;

export function crearEngine(datosIniciales, tenantId = TENANT_DEFAULT, opts = {}) {
  const memoria = datosIniciales && datosIniciales.memoria
    ? datosIniciales.memoria
    : crearMemoria(datosIniciales || clonarDemo(tenantId, opts.fechaRef));
  const tid = tenantId;
  const intent = crearIntentService();
  let fechaRef = opts.fechaRef || fechaHoy((memoria.getTenant(tid) || {}).zonaHoraria);

  function fecha() {
    return fechaRef;
  }

  function setFechaRef(f) {
    if (f) fechaRef = f;
  }

  function tenant() {
    return memoria.getTenant(tid) || { id: tid, sedes: [], textosBot: {}, marca: {} };
  }

  function iniciar() {
    const t = tenant();
    const conv = memoria.crearConversacion(tid, { paso: 'menu' });
    const bienvenida = (t.textosBot && t.textosBot.bienvenida) || i18n.menu[0].etiqueta;
    const msg = botMsg(bienvenida, MENU);
    conv.messages.push(msg);
    return { conversacion: publicConv(conv), mensajes: [msg] };
  }

  function procesar(conversacionId, textoCrudo) {
    try {
      return procesarSeguro(conversacionId, textoCrudo);
    } catch {
      const conv = memoria.getConversacion(tid, conversacionId);
      return {
        conversacion: conv ? publicConv(conv) : null,
        mensajes: [botMsg(i18n.neutro, MENU)],
      };
    }
  }

  function procesarSeguro(conversacionId, textoCrudo) {
    const conv = memoria.getConversacion(tid, conversacionId);
    if (!conv) {
      return {
        conversacion: null,
        mensajes: [botMsg('No encontramos esa conversación. Recarga e inténtalo de nuevo.')],
      };
    }
    const texto = String(textoCrudo || '').slice(0, 2000).trim();
    conv.messages.push({ autor: 'user', texto, opciones: [], ia: false, hora: ahora() });
    const cmd = normalizar(texto);

    let out;
    if (cmd === 'menu' || cmd === 'volver' || cmd === 'cancelar') {
      conv.paso = 'menu';
      conv.data = {};
      if (conv.status === 'waiting_human') conv.status = 'active';
      out = [botMsg('¿Qué necesitas?', MENU)];
    } else if (conv.paso === 'ask_phone') {
      out = recibirTelefono(conv, texto);
    } else if (conv.paso === 'ask_hora_llegada') {
      out = recibirHoraLlegada(conv, texto);
    } else {
      const det = intent.detectar(texto);
      out = aplicarIntencion(conv, det, texto);
    }

    const mensajes = Array.isArray(out) ? out : [out];
    for (const m of mensajes) conv.messages.push(m);
    return { conversacion: publicConv(conv), mensajes };
  }

  function aplicarIntencion(conv, det, texto) {
    const n = menuNumero(texto);
    if (n === 1 || det.intencion === INTENCIONES.MI_RESERVA) return conTelefono(conv, 'mi_reserva');
    if (n === 2 || det.intencion === INTENCIONES.LLEGADA) return conTelefono(conv, 'llegada');
    if (n === 3 || det.intencion === INTENCIONES.TRASLADO) return conTelefono(conv, 'traslado');
    if (n === 4 || det.intencion === INTENCIONES.DESAYUNO_WIFI) return responderDesayuno(conv);
    if (n === 5 || det.intencion === INTENCIONES.EXTENDER) return conTelefono(conv, 'extender');
    if (n === 6 || det.intencion === INTENCIONES.CAMBIO_HABITACION) return conTelefono(conv, 'cambio_habitacion');
    if (n === 7 || det.intencion === INTENCIONES.FACTURA) return conTelefono(conv, 'factura');
    if (n === 8 || det.intencion === INTENCIONES.RECLAMO) return conTelefono(conv, 'reclamo');
    if (det.intencion === INTENCIONES.TURISTA) return responderTurista(conv);
    if (det.intencion === INTENCIONES.AYUDA || det.intencion === INTENCIONES.MENU) {
      conv.paso = 'menu';
      return [botMsg('Puedo ayudarte con tu reserva, llegada, traslado, desayuno o una solicitud a recepción.', MENU)];
    }
    return [botMsg(i18n.neutro, MENU)];
  }

  function despachar(conv, clave) {
    if (clave === 'mi_reserva') return responderReserva(conv);
    if (clave === 'llegada') return iniciarLlegada(conv);
    if (clave === 'traslado') return responderTraslado(conv);
    if (clave === 'extender') return tareaSolicitud(conv, 'extender', 'Extensión de estadía', 'alta');
    if (clave === 'cambio_habitacion') return tareaSolicitud(conv, 'cambio_habitacion', 'Cambio de habitación', 'media');
    if (clave === 'factura') return tareaSolicitud(conv, 'factura', 'Factura', 'media');
    if (clave === 'reclamo') return tareaSolicitud(conv, 'reclamo', 'Reclamo', 'alta');
    return responderReserva(conv);
  }

  function conTelefono(conv, clave) {
    if (!conv.telefono) {
      conv.paso = 'ask_phone';
      conv.data = { pending: clave };
      return [botMsg(i18n.pideTelefono)];
    }
    return despachar(conv, clave);
  }

  function recibirTelefono(conv, texto) {
    const tel = normalizarTelefono(texto);
    if (!tel) return [botMsg(i18n.telefonoInvalido)];
    conv.telefono = tel;
    const h = memoria.buscarHuespedPorTelefono(tid, tel);
    if (h) conv.usuario = h.nombre;
    const pending = (conv.data && conv.data.pending) || 'mi_reserva';
    conv.paso = 'menu';
    conv.data = {};
    return despachar(conv, pending);
  }

  function responderReserva(conv) {
    conv.paso = 'menu';
    const r = memoria.reservaActivaDeTelefono(tid, conv.telefono, fecha());
    if (!r) return responderTurista(conv);
    const h = memoria.getHuesped(tid, r.huespedId);
    const sede = memoria.getSede(tid, r.sedeId);
    const emp = r.empresaId ? memoria.getEmpresa(tid, r.empresaId) : null;
    const hab = r.habitacion ? `Habitación ${r.habitacion}` : 'Habitación por asignar';
    const lineas = [
      `${h ? h.nombre : 'Huésped'} · ${r.codigo}`,
      `Sede: ${sede ? sede.nombre : r.sedeId}`,
      hab,
      `Ingreso ${r.checkIn} · salida ${r.checkOut}`,
      emp ? `Empresa: ${emp.nombre}` : 'Particular, sin convenio',
    ];
    return [botMsg(lineas.join('\n'), MENU)];
  }

  function iniciarLlegada(conv) {
    const r = memoria.reservaActivaDeTelefono(tid, conv.telefono, fecha());
    if (!r) return responderTurista(conv);
    conv.paso = 'ask_hora_llegada';
    conv.data = { reservaId: r.id };
    return [botMsg(i18n.pideHoraLlegada)];
  }

  function recibirHoraLlegada(conv, texto) {
    const hora = parseHora(texto) || extraerHoraSuelta(texto);
    if (!hora) return [botMsg(i18n.horaInvalida)];
    const reservaId = conv.data && conv.data.reservaId;
    memoria.registrarHoraLlegada(tid, reservaId, hora);
    const r = (memoria.listarReservasHab(tid) || []).find((x) => x.id === reservaId);
    conv.paso = 'menu';
    conv.data = {};
    const [hh] = hora.split(':').map(Number);
    const temprano = hh < 14;
    if (temprano) {
      memoria.crearTarea(tid, {
        origen: 'asistente',
        tipo: 'llegada_temprana',
        prioridad: 'alta',
        huespedId: r ? r.huespedId : null,
        empresaId: r ? r.empresaId : null,
        sedeId: r ? r.sedeId : null,
        reservaHabId: reservaId,
        titulo: 'Adelantar check-in',
        detalle: `Llegada informada a las ${hora}. Recepción intentará adelantar.`,
      });
      return [botMsg(`Quedó registrada tu llegada a las ${hora}.\nEl check-in es a las 14:00.\nRecepción intentará adelantar.\n${i18n.acuseTarea}`, MENU)];
    }
    return [botMsg(`Quedó registrada tu llegada a las ${hora}.\nTe esperamos desde las 14:00.`, MENU)];
  }

  function responderTraslado(conv) {
    conv.paso = 'menu';
    const r = memoria.reservaActivaDeTelefono(tid, conv.telefono, fecha());
    if (!r) return responderTurista(conv);
    const lista = memoria.trasladoDeReserva(tid, r.id);
    if (!lista.length) {
      memoria.crearTarea(tid, {
        origen: 'asistente',
        tipo: 'traslado',
        prioridad: 'media',
        huespedId: r.huespedId,
        empresaId: r.empresaId,
        sedeId: r.sedeId,
        reservaHabId: r.id,
        titulo: 'Consulta de traslado',
        detalle: 'Huésped consulta traslado y no tiene uno programado.',
      });
      return [botMsg(`No tienes un traslado programado.\nDejamos la consulta a recepción.\n${i18n.acuseTarea}`, MENU)];
    }
    const lineas = lista.slice(0, 5).map((t) => `${t.tipo}: ${t.hora} · ${t.punto} · ${t.estado}`);
    return [botMsg(lineas.join('\n'), MENU)];
  }

  function responderDesayuno(conv) {
    conv.paso = 'menu';
    const r = conv.telefono ? memoria.reservaActivaDeTelefono(tid, conv.telefono, fecha()) : null;
    const sede = r ? memoria.getSede(tid, r.sedeId) : memoria.listarSedes(tid)[0];
    const t = tenant();
    const s = sede || (t.sedes && t.sedes[0]);
    if (!s) return [botMsg('Recepción confirma desayuno y wifi al llegar.', MENU)];
    const lineas = [
      `${s.nombre}`,
      `Desayuno: ${s.desayuno || '06:30 a 09:30'}`,
      `Wifi: ${s.wifiRed || 'red de la sede'}`,
      `Clave: ${s.wifiClave || 'en recepción'}`,
    ];
    return [botMsg(lineas.join('\n'), MENU)];
  }

  function tareaSolicitud(conv, tipo, titulo, prioridad) {
    conv.paso = 'menu';
    const r = memoria.reservaActivaDeTelefono(tid, conv.telefono, fecha());
    if (!r) return responderTurista(conv);
    memoria.crearTarea(tid, {
      origen: 'asistente',
      tipo,
      prioridad,
      huespedId: r.huespedId,
      empresaId: r.empresaId,
      sedeId: r.sedeId,
      reservaHabId: r.id,
      titulo,
      detalle: `Solicitud de ${titulo.toLowerCase()} vía asistente.`,
    });
    return [botMsg(i18n.acuseTarea, MENU)];
  }

  function responderTurista(conv) {
    conv.paso = 'menu';
    const sedes = memoria.listarSedes(tid);
    const nombres = sedes.map((s) => s.nombre).join(', ');
    const lineas = [
      'No encuentro una reserva con ese teléfono.',
      `Sedes: ${nombres}.`,
      'Para reservar, recepción confirma disponibilidad y tarifa.',
      '¿Te derivo con el equipo?',
    ];
    memoria.crearTarea(tid, {
      origen: 'asistente',
      tipo: 'turista',
      prioridad: 'media',
      huespedId: null,
      empresaId: null,
      sedeId: sedes[0] ? sedes[0].id : null,
      titulo: 'Consulta sin reserva',
      detalle: `Teléfono ${conv.telefono || 'no informado'} consulta como particular. El asistente no cotiza.`,
    });
    return [botMsg(lineas.join('\n'), MENU)];
  }

  return {
    tenantId: tid,
    iniciar,
    procesar,
    listarReservasHab: (usuario) => memoria.listarReservasHab(tid, usuario),
    listarConversaciones: () => memoria.listarConversaciones(tid),
    listarSedes: () => memoria.listarSedes(tid),
    getTenant: () => tenant(),
    reset() {
      if (memoria.hidratarTenant) memoria.hidratarTenant(tid, clonarDemo(tid, fechaRef));
      else memoria.hidratar(clonarDemo(tid, fechaRef));
    },
    exportar() { return memoria.sliceExport(tid); },
    hidratar(datos) { memoria.hidratar(datos); },
    setFechaRef,
    fecha,
    memoria,
    intent,
  };
}

function publicConv(conv) {
  return clonar({
    id: conv.id,
    tenantId: conv.tenantId,
    sede: conv.sede,
    status: conv.status,
    paso: conv.paso,
    usuario: conv.usuario,
    telefono: conv.telefono,
    motivo: conv.motivo,
  });
}

function botMsg(texto, opciones = [], ia = false) {
  const recortado = String(texto || '')
    .split('\n')
    .slice(0, 6)
    .join('\n')
    .replace(/[{}]/g, '');
  return { autor: 'bot', texto: recortado, opciones, ia, hora: ahora() };
}

function menuNumero(texto) {
  const t = String(texto || '').trim();
  if (/^[1-8]$/.test(t)) return Number(t);
  return null;
}

function extraerHoraSuelta(texto) {
  const m = String(texto || '').match(/(\d{1,2}:\d{2})/);
  return m ? parseHora(m[1]) : null;
}

function ahora() {
  return new Date().toISOString();
}
