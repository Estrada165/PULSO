import { ACT } from './datos/fuente.js';
import { crearMotor } from './motor/despacho.js';
import { crearCalendario } from './lib/fechas.js';
import { AJUSTES_INICIALES } from './config.js';
import { css } from './lib/graficos.js';

export const D = ACT.D;
export const M = crearMotor(D);
export const cal = crearCalendario(D);
export const PARAMS_BASE = structuredClone(D.params);

function leer(clave, def) {
  try { const v = localStorage.getItem('pulso:' + clave); return v == null ? def : JSON.parse(v); } catch { return def; }
}
export function guardar(clave, valor) {
  try { localStorage.setItem('pulso:' + clave, JSON.stringify(valor)); } catch {  }
}

export const S = {
  dia: cal.indiceHoy,
  params: structuredClone(D.params),
  correccion: true,
  escenario: { activo: false, dia: cal.indiceHoy, inicio: 17 * 60, duracion: 150, intensidad: 0.4 },
  ajustes: { ...AJUSTES_INICIALES, ...leer('ajustes', {}) },
  res: null,
  buses: null,
  tCalc: 0,
};

export function recalcular() {
  const t0 = performance.now();
  S.res = M.semana(S.params, { correccion: S.correccion, escenario: S.escenario });
  S.buses = S.res.dias.map((d) => asignarBuses(d.inteligente.horas));
  S.tCalc = performance.now() - t0;
}

function asignarBuses(horas) {
  const flota = Array.from({ length: S.params.flota }, (_, i) => ({ id: i + 1, libre: 0 }));
  return horas.map((t) => {
    flota.sort((a, b) => a.libre - b.libre || a.id - b.id);
    const b = flota.find((x) => x.libre <= t + 1e-6) || flota[0];
    b.libre = t + M.ciclo(t);
    return 'U-' + String(100 + b.id);
  });
}

export function colores() {
  return {
    manual: css('--s-manual'), int: css('--s-int'), pro: css('--s-pro'), real: css('--s-real'),
    alerta: css('--alerta'), tinta3: css('--ink-3'),
  };
}

export function ventanaImprevisto(dia) {
  const e = S.escenario;
  if (!e.activo || e.dia !== dia) return null;
  return { i0: (e.inicio - M.INI) / M.I, i1: (e.inicio + e.duracion - M.INI) / M.I };
}

const oyentes = new Set();
export const alCambiar = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
export function notificar(motivo) { for (const fn of oyentes) fn(motivo); }

export function cambiarAjuste(clave, valor) {
  S.ajustes[clave] = valor;
  guardar('ajustes', S.ajustes);
  aplicarAjustes();
  notificar('ajustes:' + clave);
}
export function aplicarAjustes() {
  const r = document.documentElement;
  r.dataset.tema = S.ajustes.tema;
  r.dataset.menu = S.ajustes.menuContraido ? 'contraido' : 'abierto';
  r.dataset.vista = 'tecnica';
}

recalcular();
