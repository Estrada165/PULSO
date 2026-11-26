import { icono } from './lib/iconos.js';
import { fmt } from './lib/formato.js';

export function cabecera({ eti, titulo, desc, acciones = '', guia = '' }) {
  return `
  <header class="cab" ${guia ? `data-guia="${guia}"` : ''}>
    <div class="cab-txt">
      ${eti ? `<div class="eti">${eti}</div>` : ''}
      <h2>${titulo}</h2>
      ${desc ? `<p>${desc}</p>` : ''}
    </div>
    ${acciones ? `<div class="cab-acc">${acciones}</div>` : ''}
  </header>`;
}

export function delta(antes, despues, { menorEsMejor = true, puntos = false, escala = 100 } = {}) {
  const dv = puntos ? (despues - antes) * escala : (antes ? (despues / antes - 1) * 100 : 0);
  const mejora = menorEsMejor ? dv < -0.05 : dv > 0.05;
  const empeora = menorEsMejor ? dv > 0.05 : dv < -0.05;
  const cls = mejora ? 'bien' : empeora ? 'mal' : 'igual';
  return `<span class="delta ${cls}">${icono(dv < 0 ? 'abajo' : 'arriba', 2.6)}${dv > 0 ? '+' : ''}${fmt(dv, 1)}${puntos ? ' ' + sigla('pp') : ' %'}</span>`;
}

export function kpi({ tag, valor, unidad = '', manual, d, propInt, propMan, inf }) {
  return `
  <article class="tarjeta kpi">
    <div class="kpi-tag"><span>${tag}</span>${inf ? info(inf) : ''}</div>
    <div class="kpi-valor">${valor}<small>${unidad}</small></div>
    <div class="kpi-pie">
      <span class="kpi-man">Horario base: <b>${manual}</b></span>
      ${d}
    </div>
    ${propInt != null ? `
    <div class="kpi-barras" aria-hidden="true">
      <span class="b-man" style="--w:${Math.max(3, Math.min(100, propMan * 100))}%"></span>
      <span class="b-int" style="--w:${Math.max(3, Math.min(100, propInt * 100))}%"></span>
    </div>` : ''}
  </article>`;
}

export const SIGLAS = {
  MAE: 'Error absoluto medio: en promedio, por cuántos pasajeros se equivoca el pronóstico en cada cuarto de hora.',
  RMSE: 'Raíz del error cuadrático medio: como el MAE, pero castiga más los errores grandes.',
  MAPE: 'Error porcentual absoluto medio: el error expresado como porcentaje de lo real.',
  p: 'Valor p: probabilidad de ver esta diferencia si en realidad no hubiera ninguna. Menor a 0.05 significa que la diferencia es real y no casualidad.',
  pp: 'Puntos porcentuales: la resta directa entre dos porcentajes (68 % − 63 % = 5 pp).',
  t: 'Estadístico t de Student: cuántas veces es mayor la diferencia promedio que su variación. Entre paréntesis, los grados de libertad.',
  z: 'Estadístico z de la prueba de Wilcoxon: qué tan lejos está el resultado de lo esperado si no hubiera diferencia.',
  H: 'Estadístico H de Kruskal-Wallis: mide cuánto difieren los grupos entre sí. Más alto, más diferencia.',
  gl: 'Grados de libertad: cantidad de grupos o datos que pueden variar libremente en la prueba.',
  IC: 'Intervalo de confianza del 95 %: rango donde, con 95 % de seguridad, está la diferencia verdadera.',
  r: 'Tamaño del efecto (0 a 1): qué tan grande es la diferencia en la práctica, más allá de si es significativa.',
  CO2: 'Dióxido de carbono: gas de efecto invernadero que emite el motor diésel al quemar combustible.',
};
export const sigla = (k, txt = k) => `<abbr class="sigla" tabindex="0" data-def="${SIGLAS[k]}">${txt}</abbr>`;
export function conSiglas(txt) {
  return txt
    .replace(/\b(MAE|RMSE|MAPE)\b/g, (m) => sigla(m))
    .replace(/\bp ([<=])/g, (m, s) => `${sigla('p')} ${s}`)
    .replace(/\bt\((\d+)\)/g, (m, g) => sigla('t', `t(${g})`))
    .replace(/\bz = /g, () => `${sigla('z')} = `)
    .replace(/\bH = /g, () => `${sigla('H')} = `)
    .replace(/\bgl (\d)/g, (m, g) => `${sigla('gl')} ${g}`)
    .replace(/IC 95 %/g, () => sigla('IC', 'IC 95 %'))
    .replace(/efecto r = /g, () => `efecto ${sigla('r')} = `)
    .replace(/(\d) pp\b/g, (m, d) => `${d} ${sigla('pp')}`);
}

export const plegable = (titulo, contenido, abierto = false, clase = '') =>
  `<details class="plegable ${clase}" ${abierto ? 'open' : ''}><summary><span>${titulo}</span>${icono('abajo', 2)}</summary><div class="pleg-c">${contenido}</div></details>`;

export function segmentado(nombre, opciones, activo) {
  return `<div class="segmentado" data-seg="${nombre}" role="group">${opciones.map(([v, t]) =>
    `<button class="tecla tecla-sm ${String(v) === String(activo) ? 'presionada' : ''}" data-v="${v}">${t}</button>`).join('')}</div>`;
}
export function alSegmentar(raiz, nombre, fn) {
  raiz.querySelectorAll(`[data-seg="${nombre}"] button`).forEach((b) => {
    b.onclick = () => {
      raiz.querySelectorAll(`[data-seg="${nombre}"] button`).forEach((x) => x.classList.toggle('presionada', x === b));
      fn(b.dataset.v);
    };
  });
}

export const interruptor = (id, on, etiqueta) =>
  `<button class="switch ${on ? 'on' : ''}" id="${id}" role="switch" aria-checked="${on}" aria-label="${etiqueta}"><span></span></button>`;

let tToast;
export function aviso(texto, tipo = 'ok') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.innerHTML = icono(tipo === 'error' ? 'alerta' : 'check', 2.4) + texto;
  t.classList.toggle('error', tipo === 'error');
  t.classList.add('ver');
  clearTimeout(tToast);
  tToast = setTimeout(() => t.classList.remove('ver'), tipo === 'error' ? 4200 : 2200);
}

export const REGLAS = {
  capacidad: { nom: 'Capacidad', txt: 'El bus sale al juntarse la carga objetivo', color: 'var(--s-int)' },
  espera_maxima: { nom: 'Espera máx.', txt: 'Hay poca demanda: manda el tope de espera', color: 'var(--s-manual)' },
  anden: { nom: 'Andén', txt: 'Se llegó al intervalo mínimo físico', color: 'var(--warn)' },
  flota: { nom: 'Flota', txt: 'No había bus libre: se esperó un retorno', color: 'var(--alerta)' },
};

import { contenidoInfo } from './explicaciones.js';

export const info = (clave) =>
  `<button class="info-btn" data-info="${clave}" aria-label="¿Qué significa?" title="¿Qué significa?">${icono('info', 2)}</button>`;

let popActual = null;
export function cerrarInfo() {
  if (!popActual) return;
  popActual.btn.classList.remove('activo');
  popActual.el.classList.remove('ver');
  const el = popActual.el; setTimeout(() => el.remove(), 180);
  popActual = null;
}
export function abrirInfo(btn) {
  const clave = btn.dataset.info;
  if (popActual && popActual.btn === btn) { cerrarInfo(); return; }
  cerrarInfo();
  const c = contenidoInfo(clave);
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'pop-info';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `
    <div class="pop-cab"><span class="pop-ic">${icono('info', 2)}</span><h4>${c.t}</h4><button class="pop-x" aria-label="Cerrar">${icono('cerrar', 2)}</button></div>
    <div class="pop-cuerpo">${c.b.map(([a, b]) => `<section><h5>${a}</h5><p>${b}</p></section>`).join('')}</div>
    ${c.frase ? `<div class="pop-frase"><span>En una frase</span><p>“${c.frase}”</p></div>` : ''}`;
  document.body.appendChild(el);
  btn.classList.add('activo');
  popActual = { el, btn };
  el.querySelector('.pop-x').onclick = cerrarInfo;
  if (innerWidth > 640) {
    const r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = r.right - w; if (left < 12) left = Math.min(r.left, innerWidth - w - 12);
    left = Math.max(12, left);
    let top = r.bottom + 10;
    if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 10);
    el.style.left = left + 'px'; el.style.top = top + 'px';
  } else el.classList.add('hoja');
  requestAnimationFrame(() => el.classList.add('ver'));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.info-btn');
  if (b) { e.stopPropagation(); abrirInfo(b); return; }
  if (popActual && !e.target.closest('.pop-info')) cerrarInfo();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarInfo(); });
window.addEventListener('scroll', () => { if (popActual && innerWidth > 640) cerrarInfo(); }, { passive: true });
