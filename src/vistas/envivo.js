import { S, D, M, cal, colores, recalcular, notificar } from '../estado.js';
import { grafico, el } from '../lib/graficos.js';
import { fmt, hhmm } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, segmentado, alSegmentar, interruptor, REGLAS, info } from '../ui.js';
import { ticksHoras } from './resumen.js';

const V = { t: M.INI, play: false, vel: 60, directo: false, ult: 0, raf: 0, eventos: [], k: -1, raiz: null };
const slotHora = (i) => hhmm(M.INI + i * M.I);
const hhmmss = (m) => { const s = Math.floor(m * 60); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function plantilla() {
  const e = S.escenario;
  return `
  ${cabecera({
    eti: 'Simulación operativa',
    titulo: 'Simulador de despacho',
    desc: 'Reproduce el día elegido minuto a minuto con la demanda registrada. Comparal horario base con PULSO frente a los mismos pasajeros y prueba cómo responde ante un imprevisto.',
  })}
  <section class="rejilla g-vivo">
    <article class="tarjeta control">
      <div class="control-top">
        <div>
          <div class="reloj" id="reloj">05:00</div>
          <div class="reloj-sub" id="reloj-sub"></div>
        </div>
        <div class="controles">
          ${info('vivo_control')}
          <button class="tecla tecla-acento" id="play"></button>
          ${segmentado('vel', [['30', '×30'], ['60', '×60'], ['180', '×180']], V.vel)}
          <button class="tecla" id="directo">${icono('directo')}<span>En directo</span></button>
        </div>
      </div>
      <input type="range" class="deslizador" id="scrub" min="${M.INI}" max="${M.FIN - 1}" step="1" value="${V.t}" aria-label="Hora de la simulación">
      <div class="scrub-eje">${[5, 8, 11, 14, 17, 20, 23].map((h) => `<span>${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
      <div class="fila-info mt"><span>Corredor de la ruta</span>${info('corredor')}</div>
      <div class="corredor" id="corredor"></div>
    </article>
    <article class="tarjeta imprevisto ${e.activo ? 'activo' : ''}" id="card-imp">
      <div class="tarjeta-cab">
        <div><h3>${icono('rayo', 2)}Simular imprevisto${info('imprevisto')}</h3><p class="sub">lluvia, cierre de vía, evento masivo</p></div>
        ${interruptor('sw-imp', e.activo, 'Activar imprevisto')}
      </div>
      <div class="imp-campos">
        <label class="campo"><span>Inicio <output id="o-ini">${hhmm(e.inicio)}</output></span>
          <input type="range" class="deslizador" id="r-ini" min="${M.INI + 30}" max="${M.FIN - 60}" step="15" value="${e.inicio}"></label>
        <label class="campo"><span>Duración <output id="o-dur">${fmt(e.duracion / 60, 1)} h</output></span>
          <input type="range" class="deslizador" id="r-dur" min="30" max="300" step="15" value="${e.duracion}"></label>
        <label class="campo"><span>Demanda extra <output id="o-int">+${fmt(e.intensidad * 100)} %</output></span>
          <input type="range" class="deslizador" id="r-int" min="0.1" max="0.8" step="0.05" value="${e.intensidad}"></label>
      </div>
      <p class="imp-nota" id="imp-nota"></p>
    </article>
  </section>
  <section class="rejilla g-3 mt">
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Pasajeros esperando${info('cola')}</h3><p class="sub">en el terminal de salida</p></div></div>
      <div class="medidores" id="medidores"></div>
      <div class="datos-vivo" id="datos-vivo"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Demanda del día${info('vivo_demanda')}</h3><p class="sub">pronóstico frente a lo observado hasta ahora</p></div></div>
      <div id="g-vivo"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Bitácora del sistema${info('bitacora')}</h3><p class="sub">qué decidió y por qué</p></div></div>
      <div class="bitacora" id="bitacora"></div>
    </article>
  </section>`;
}

const MODOS = {
  capacidad: { tipo: 'regla', tit: 'Hora de mayor demanda', txt: (x, p) => `Cada bus sale cuando junta unos ${Math.round(p.capacidad * p.ocupacion_objetivo)} pasajeros. Intervalo actual: ${fmt(x.intervalo, 1)} min.` },
  espera_maxima: { tipo: 'info', tit: 'Baja la demanda', txt: (x, p) => `Hay poca gente: los buses salen cada ${p.espera_maxima} min para que nadie espere más que eso.` },
  anden: { tipo: 'alerta', tit: 'Andén al límite', txt: (x, p) => `Llega tanta gente que los buses salen cada ${fmt(p.intervalo_minimo, 1)} min, el mínimo físico del terminal.` },
  flota: { tipo: 'alerta', tit: 'Toda la flota en ruta', txt: () => 'No hay bus libre en el terminal: la siguiente salida espera el retorno de una unidad.' },
};

function construirEventos() {
  const tr = S.res.dias[S.dia].traza, ev = [], p = S.params;
  const e = S.escenario;
  if (e.activo && e.dia === S.dia) {
    ev.push({ t: e.inicio, tipo: 'alerta', tit: 'Empieza el imprevisto', txt: `Llega un ${fmt(e.intensidad * 100)} % más de gente de lo normal. El pronóstico no lo sabe; el horario base no cambia.` });
    ev.push({ t: e.inicio + e.duracion, tipo: 'ok', tit: 'Termina el imprevisto', txt: 'La demanda vuelve a su nivel normal.' });
  }
  let modo = null;
  for (let i = 0; i < tr.length; i++) {
    const r = tr[i].regla;
    if (r === modo) continue;
    const estable = tr.slice(i, i + 3).every((x) => x.regla === r) || r === 'flota';
    if (!estable) continue;
    ev.push({ t: tr[i].t, tipo: MODOS[r].tipo, tit: MODOS[r].tit, txt: MODOS[r].txt(tr[i], p) });
    modo = r;
  }
  let corrigiendo = 0;
  for (const x of tr) {
    const d = x.factor - 1;
    if (corrigiendo === 0 && Math.abs(d) > p.umbral_correccion) {
      corrigiendo = Math.sign(d);
      ev.push({ t: x.t, tipo: d > 0 ? 'alerta' : 'info', tit: d > 0 ? `Llegan ${fmt(d * 100)} % más pasajeros de lo previsto` : `Llegan ${fmt(-d * 100)} % menos pasajeros de lo previsto`,
        txt: d > 0 ? 'El sistema corrige su estimación y adelanta las salidas.' : 'El sistema corrige su estimación y espacia las salidas.' });
    } else if (corrigiendo !== 0 && Math.abs(d) < 0.05) {
      corrigiendo = 0;
      ev.push({ t: x.t, tipo: 'ok', tit: 'La demanda vuelve a lo previsto', txt: 'Se retira la corrección y el plan sigue al pronóstico.' });
    }
  }
  return ev.sort((a, b) => a.t - b.t);
}

function pintarCorredor(raiz, forzar) {
  const cont = raiz.querySelector('#corredor');
  const W = Math.max(280, cont.clientWidth), H = 178, l = 22, r = 22, iw = W - l - r;
  const clave = W + document.documentElement.dataset.tema;
  if (forzar || cont.dataset.k !== clave) {
    cont.dataset.k = clave; cont.innerHTML = '';
    const svg = el('svg', { width: W, height: H }, cont);
    [['manual', 'Con horario base', 22], ['int', 'Con PULSO', 100]].forEach(([id, nom, y]) => {
      const tx = el('text', { x: l, y: y - 8, class: 'eje carril-txt' }, svg); tx.textContent = nom.toUpperCase();
      const cnt = el('text', { x: W - r, y: y - 8, 'text-anchor': 'end', class: 'eje', id: 'cnt-' + id }, svg); cnt.textContent = '';
      el('rect', { x: l - 6, y: y, width: iw + 12, height: 40, rx: 12, class: 'carril' }, svg);
      el('line', { x1: l, x2: W - r, y1: y + 12, y2: y + 12, class: 'via' }, svg);
      el('line', { x1: l, x2: W - r, y1: y + 28, y2: y + 28, class: 'via' }, svg);
      const np = D.ruta.paraderos;
      for (let k = 0; k < np; k++) {
        const x = l + k * iw / (np - 1);
        el('circle', { cx: x, cy: y + 20, r: k === 0 || k === np - 1 ? 4.6 : 2.6, class: k === 0 || k === np - 1 ? 'terminal' : 'paradero' }, svg);
      }
      el('g', { id: 'buses-' + id }, svg);
    });
    const t1 = el('text', { x: l - 4, y: H - 8, class: 'eje' }, svg); t1.textContent = 'TERMINAL NORTE';
    const t2 = el('text', { x: W - r + 4, y: H - 8, 'text-anchor': 'end', class: 'eje' }, svg); t2.textContent = `TERMINAL SUR · ${D.ruta.km_ida} KM`;
  }
  const iwc = W - l - r;
  const dibujar = (id, horas, y, color) => {
    const g = cont.querySelector('#buses-' + id); g.innerHTML = '';
    let n = 0;
    for (const s of horas) {
      if (s > V.t) break;
      const c = M.ciclo(s), e = V.t - s;
      if (e >= c) continue;
      n++;
      const ida = e < c / 2, f = ida ? e / (c / 2) : 1 - (e - c / 2) / (c / 2);
      const x = l + f * iwc, yy = ida ? y + 12 : y + 28;
      const b = el('g', { class: ida ? 'bus' : 'bus vuelta', transform: `translate(${x - 9},${yy - 6})` }, g);
      el('rect', { width: 18, height: 12, rx: 3.5, fill: color }, b);
      el('rect', { x: ida ? 12.5 : 2.5, y: 2.5, width: 3, height: 4, rx: 1, class: 'vidrio' }, b);
      el('rect', { x: ida ? 3 : 7, y: 2.5, width: 7.5, height: 4, rx: 1, class: 'vidrio' }, b);
    }
    const cnt = cont.querySelector('#cnt-' + id); if (cnt) cnt.textContent = `${n} EN RUTA`;
    return n;
  };
  const c = colores();
  const dd = S.res.dias[S.dia];
  return [dibujar('manual', dd.manual.horas, 22, c.manual), dibujar('int', dd.inteligente.horas, 100, c.int)];
}

function cuadro() {
  const raiz = V.raiz; if (!raiz) return;
  const t = V.t, dd = S.res.dias[S.dia], d = D.semana[S.dia];
  raiz.querySelector('#reloj').textContent = V.directo ? hhmmss(t) : hhmm(Math.floor(t));
  const scrub = raiz.querySelector('#scrub');
  scrub.value = Math.floor(t);
  scrub.style.setProperty('--p', ((t - M.INI) / (M.FIN - 1 - M.INI) * 100) + '%');
  const fuera = V.directo && (cal.ahora() < M.INI || cal.ahora() >= M.FIN);
  raiz.querySelector('#reloj-sub').innerHTML = V.directo
    ? `<span class="en-directo"><i></i>En directo</span> ${fuera ? 'fuera del horario de operación (05:00 a 23:00)' : cal.largo(d.fecha) + ' · hora de este equipo'}`
    : `${cal.largo(d.fecha)}${V.play ? ` · reproduciendo ×${V.vel}` : ''}`;

  const [enM, enI] = pintarCorredor(raiz);
  const mi = Math.max(0, Math.min(M.FIN - M.INI - 1, Math.floor(t - M.INI)));
  const qm = dd.manual.cola_min[mi], qi = dd.inteligente.cola_min[mi];
  V.qmax ??= Math.max(120, ...dd.manual.cola_min, ...dd.inteligente.cola_min);
  const c = colores();
  const porFigura = Math.max(5, Math.ceil(V.qmax / 30 / 5) * 5);
  const medidor = (nom, q, col, n) => `<div class="medidor"><div class="med-fila"><span>${nom}<small>${n} buses en ruta</small></span><b>${fmt(q)}<small> personas</small></b></div><div class="personas-pista"><span class="personas" style="--n:${Math.ceil(q / porFigura)};--c:${col}"></span></div></div>`;
  raiz.querySelector('#medidores').innerHTML = medidor('Horario base', qm, c.manual, enM) + medidor('PULSO', qi, c.int, enI) + `<p class="leyenda-fig">Cada figura representa ${porFigura} personas</p>`;

  const tr = dd.traza;
  let ult = null; for (const x of tr) { if (x.t <= t) ult = x; else break; }
  const prox = tr.find((x) => x.t > t);
  raiz.querySelector('#datos-vivo').innerHTML = `
    <div><span>Próxima salida</span><b>${prox ? hhmm(prox.t) : '—'}</b></div>
    <div><span>Intervalo vigente</span><b>${ult ? fmt(ult.intervalo, 1) + ' min' : '—'}</b></div>
    <div><span>Ajuste en vivo</span><b class="${ult && ult.factor > 1.005 ? 'txt-acc' : ''}">${ult ? (ult.factor > 1 ? '+' : '') + fmt((ult.factor - 1) * 100) + ' %' : '—'}</b></div>
    <div><span>Regla</span><b>${ult ? REGLAS[ult.regla].nom : '—'}</b></div>`;

  const k = Math.min(D.operacion.n_intervalos, Math.floor(mi / M.I));
  if (k !== V.k) {
    V.k = k;
    const real = dd.real.map((v, i) => (i < k ? v : null));
    const e = S.escenario;
    const marcas = e.activo && e.dia === S.dia ? [{ i0: (e.inicio - M.INI) / M.I, i1: (e.inicio + e.duracion - M.INI) / M.I }] : [];
    grafico(raiz.querySelector('#g-vivo'), {
      n: D.operacion.n_intervalos, alto: 228, ml: 34, animar: false, xticks: ticksHoras(6), xlbl: slotHora, marcas, cursor: k,
      ymax: undefined, vfmt: (v) => fmt(v) + ' pas.',
      series: [
        { nom: 'Observado', tipo: 'barra', valores: real, color: c.real, opacidad: 0.55 },
        { nom: 'Pronóstico', tipo: 'linea', valores: d.prophet, color: c.pro, area: true },
      ],
    });
    const ev = V.eventos.filter((x) => x.t <= t).slice(-12).reverse();
    raiz.querySelector('#bitacora').innerHTML = ev.length
      ? ev.map((x, i) => `<div class="ev ${x.tipo} ${i === 0 ? 'reciente' : ''}"><time>${hhmm(x.t)}</time><div><b>${x.tit}</b><p>${x.txt}</p></div></div>`).join('')
      : `<div class="vacio">${icono('play', 2)}<p>Reproduce el día para ver las decisiones.</p></div>`;
  }
}

function bucle(now) {
  if (!V.play && !V.directo) return;
  const dt = (now - V.ult) / 1000; V.ult = now;
  if (V.directo) V.t = Math.min(M.FIN - 1, Math.max(M.INI, cal.ahora()));
  else V.t = Math.min(M.FIN - 1, V.t + dt * V.vel / 60);
  cuadro();
  if (!V.directo && V.t >= M.FIN - 1) { detener(); return; }
  V.raf = requestAnimationFrame(bucle);
}
function botonPlay() {
  const b = V.raiz?.querySelector('#play'); if (!b) return;
  b.innerHTML = V.play ? icono('pausa') + '<span>Pausar</span>' : icono('play') + '<span>Reproducir</span>';
  V.raiz.querySelector('#directo').classList.toggle('presionada', V.directo);
}
function detener() { V.play = false; V.directo = false; cancelAnimationFrame(V.raf); botonPlay(); cuadro(); }
function arrancar() { cancelAnimationFrame(V.raf); V.ult = performance.now(); V.raf = requestAnimationFrame(bucle); botonPlay(); }

function notaImprevisto(raiz) {
  const e = S.escenario;
  const p = raiz.querySelector('#imp-nota');
  if (!e.activo) { p.innerHTML = 'Desactivado. Al encenderlo se aplica al día elegido.'; return; }
  const dd = S.res.dias[e.dia];
  p.innerHTML = `Activo el <b>${cal.largo(D.semana[e.dia].fecha)}</b>. Espera promedio: manual <b>${fmt(dd.manual.espera_prom, 1)} min</b>, inteligente <b>${fmt(dd.inteligente.espera_prom, 1)} min</b>.`;
}

function enlazarImprevisto(raiz) {
  const e = S.escenario;
  let tt;
  const aplicar = () => { clearTimeout(tt); tt = setTimeout(() => { recalcular(); V.eventos = construirEventos(); V.k = -1; V.qmax = undefined; notaImprevisto(raiz); cuadro(); notificar('escenario'); }, 80); };
  raiz.querySelector('#sw-imp').onclick = (ev) => {
    e.activo = !e.activo; e.dia = S.dia;
    ev.currentTarget.classList.toggle('on', e.activo); ev.currentTarget.setAttribute('aria-checked', e.activo);
    raiz.querySelector('#card-imp').classList.toggle('activo', e.activo);
    aplicar();
  };
  const campo = (id, clave, out, f) => {
    const r = raiz.querySelector(id);
    const pintarR = () => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    pintarR();
    r.oninput = () => { e[clave] = +r.value; raiz.querySelector(out).textContent = f(+r.value); pintarR(); if (e.activo) { e.dia = S.dia; aplicar(); } };
  };
  campo('#r-ini', 'inicio', '#o-ini', hhmm);
  campo('#r-dur', 'duracion', '#o-dur', (v) => fmt(v / 60, 1) + ' h');
  campo('#r-int', 'intensidad', '#o-int', (v) => '+' + fmt(v * 100) + ' %');
}

export default {
  id: 'simulador', nombre: 'Simulador', ic: 'vivo',
  montar(raiz) {
    V.raiz = raiz; V.k = -1; V.qmax = undefined;
    raiz.innerHTML = plantilla();

    V.eventos = construirEventos();
    botonPlay();
    const esHoy = S.dia === cal.indiceHoy;
    const bd = raiz.querySelector('#directo');
    bd.disabled = !esHoy; bd.title = esHoy ? 'Seguir la hora real' : 'Disponible solo para el día de hoy';
    alSegmentar(raiz, 'vel', (v) => { V.vel = +v; if (V.directo) { V.directo = false; V.play = true; arrancar(); } cuadro(); });
    raiz.querySelector('#play').onclick = () => {
      if (V.play) { detener(); return; }
      V.directo = false; V.play = true;
      if (V.t >= M.FIN - 2) V.t = M.INI;
      arrancar();
    };
    bd.onclick = () => { if (V.directo) { detener(); return; } V.play = false; V.directo = true; arrancar(); };
    raiz.querySelector('#scrub').oninput = (ev) => { if (V.directo) { V.directo = false; botonPlay(); } V.t = +ev.target.value; cuadro(); };
    enlazarImprevisto(raiz);
    notaImprevisto(raiz);
    pintarCorredor(raiz, true);
    cuadro();
    if (V.play || V.directo) arrancar();
  },
  actualizar(raiz, motivo) {
    if (motivo === 'dia') { V.directo = false; this.montar(raiz); return; }
    V.eventos = construirEventos(); V.k = -1; V.qmax = undefined;
    pintarCorredor(raiz, true); notaImprevisto(raiz); cuadro();
  },
  desmontar() { V.play = false; V.directo = false; cancelAnimationFrame(V.raf); V.raiz = null; },
};
