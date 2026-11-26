import { createClient } from '@supabase/supabase-js';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const CLAVE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const enNube = Boolean(URL_SB && CLAVE_SB);
export const sb = enNube ? createClient(URL_SB, CLAVE_SB) : null;

export const ACT = { D: null, usuario: null, ruta: null, modelo: null, parametrosId: null };

const ROLES = { administrador: 'Administrador', jefe_operaciones: 'Jefe de operaciones', despachador: 'Despachador' };
export const nombreRol = (r) => ROLES[r] || r;

const LOCAL = 'pulso:local:';
const leerLocal = (k, def) => { try { const v = localStorage.getItem(LOCAL + k); return v ? JSON.parse(v) : def; } catch { return def; } };
const guardarLocal = (k, v) => { try { localStorage.setItem(LOCAL + k, JSON.stringify(v)); } catch { } };

function errorLegible(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo antes de ingresar.';
  if (/row-level security|permission denied/i.test(m)) return 'Tu rol no tiene permiso para esta acción.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
  return m;
}
const ok = (r) => { if (r.error) throw new Error(errorLegible(r.error)); return r.data; };

export async function perfilActual() {
  if (!enNube) {
    ACT.usuario = { id: 'local', nombre: 'Administrador', correo: 'local', rol: 'administrador', local: true };
    return ACT.usuario;
  }
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return (ACT.usuario = null);
  const r = await sb.from('usuarios').select('id, nombre, correo, rol, activo').eq('id', uid).maybeSingle();
  if (r.error || !r.data || !r.data.activo) return (ACT.usuario = null);
  return (ACT.usuario = r.data);
}

export async function ingresar(correo, clave) {
  const r = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (r.error) throw new Error(errorLegible(r.error));
  const p = await perfilActual();
  if (!p) { await sb.auth.signOut(); throw new Error('Tu cuenta está desactivada. Pide acceso al administrador.'); }
  return p;
}

export async function recuperarClave(correo) {
  const r = await sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin });
  if (r.error) throw new Error(errorLegible(r.error));
}

export async function salir() {
  if (enNube) await sb.auth.signOut();
  location.hash = '';
  location.reload();
}

const PARAMS_CAMPOS = ['ocupacion_objetivo', 'ocupacion_minima', 'factor_seguridad', 'intervalo_minimo', 'espera_maxima', 'flota', 'umbral_correccion', 'alpha_correccion', 'correccion_min', 'correccion_max'];

export async function cargarDatos() {
  if (!enNube) {
    const m = await import('../data/datos.json');
    const D = structuredClone(m.default);
    Object.assign(D.params, leerLocal('parametros', {}));
    ACT.D = D;
    ACT.ruta = { id: 1, ...D.ruta };
    return D;
  }
  const ruta = ok(await sb.from('rutas').select('id, codigo, nombre, km_ida, paraderos').eq('activa', true).order('id').limit(1).maybeSingle());
  ACT.ruta = ruta;
  if (!ruta) return (ACT.D = null);
  const modelo = ok(await sb.from('modelos').select('id, entrenado_en, mae, rmse, mape, registros, resumen').eq('ruta_id', ruta.id).not('resumen', 'is', null).order('entrenado_en', { ascending: false }).limit(1).maybeSingle());
  ACT.modelo = modelo;
  if (!modelo?.resumen) return (ACT.D = null);
  const D = modelo.resumen;
  D.ruta = { codigo: ruta.codigo, nombre: ruta.nombre, km_ida: Number(ruta.km_ida), paraderos: ruta.paraderos };
  const p = ok(await sb.from('parametros_vigentes').select('*').eq('ruta_id', ruta.id).maybeSingle());
  if (p) {
    ACT.parametrosId = p.id;
    for (const k of PARAMS_CAMPOS) if (p[k] != null) D.params[k] = Number(p[k]);
  }
  ACT.D = D;
  return D;
}

export async function guardarParametros(params) {
  if (!enNube) {
    const v = {}; for (const k of PARAMS_CAMPOS) v[k] = params[k];
    guardarLocal('parametros', v);
    return;
  }
  const fila = { ruta_id: ACT.ruta.id, creado_por: ACT.usuario.id };
  for (const k of PARAMS_CAMPOS) fila[k] = ['intervalo_minimo', 'espera_maxima', 'flota'].includes(k) ? Math.round(params[k]) : params[k];
  const r = ok(await sb.from('parametros').insert(fila).select('id').single());
  ACT.parametrosId = r.id;
}

export async function restablecerParametros(base) {
  if (!enNube) { guardarLocal('parametros', {}); return; }
  await guardarParametros(base);
}

export function leerCSV(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de datos.');
  const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const cab = lineas[0].split(sep).map((x) => x.trim().toLowerCase().replace(/"/g, ''));
  const iF = cab.findIndex((x) => ['fecha_hora', 'fecha', 'datetime', 'ds'].includes(x));
  const iP = cab.findIndex((x) => ['pasajeros', 'abordajes', 'y', 'cantidad'].includes(x));
  if (iF < 0 || iP < 0) throw new Error('El archivo debe tener las columnas fecha_hora y pasajeros.');
  const filas = [], errores = [];
  for (let n = 1; n < lineas.length; n++) {
    const c = lineas[n].split(sep).map((x) => x.trim().replace(/"/g, ''));
    const f = normalizarFecha(c[iF]);
    const v = c[iP] === '' ? null : Number(c[iP].replace(',', '.'));
    if (!f || (v != null && (!Number.isFinite(v) || v < 0))) { errores.push(n + 1); continue; }
    if (v == null) continue;
    filas.push({ fecha_hora: f, pasajeros: Math.round(v) });
  }
  if (!filas.length) throw new Error('No se encontraron filas válidas en el archivo.');
  filas.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
  return { filas, errores, desde: filas[0].fecha_hora, hasta: filas[filas.length - 1].fecha_hora };
}

function normalizarFecha(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  let y, mo, d, h, mi;
  if (m) [, y, mo, d, h, mi] = m;
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/);
    if (!m) return null;
    [, d, mo, y, h, mi] = m;
  }
  const p2 = (x) => String(x).padStart(2, '0');
  if (+mi % 15 !== 0) return null;
  return `${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}:00-05:00`;
}

export async function subirRegistros(lectura, archivo, progreso) {
  if (!enNube) {
    const cargas = leerLocal('cargas', []);
    cargas.unshift({ id: Date.now(), archivo, filas_nuevas: lectura.filas.length, filas_actualizadas: 0, desde: lectura.desde, hasta: lectura.hasta, creado_en: new Date().toISOString(), usuario: ACT.usuario.nombre });
    guardarLocal('cargas', cargas.slice(0, 20));
    for (let i = 0; i <= 10; i++) { progreso?.(i / 10); await new Promise((r) => setTimeout(r, 60)); }
    return { nuevas: lectura.filas.length, actualizadas: 0 };
  }
  const conteo = await sb.from('registros_abordaje').select('id', { count: 'exact', head: true }).eq('ruta_id', ACT.ruta.id).gte('fecha_hora', lectura.desde).lte('fecha_hora', lectura.hasta);
  if (conteo.error) throw new Error(errorLegible(conteo.error));
  const actualizadas = Math.min(conteo.count ?? 0, lectura.filas.length);
  const nuevas = lectura.filas.length - actualizadas;
  const carga = ok(await sb.from('cargas').insert({ ruta_id: ACT.ruta.id, usuario_id: ACT.usuario.id, archivo, desde: lectura.desde, hasta: lectura.hasta, filas_nuevas: nuevas, filas_actualizadas: actualizadas }).select('id').single());
  const lote = 500;
  for (let i = 0; i < lectura.filas.length; i += lote) {
    const parte = lectura.filas.slice(i, i + lote).map((x) => ({ ...x, ruta_id: ACT.ruta.id, fuente: 'importacion', carga_id: carga.id }));
    ok(await sb.from('registros_abordaje').upsert(parte, { onConflict: 'ruta_id,fecha_hora' }));
    progreso?.(Math.min(1, (i + lote) / lectura.filas.length));
  }
  return { nuevas, actualizadas };
}

export async function historialCargas() {
  if (!enNube) return leerLocal('cargas', []);
  const r = ok(await sb.from('cargas').select('id, archivo, filas_nuevas, filas_actualizadas, desde, hasta, creado_en, usuarios(nombre)').eq('ruta_id', ACT.ruta.id).order('creado_en', { ascending: false }).limit(12));
  return r.map((x) => ({ ...x, usuario: x.usuarios?.nombre || '—' }));
}

export async function estadoModelo() {
  if (!enNube) return { entrenado_en: ACT.D?.generado || null, pendiente: false };
  const [m, c] = await Promise.all([
    sb.from('modelos').select('entrenado_en').eq('ruta_id', ACT.ruta.id).order('entrenado_en', { ascending: false }).limit(1).maybeSingle(),
    sb.from('cargas').select('creado_en').eq('ruta_id', ACT.ruta.id).order('creado_en', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ent = m.data?.entrenado_en || null, ult = c.data?.creado_en || null;
  return { entrenado_en: ent, ultima_carga: ult, pendiente: Boolean(ult && (!ent || ult > ent)) };
}

const fechaHora = (fecha, minutos) => {
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60);
  return `${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`;
};
const minutosDe = (iso) => {
  const t = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map((x) => [x.type, x.value]));
  return +p.hour * 60 + +p.minute;
};

export async function programacionAprobada(fecha) {
  if (!enNube) return leerLocal('prog:' + fecha, null);
  const p = ok(await sb.from('programaciones').select('id, estado, aprobado_en, usuarios(nombre)').eq('ruta_id', ACT.ruta.id).eq('fecha', fecha).in('estado', ['aprobada', 'ejecutada']).maybeSingle());
  if (!p) return null;
  const s = ok(await sb.from('salidas').select('id, hora_programada, anden, carga_estimada, pasajeros_reales, regla, buses(codigo)').eq('programacion_id', p.id).order('hora_programada'));
  return {
    id: p.id, estado: p.estado, aprobado_en: p.aprobado_en, aprobado_por: p.usuarios?.nombre || '—',
    salidas: s.map((x) => ({ id: x.id, t: minutosDe(x.hora_programada), bus: x.buses?.codigo || '—', anden: x.anden === 2 ? 'B' : 'A', carga: x.carga_estimada, real: x.pasajeros_reales, regla: x.regla })),
  };
}

export async function aprobarProgramacion(fecha, salidas) {
  if (!enNube) {
    const prog = { id: fecha, estado: 'aprobada', aprobado_en: new Date().toISOString(), aprobado_por: ACT.usuario.nombre, salidas: salidas.map((x, i) => ({ id: i + 1, ...x, real: null })) };
    guardarLocal('prog:' + fecha, prog);
    return prog;
  }
  const previa = ok(await sb.from('programaciones').select('id').eq('ruta_id', ACT.ruta.id).eq('fecha', fecha).in('estado', ['aprobada', 'ejecutada']));
  for (const x of previa) ok(await sb.from('programaciones').update({ estado: 'anulada' }).eq('id', x.id));
  const pid = ACT.parametrosId || ok(await sb.from('parametros_vigentes').select('id').eq('ruta_id', ACT.ruta.id).maybeSingle())?.id;
  const prog = ok(await sb.from('programaciones').insert({
    ruta_id: ACT.ruta.id, fecha, modelo_id: ACT.modelo?.id ?? null, parametros_id: pid,
    estado: 'aprobada', aprobado_por: ACT.usuario.id, aprobado_en: new Date().toISOString(),
  }).select('id').single());
  const buses = ok(await sb.from('buses').select('id, codigo').eq('ruta_id', ACT.ruta.id));
  const idBus = Object.fromEntries(buses.map((b) => [b.codigo, b.id]));
  const filas = salidas.map((x) => ({
    programacion_id: prog.id, bus_id: idBus[x.bus] ?? null, hora_programada: fechaHora(fecha, x.t),
    anden: x.anden === 'B' ? 2 : 1, carga_estimada: Math.max(0, Math.round(x.carga)), regla: x.regla, origen: 'plan',
  }));
  for (let i = 0; i < filas.length; i += 400) ok(await sb.from('salidas').insert(filas.slice(i, i + 400)));
  return programacionAprobada(fecha);
}

export async function registrarPasajeros(fecha, salida, pasajeros) {
  if (!enNube) {
    const p = leerLocal('prog:' + fecha, null); if (!p) return;
    const s = p.salidas.find((x) => x.id === salida.id); if (s) s.real = pasajeros;
    guardarLocal('prog:' + fecha, p);
    return;
  }
  ok(await sb.from('salidas').update({ pasajeros_reales: pasajeros, hora_real: new Date().toISOString(), registrado_por: ACT.usuario.id }).eq('id', salida.id));
}

export async function listarUsuarios() {
  if (!enNube) return [ACT.usuario];
  return ok(await sb.from('usuarios').select('id, nombre, correo, rol, activo, creado_en').order('creado_en'));
}
export async function actualizarUsuario(id, cambios) {
  if (!enNube) return;
  ok(await sb.from('usuarios').update(cambios).eq('id', id));
}
export async function listarBuses() {
  if (!enNube) {
    const est = leerLocal('buses', {});
    return Array.from({ length: ACT.D.params.flota }, (_, i) => ({ id: i + 1, codigo: 'U-' + (101 + i), placa: null, capacidad: ACT.D.params.capacidad, estado: est[i + 1] || 'operativo' }));
  }
  return ok(await sb.from('buses').select('id, codigo, placa, capacidad, estado').eq('ruta_id', ACT.ruta.id).order('codigo'));
}
export async function actualizarBus(id, cambios) {
  if (!enNube) { const est = leerLocal('buses', {}); est[id] = cambios.estado; guardarLocal('buses', est); return; }
  ok(await sb.from('buses').update(cambios).eq('id', id));
}
