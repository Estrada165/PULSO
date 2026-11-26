import { S, D, cal, alCambiar, aplicarAjustes, cambiarAjuste, notificar } from './estado.js';
import { MARCA } from './config.js';
import { icono, ISOTIPO } from './lib/iconos.js';
import { DIAS_CORTOS, MESES, esc } from './lib/formato.js';
import { cerrarInfo, aviso } from './ui.js';
import { ACT, enNube, salir, nombreRol } from './datos/fuente.js';
import { puede } from './permisos.js';
import { INSTALAR, instalar, instalada } from './pwa.js';
import { abrirGuia, cerrarGuia, guiaAutomatica, guiaAbierta, hayGuia, fijarUsuario, reiniciarGuias } from './guia/guia.js';

import panel from './vistas/resumen.js';
import programacion from './vistas/programacion.js';
import simulador from './vistas/envivo.js';
import pronostico from './vistas/pronostico.js';
import proxima from './vistas/futuro.js';
import demanda from './vistas/datos.js';
import carga from './vistas/carga.js';
import parametros from './vistas/parametros.js';
import usuarios from './vistas/usuarios.js';

const GRUPOS = [
  { nom: 'Operación', vistas: [panel, programacion, simulador] },
  { nom: 'Planificación', vistas: [pronostico, proxima, demanda] },
  { nom: 'Gestión', vistas: [carga, parametros, usuarios] },
].map((g) => ({ ...g, vistas: g.vistas.filter((v) => puede(v.id)) })).filter((g) => g.vistas.length);
const VISTAS = GRUPOS.flatMap((g) => g.vistas);
const TABS = VISTAS.slice(0, 4);
const LEMAS = {
  panel: 'Resumen de la semana en curso',
  programacion: 'Salidas del día y aprobación',
  simulador: 'La operación minuto a minuto',
  pronostico: 'Demanda estimada y precisión del modelo',
  proxima: 'Pronóstico de los próximos siete días',
  demanda: 'Patrones de afluencia del historial',
  carga: 'Importación de registros de abordaje',
  parametros: 'Reglas con que se calcula cada salida',
  usuarios: 'Cuentas, roles y unidades',
};
const SIN_DIAS = new Set(['carga', 'usuarios', 'demanda', 'proxima']);
const U = ACT.usuario;
const iniciales = (n) => (n || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
let actual = null;
const raizVista = () => document.querySelector('#vista');

fijarUsuario(U.id);

function estructura() {
  const navItem = (v) => `<a class="nav-item" href="#${v.id}" data-v="${v.id}" title="${v.nombre}"><span class="nav-ic">${icono(v.ic, 1.9)}</span><span class="nav-txt">${v.nombre}</span></a>`;
  document.querySelector('#app').innerHTML = `
  <a class="saltar-a" href="#vista">Ir al contenido</a>
  <div class="app">
    <aside class="menu" id="menu" aria-label="Secciones">
      <a class="marca" href="#panel">
        <span class="marca-logo">${ISOTIPO}</span>
        <span class="marca-txt"><b>${esc(MARCA.nombre)}</b><small>${esc(MARCA.subtitulo)}</small></span>
      </a>
      <div class="ruta-chip" title="${esc(D.ruta.nombre || '')}"><span class="rc-punto"></span><span class="nav-txt"><b>Ruta ${esc(D.ruta.codigo)}</b><small>${esc(D.ruta.nombre || `${D.ruta.km_ida} km · ${D.ruta.paraderos} paraderos`)}</small></span></div>
      <nav class="nav">
        ${GRUPOS.map((g) => `<div class="nav-grupo"><span>${g.nom}</span></div>${g.vistas.map(navItem).join('')}`).join('')}
      </nav>
      <div class="menu-pie">
        <button class="nav-item" id="contraer" title="Contraer o expandir el menú"><span class="nav-ic">${icono(S.ajustes.menuContraido ? 'expandir' : 'contraer', 1.9)}</span><span class="nav-txt">Contraer menú</span></button>
      </div>
    </aside>
    <div class="principal">
      <header class="barra">
        <a class="marca-movil solo-movil" href="#panel" aria-label="${esc(MARCA.nombre)}"><span class="marca-logo">${ISOTIPO}</span></a>
        <div class="barra-tit">
          <span class="barra-ic" id="barra-ic"></span>
          <div><b id="titulo-vista"></b><small id="lema-vista"></small></div>
        </div>
        <div class="dias-c" id="dias-c">
          <span class="dias-mes" id="dias-mes"></span>
          <div class="dias" id="dias" role="tablist" aria-label="Día de operación"></div>
        </div>
        <div class="barra-acc">
          <button class="tecla tecla-ic" id="btn-guia" aria-label="Ver guía de esta sección" title="Ver guía de esta sección">${icono('libro', 1.9)}</button>
          <button class="tecla tecla-ic" id="btn-tema" aria-label="Cambiar tema" title="Cambiar tema"></button>
          <div class="usuario-c">
            <button class="avatar-btn" id="btn-usuario" aria-haspopup="menu" aria-expanded="false" aria-label="Menú de ${esc(U.nombre)}"><span class="avatar">${iniciales(U.nombre)}</span><span class="av-txt"><b>${esc(U.nombre.split(' ')[0])}</b><small>${nombreRol(U.rol)}</small></span>${icono('abajo', 2)}</button>
            <div class="menu-usuario" id="menu-usuario" role="menu" hidden>
              <div class="mu-cab"><span class="avatar grande">${iniciales(U.nombre)}</span><div><b>${esc(U.nombre)}</b><small>${esc(U.local ? 'Instalación local' : U.correo)}</small><em class="chip-rol">${nombreRol(U.rol)}</em></div></div>
              <button role="menuitem" class="mu-item" id="mu-tema">${icono('luna', 1.9)}<span>Tema oscuro</span><span class="switch" id="mu-sw"><span></span></span></button>
              <button role="menuitem" class="mu-item" id="mu-instalar" hidden>${icono('instalar', 1.9)}<span>Instalar aplicación</span></button>
              <button role="menuitem" class="mu-item" id="mu-guias">${icono('libro', 1.9)}<span>Volver a ver las guías</span></button>
              ${enNube ? `<button role="menuitem" class="mu-item peligro" id="mu-salir">${icono('salir', 1.9)}<span>Cerrar sesión</span></button>` : ''}
              <div class="mu-pie">${esc(MARCA.empresa)} · ${esc(MARCA.nombre)} 2.0</div>
            </div>
          </div>
        </div>
      </header>
      <main class="vista" id="vista" tabindex="-1"></main>
      <footer class="pie"><span>${esc(MARCA.nombre)} · ${esc(MARCA.subtitulo)}</span><span>${esc(MARCA.empresa)} · Ruta ${esc(D.ruta.codigo)}</span></footer>
    </div>
  </div>
  <nav class="tabbar" aria-label="Secciones principales">
    ${TABS.map((v) => `<a href="#${v.id}" data-v="${v.id}"><span>${icono(v.ic, 1.9)}</span><small>${v.nombre.split(' ')[0]}</small></a>`).join('')}
    ${VISTAS.length > TABS.length ? `<button id="tab-mas" aria-haspopup="dialog"><span>${icono('puntos', 1.9)}</span><small>Más</small></button>` : ''}
  </nav>
  <div class="velo-mas" id="velo-mas"></div>
  <div class="hoja-mas" id="hoja-mas" role="dialog" aria-label="Todas las secciones">
    <span class="hm-asa"></span>
    ${GRUPOS.map((g) => `<div class="hm-grupo"><h4>${g.nom}</h4><div class="hm-rejilla">${g.vistas.map((v) => `<a href="#${v.id}" data-v="${v.id}"><span>${icono(v.ic, 1.9)}</span>${v.nombre}</a>`).join('')}</div></div>`).join('')}
  </div>`;
}

function pintarDias() {
  const cont = document.querySelector('#dias');
  const p0 = cal.partes(D.semana[0].fecha);
  document.querySelector('#dias-mes').textContent = MESES[p0.mes].slice(0, 3);
  cont.innerHTML = D.semana.map((d, i) => {
    const p = cal.partes(d.fecha);
    const imp = S.escenario.activo && S.escenario.dia === i;
    return `<button class="tecla tecla-dia ${i === S.dia ? 'presionada' : ''} ${i === cal.indiceHoy ? 'hoy' : ''} ${imp ? 'imprevisto' : ''}" data-i="${i}" role="tab" aria-selected="${i === S.dia}" title="${cal.largo(d.fecha)}${i === cal.indiceHoy ? ' (hoy)' : ''}">
      <span>${DIAS_CORTOS[i]}</span><b>${p.dia}</b>${i === cal.indiceHoy ? '<em>hoy</em>' : ''}</button>`;
  }).join('');
  cont.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      if (+b.dataset.i === S.dia) return;
      S.dia = +b.dataset.i; pintarDias(); cerrarInfo(); actual?.actualizar?.(raizVista(), 'dia');
    };
  });
}

function pintarTema() {
  const osc = S.ajustes.tema === 'oscuro';
  document.querySelector('#btn-tema').innerHTML = icono(osc ? 'sol' : 'luna', 1.9);
  const sw = document.querySelector('#mu-sw'); sw.classList.toggle('on', osc);
}

function pintarInstalar() {
  document.querySelector('#mu-instalar').hidden = !INSTALAR.evento || instalada();
}

function montarVista() {
  const id = location.hash.slice(1);
  const v = VISTAS.find((x) => x.id === id) || VISTAS[0];
  if (id && id !== v.id && !VISTAS.some((x) => x.id === id)) history.replaceState(null, '', '#' + v.id);
  if (actual && actual !== v) actual.desmontar?.();
  if (guiaAbierta()) cerrarGuia(false);
  cerrarInfo(); menuUsuario(false); hojaMas(false);
  actual = v;
  document.body.dataset.seccion = v.id;
  document.querySelectorAll('[data-v]').forEach((a) => {
    const on = a.dataset.v === v.id;
    a.classList.toggle('activo', on);
    if (a.tagName === 'A') on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  document.querySelector('#tab-mas')?.classList.toggle('activo', !TABS.includes(v));
  document.querySelector('#titulo-vista').textContent = v.nombre;
  document.querySelector('#lema-vista').textContent = LEMAS[v.id] || '';
  document.querySelector('#barra-ic').innerHTML = icono(v.ic, 1.9);
  document.querySelector('#dias-c').classList.toggle('oculto', SIN_DIAS.has(v.id));
  document.querySelector('#btn-guia').hidden = !hayGuia(v.id);
  document.title = `${v.nombre} · ${MARCA.nombre}`;
  const raiz = raizVista();
  raiz.classList.remove('entra'); void raiz.offsetWidth; raiz.classList.add('entra');
  v.montar(raiz);
  scrollTo({ top: 0 });
  guiaAutomatica(v.id, v.id === 'panel' ? 1200 : 800);
}

function cambiarTema(nuevo, origen) {
  if (nuevo === S.ajustes.tema) return;
  const aplicar = () => { cambiarAjuste('tema', nuevo); pintarTema(); actual?.desmontar?.(); actual.montar(raizVista()); };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { aplicar(); return; }
  const r = origen?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth - 40, y = r ? r.top + r.height / 2 : 30;
  const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const tr = document.startViewTransition(aplicar);
  tr.ready.then(() => document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
    { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
  )).catch(() => {});
}

function menuUsuario(abrir) {
  const m = document.querySelector('#menu-usuario'), b = document.querySelector('#btn-usuario');
  if (!m) return;
  const v = abrir ?? m.hidden;
  m.hidden = !v; b.setAttribute('aria-expanded', v);
  if (v) { pintarInstalar(); m.querySelector('.mu-item')?.focus(); }
}
function hojaMas(abrir) {
  document.body.classList.toggle('mas-abierto', Boolean(abrir));
  document.querySelector('#hoja-mas')?.classList.toggle('ver', Boolean(abrir));
}

function enlazar() {
  document.querySelector('#btn-tema').onclick = (e) => cambiarTema(S.ajustes.tema === 'oscuro' ? 'claro' : 'oscuro', e.currentTarget);
  document.querySelector('#mu-tema').onclick = (e) => cambiarTema(S.ajustes.tema === 'oscuro' ? 'claro' : 'oscuro', e.currentTarget);
  document.querySelector('#btn-guia').onclick = () => abrirGuia(actual.id);
  document.querySelector('#btn-usuario').onclick = (e) => { e.stopPropagation(); menuUsuario(); };
  document.querySelector('#mu-guias').onclick = () => { reiniciarGuias(); menuUsuario(false); abrirGuia(actual.id); };
  document.querySelector('#mu-instalar').onclick = async () => { menuUsuario(false); if (await instalar()) aviso('PULSO se instaló en tu dispositivo'); };
  const ms = document.querySelector('#mu-salir');
  if (ms) ms.onclick = () => { ms.disabled = true; salir(); };
  INSTALAR.oyentes.add(pintarInstalar);
  document.addEventListener('click', (e) => { if (!e.target.closest('.usuario-c')) menuUsuario(false); });
  document.querySelector('#tab-mas')?.addEventListener('click', () => hojaMas(true));
  document.querySelector('#velo-mas').onclick = () => hojaMas(false);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || guiaAbierta()) return;
    menuUsuario(false); hojaMas(false);
  });
  document.querySelector('#contraer').onclick = () => {
    cambiarAjuste('menuContraido', !S.ajustes.menuContraido);
    document.querySelector('#contraer .nav-ic').innerHTML = icono(S.ajustes.menuContraido ? 'expandir' : 'contraer', 1.9);
    setTimeout(() => actual?.actualizar?.(raizVista(), 'tamano'), 300);
  };
  window.addEventListener('hashchange', montarVista);
  let rz, ancho = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === ancho) return;
    ancho = innerWidth;
    clearTimeout(rz); rz = setTimeout(() => actual?.actualizar?.(raizVista(), 'tamano'), 160);
  });
  alCambiar((motivo) => { if (motivo === 'escenario') pintarDias(); });
}

aplicarAjustes();
estructura();
pintarDias();
pintarTema();
enlazar();
montarVista();
notificar('listo');
