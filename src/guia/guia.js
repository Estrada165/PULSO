import { icono } from '../lib/iconos.js';
import { GUIAS } from './pasos.js';

const PAD = 8, GAP = 14, MARGEN = 16;
let estado = { id: null, paso: 0, usuario: 'local' };
let capa = null, tarjeta = null, hueco = null, elemento = null, espera = 0;

const clave = (u, id) => `pulso-guia:${u}:${id}`;
const vista = (u, id) => { try { return localStorage.getItem(clave(u, id)) === '1'; } catch { return true; } };
const marcar = (u, id) => { try { localStorage.setItem(clave(u, id), '1'); } catch { } };

export const hayGuia = (id) => Boolean(GUIAS[id]);
export const guiaAbierta = () => Boolean(estado.id);
export function fijarUsuario(u) { estado.usuario = u || 'local'; }

export function reiniciarGuias() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(`pulso-guia:${estado.usuario}:`)).forEach((k) => localStorage.removeItem(k)); } catch { }
}

export function abrirGuia(id) {
  if (!GUIAS[id]) return;
  estado.id = id; estado.paso = 0;
  montar(); pintar();
}

export function cerrarGuia(marcarVista = true) {
  if (!estado.id) return;
  if (marcarVista) marcar(estado.usuario, estado.id);
  estado.id = null; estado.paso = 0;
  clearInterval(espera);
  window.removeEventListener('resize', medir);
  window.removeEventListener('scroll', medir, true);
  document.removeEventListener('keydown', teclas);
  if (capa) { const c = capa; c.classList.add('sale'); setTimeout(() => c.remove(), 180); }
  capa = tarjeta = hueco = elemento = null;
}

export function guiaAutomatica(id, retraso = 900) {
  if (!GUIAS[id] || vista(estado.usuario, id)) return;
  let intentos = 0;
  clearInterval(espera);
  setTimeout(() => {
    espera = setInterval(() => {
      if (estado.id || ++intentos > 30) return clearInterval(espera);
      if (document.querySelector('.pop-info.ver, body.ajustes-abierto, body.menu-abierto, .hoja-mas.ver, .modal.ver')) return;
      if (location.hash.slice(1).split('?')[0] !== id && !(id === 'panel' && !location.hash)) return clearInterval(espera);
      clearInterval(espera); abrirGuia(id);
    }, 350);
  }, retraso);
}

function siguiente() { const p = GUIAS[estado.id]; if (!p) return; estado.paso + 1 >= p.length ? cerrarGuia() : (estado.paso++, pintar()); }
function anterior() { if (estado.paso > 0) { estado.paso--; pintar(); } }
function teclas(e) {
  if (!estado.id) return;
  if (e.key === 'Escape') { e.stopPropagation(); cerrarGuia(); }
  else if (e.key === 'ArrowRight') siguiente();
  else if (e.key === 'ArrowLeft') anterior();
}

function montar() {
  if (capa) return;
  capa = document.createElement('div');
  capa.className = 'guia-capa';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-labelledby', 'guia-titulo');
  capa.innerHTML = '<div class="guia-hueco"></div><div class="guia-velo"></div><div class="guia-tarjeta" tabindex="-1"></div>';
  document.body.appendChild(capa);
  hueco = capa.querySelector('.guia-hueco');
  tarjeta = capa.querySelector('.guia-tarjeta');
  capa.querySelector('.guia-velo').onclick = () => cerrarGuia();
  window.addEventListener('resize', medir);
  window.addEventListener('scroll', medir, true);
  document.addEventListener('keydown', teclas, true);
}

function visible(sel) {
  if (!sel) return null;
  for (const s of [].concat(sel)) {
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > 4 && r.left < innerWidth - 4 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
}

function pintar() {
  const pasos = GUIAS[estado.id], p = pasos[estado.paso], ultimo = estado.paso === pasos.length - 1;
  tarjeta.innerHTML = `
    <button class="guia-x" aria-label="Cerrar guía">${icono('cerrar', 2)}</button>
    <p class="guia-paso">PASO ${estado.paso + 1} DE ${pasos.length}</p>
    <h2 id="guia-titulo">${p.titulo}</h2>
    <p class="guia-texto">${p.texto}</p>
    <div class="guia-pie">
      <div class="guia-puntos" aria-hidden="true">${pasos.map((_, i) => `<span class="${i === estado.paso ? 'on' : ''}"></span>`).join('')}</div>
      ${estado.paso === 0 ? '<button class="tecla tecla-sm" data-g="saltar">Saltar</button>' : '<button class="tecla tecla-sm" data-g="atras">Atrás</button>'}
      <button class="tecla tecla-sm tecla-acento" data-g="sig">${ultimo ? '¡Listo!' : 'Siguiente'}</button>
    </div>`;
  tarjeta.querySelector('.guia-x').onclick = () => cerrarGuia();
  tarjeta.querySelector('[data-g="sig"]').onclick = siguiente;
  const b = tarjeta.querySelector('[data-g="saltar"], [data-g="atras"]');
  b.onclick = b.dataset.g === 'saltar' ? () => cerrarGuia() : anterior;
  tarjeta.classList.remove('entra'); void tarjeta.offsetWidth; tarjeta.classList.add('entra');
  tarjeta.querySelector('[data-g="sig"]').focus({ preventScroll: true });

  clearInterval(espera);
  elemento = null;
  const enganchar = (el) => {
    elemento = el;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    medir(); setTimeout(medir, 380);
  };
  const el = visible(p.objetivo);
  if (el) enganchar(el);
  else {
    medir();
    if (p.objetivo) {
      let n = 0;
      espera = setInterval(() => { const e = visible(p.objetivo); if (e || ++n > 20) { clearInterval(espera); if (e) enganchar(e); } }, 150);
    }
  }
}

function medir() {
  if (!capa || !tarjeta) return;
  const vw = innerWidth, vh = innerHeight;
  const w = Math.min(350, vw - MARGEN * 2);
  tarjeta.style.width = w + 'px';
  const th = tarjeta.offsetHeight;
  const lim = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
  let pos;
  if (elemento && elemento.isConnected) {
    const r = elemento.getBoundingClientRect();
    const top = Math.max(r.top, PAD + 4), bottom = Math.min(r.bottom, vh - PAD - 4);
    const v = bottom > top ? { left: r.left, top, width: r.width, height: bottom - top } : r;
    const hx = v.left - PAD, hy = v.top - PAD, hw = v.width + PAD * 2, hh = v.height + PAD * 2;
    Object.assign(hueco.style, { left: hx + 'px', top: hy + 'px', width: hw + 'px', height: hh + 'px' });
    capa.classList.add('con-hueco');
    const cx = lim(hx + hw / 2 - w / 2, MARGEN, vw - w - MARGEN), cy = lim(hy + hh / 2 - th / 2, MARGEN, vh - th - MARGEN);
    if (hy + hh + GAP + th <= vh - MARGEN) pos = [cx, hy + hh + GAP];
    else if (hy - GAP - th >= MARGEN) pos = [cx, hy - GAP - th];
    else if (hx + hw + GAP + w <= vw - MARGEN) pos = [hx + hw + GAP, cy];
    else if (hx - GAP - w >= MARGEN) pos = [hx - GAP - w, cy];
    else pos = [cx, vh - th - MARGEN];
  } else {
    capa.classList.remove('con-hueco');
    pos = [(vw - w) / 2, Math.max(MARGEN, (vh - th) / 2)];
  }
  tarjeta.style.left = pos[0] + 'px';
  tarjeta.style.top = pos[1] + 'px';
}
