import { S, D, M, cal, colores, ventanaImprevisto } from '../estado.js';
import { grafico, leyenda, el, mostrarTip, ocultarTip } from '../lib/graficos.js';
import { fmt, hhmm } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, segmentado, alSegmentar, aviso, REGLAS, info } from '../ui.js';
import { programacionAprobada, aprobarProgramacion, registrarPasajeros } from '../datos/fuente.js';
import { puede } from '../permisos.js';
import { descargar } from '../lib/exportar.js';
import { ticksHoras } from './resumen.js';

const FRANJAS = [['todas', 'Todo el día', 0, 24], ['madrugada', '05–06 h', 5, 6], ['puntaam', 'Punta mañana', 6, 9], ['valle', 'Valle', 9, 16], ['puntapm', 'Punta tarde', 16, 20], ['noche', 'Noche', 20, 23]];
let franja = 'todas';
const N = D.operacion.n_intervalos;
const slotHora = (i) => hhmm(M.INI + i * M.I);

function plantilla() {
  return `
  ${cabecera({
    eti: `Ruta ${D.ruta.codigo}`,
    titulo: 'Programación de salidas',
    desc: 'Cada salida se calcula con la demanda pronosticada: el bus parte cuando se junta la carga objetivo, sin pasar la espera máxima ni el límite del andén, y solo si hay una unidad libre.',
    guia: 'pr-cab',
    acciones: `<button class="tecla tecla-sm" id="exportar">${icono('descargar', 2)}<span>CSV</span></button><button class="tecla tecla-sm" id="imprimir">${icono('imprimir', 2)}<span>Imprimir</span></button>`,
  })}
  <section class="aprob" id="aprob" data-guia="pr-aprob"></section>
  <article class="tarjeta pizarra-c" data-guia="pr-pizarra">
    <div class="tarjeta-cab"><div><h3>${icono('bus', 2)}Próximas salidas${info('pizarra')}</h3><p class="sub" id="sub-pizarra"></p></div><span class="reloj-mini mono" id="pizarra-hora"></span></div>
    <div class="pizarra" id="pizarra"></div>
  </article>
  <div class="fila-info mt"><span>Resumen del día</span>${info('prog_kpis')}</div>
  <section class="rejilla g-4" id="resumen-prog" data-guia="pr-kpis"></section>
  <article class="tarjeta mt">
    <div class="tarjeta-cab"><div><h3>Minutos entre salidas${info('headway')}</h3><p class="sub" id="sub-hw"></p></div><div id="ley-hw"></div></div>
    <div id="g-hw"></div>
    <div id="tiras" class="tiras"></div>
  </article>
  <article class="tarjeta mt" data-guia="pr-tabla">
    <div class="tarjeta-cab">
      <div><h3>Cronograma de salidas${info('cronograma')}</h3><p class="sub" id="sub-tabla"></p></div>
      ${segmentado('franja', FRANJAS.map((f) => [f[0], f[1]]), franja)}
    </div>
    <div class="tabla-c"><table>
      <thead><tr><th>Salida</th><th>Unidad</th><th class="n">Intervalo</th><th class="n solo-tecnica">Demanda de diseño</th><th class="n">Ocupación</th><th>Regla aplicada</th><th class="n solo-tecnica">Ajuste en vivo</th><th class="n" id="th-real" hidden>Pasajeros reales</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table></div>
  </article>`;
}

let aprobada = null, diaAprob = -1;
const fechaDia = () => cal.visible(S.res.dias[S.dia].fecha);

function filasDia() {
  const dd = S.res.dias[S.dia], tr = dd.traza, oc = dd.inteligente.ocupaciones, buses = S.buses[S.dia];
  return tr.map((x, i) => ({
    t: x.t, bus: buses[i], anden: i % 2 ? 'B' : 'A', carga: Math.round(x.demanda), regla: x.regla, factor: x.factor,
    oc: oc[i], hw: i < tr.length - 1 ? tr[i + 1].t - x.t : x.intervalo, demanda: x.demanda,
  }));
}

function tabla(raiz) {
  const dd = S.res.dias[S.dia];
  const F = FRANJAS.find((f) => f[0] === franja);
  const base = filasDia();
  const conReal = Boolean(aprobada);
  const reales = conReal ? Object.fromEntries(aprobada.salidas.map((x) => [Math.round(x.t), x])) : {};
  const editable = conReal && puede('registrar') && S.dia <= cal.indiceHoy;
  raiz.querySelector('#th-real').hidden = !conReal;
  const filas = base.filter((x) => x.t >= F[2] * 60 && x.t < F[3] * 60);
  raiz.querySelector('#sub-tabla').textContent = `${filas.length} salidas · ${cal.largo(dd.fecha)}`;
  raiz.querySelector('#tbody').innerHTML = filas.map((x) => {
    const R = REGLAS[x.regla], f = x.factor;
    const aj = Math.abs(f - 1) < 0.005 ? '<span class="tenue">—</span>' : `<span class="${f > 1 ? 'txt-acc' : 'txt-pro'}">${f > 1 ? '+' : ''}${fmt((f - 1) * 100)} %</span>`;
    const sa = reales[Math.round(x.t)];
    const celdaReal = !conReal ? '' : `<td class="n">${!sa ? '<span class="tenue">—</span>' : editable
      ? `<input class="in-real" type="number" min="0" max="200" inputmode="numeric" value="${sa.real ?? ''}" data-id="${sa.id}" aria-label="Pasajeros reales de la salida ${hhmm(x.t)}" placeholder="—">`
      : sa.real ?? '<span class="tenue">—</span>'}</td>`;
    return `<tr>
      <td class="mono fuerte">${hhmm(x.t)}</td>
      <td><span class="unidad">${icono('bus', 1.8)}${x.bus}</span></td>
      <td class="n">${fmt(x.hw, 1)} min</td>
      <td class="n solo-tecnica">${fmt(x.demanda)} <span class="tenue">pas.</span></td>
      <td class="n"><span class="ocup">${fmt(x.oc * 100)} %<i><b style="--w:${Math.min(100, x.oc * 100)}%"></b></i></span></td>
      <td><span class="regla" title="${R.txt}"><i style="background:${R.color}"></i>${R.nom}</span></td>
      <td class="n solo-tecnica">${aj}</td>${celdaReal}</tr>`;
  }).join('');
  raiz.querySelectorAll('.in-real').forEach((inp) => {
    inp.onchange = async () => {
      const v = inp.value === '' ? null : Math.max(0, Math.round(+inp.value));
      const sa = aprobada.salidas.find((x) => String(x.id) === inp.dataset.id);
      try { await registrarPasajeros(fechaDia(), sa, v); sa.real = v; inp.classList.add('ok'); setTimeout(() => inp.classList.remove('ok'), 900); pintarAprob(raiz); }
      catch (e) { aviso(e.message, 'error'); }
    };
  });
}

function pintarAprob(raiz) {
  const cont = raiz.querySelector('#aprob'); if (!cont) return;
  const n = S.res.dias[S.dia].inteligente.salidas;
  if (aprobada) {
    const reg = aprobada.salidas.filter((x) => x.real != null).length;
    const f = new Date(aprobada.aprobado_en);
    cont.className = 'aprob ok';
    cont.innerHTML = `<span class="ap-ic">${icono('check', 2.4)}</span>
      <div><b>Programación aprobada</b><small>${aprobada.aprobado_por} · ${f.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} ${f.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · ${fmt(aprobada.salidas.length)} salidas</small></div>
      <div class="ap-prog"><span>Pasajeros registrados</span><b>${fmt(reg)} / ${fmt(aprobada.salidas.length)}</b><i><em style="width:${reg / aprobada.salidas.length * 100}%"></em></i></div>
      ${puede('aprobar') ? `<button class="tecla tecla-sm" id="reaprobar">${icono('reiniciar', 2)}<span>Volver a aprobar</span></button>` : ''}`;
  } else {
    cont.className = 'aprob';
    cont.innerHTML = `<span class="ap-ic">${icono('reloj', 2.2)}</span>
      <div><b>Borrador · pendiente de aprobación</b><small>${fmt(n)} salidas calculadas para ${cal.largo(S.res.dias[S.dia].fecha)}. ${puede('aprobar') ? 'Al aprobarla, queda publicada para los despachadores.' : 'El jefe de operaciones debe aprobarla.'}</small></div>
      ${puede('aprobar') ? `<button class="tecla tecla-sm tecla-acento" id="aprobar">${icono('check', 2.4)}<span>Aprobar programación</span></button>` : ''}`;
  }
  const btn = cont.querySelector('#aprobar, #reaprobar');
  if (btn) btn.onclick = async () => {
    if (aprobada && !confirmar(btn)) return;
    btn.disabled = true; btn.classList.add('cargando');
    try {
      aprobada = await aprobarProgramacion(fechaDia(), filasDia().map(({ t, bus, anden, carga, regla }) => ({ t, bus, anden, carga, regla })));
      aviso('Programación aprobada y publicada');
      pintarAprob(raiz); tabla(raiz);
    } catch (e) { aviso(e.message, 'error'); btn.disabled = false; btn.classList.remove('cargando'); }
  };
}
function confirmar(btn) {
  if (btn.dataset.confirma) return true;
  btn.dataset.confirma = '1'; btn.querySelector('span').textContent = '¿Reemplazar? Pulsa otra vez';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.confirma; btn.querySelector('span').textContent = 'Volver a aprobar'; } }, 3500);
  return false;
}

async function cargarAprob(raiz) {
  const dia = S.dia; diaAprob = dia;
  aprobada = null; pintarAprob(raiz);
  try { const p = await programacionAprobada(fechaDia()); if (diaAprob !== dia) return; aprobada = p; }
  catch { aprobada = null; }
  if (!raiz.isConnected) return;
  pintarAprob(raiz); tabla(raiz);
}

let relojPizarra = 0;
function pizarra(raiz) {
  const cont = raiz.querySelector('#pizarra'); if (!cont) return;
  const dd = S.res.dias[S.dia], tr = dd.traza, b = S.buses[S.dia], oc = dd.inteligente.ocupaciones;
  const esHoy = S.dia === cal.indiceHoy;
  const ahora = cal.ahora();
  const ref = esHoy && ahora >= M.INI && ahora < M.FIN ? ahora : 7 * 60;
  raiz.querySelector('#sub-pizarra').textContent = esHoy && ref === ahora ? 'Terminal Norte · ahora mismo' : `Terminal Norte · ${cal.largo(dd.fecha)} desde las 07:00`;
  raiz.querySelector('#pizarra-hora').textContent = hhmm(ref);
  let i0 = tr.findIndex((x) => x.t >= ref); if (i0 < 0) i0 = tr.length;
  const filas = tr.slice(Math.max(0, i0 - 1), Math.max(0, i0 - 1) + 7);
  cont.innerHTML = `<div class="pz-fila pz-cab"><span>Hora</span><span>Unidad</span><span>Destino</span><span>Andén</span><span>Carga</span><span>Estado</span></div>` +
    filas.map((x) => {
      const i = tr.indexOf(x), dif = x.t - ref;
      const est = dif < 0 ? ['salio', 'Salió'] : dif <= 2 ? ['abordando', 'Abordando'] : ['prog', `En ${fmt(Math.round(dif))} min`];
      const carga = oc[i] >= 0.9 ? 'Llena' : oc[i] >= 0.6 ? 'Media' : 'Ligera';
      return `<div class="pz-fila ${est[0]}"><span class="pz-hora">${hhmm(x.t)}</span><span>${b[i]}</span><span>Terminal Sur</span><span>${i % 2 ? 'B' : 'A'}</span><span>${carga}</span><span class="pz-est"><i></i>${est[1]}</span></div>`;
    }).join('');
}

function pintar(raiz) {
  const c = colores();
  pizarra(raiz);
  const dd = S.res.dias[S.dia], tr = dd.traza, hm = dd.manual.horas;
  const hw = tr.slice(0, -1).map((x, i) => tr[i + 1].t - x.t);
  const unicas = new Set(S.buses[S.dia]).size;
  const t = (tag, valor, u, pie) => `<article class="tarjeta kpi compacto"><div class="kpi-tag">${tag}</div><div class="kpi-valor">${valor}<small>${u}</small></div><div class="kpi-pie"><span class="kpi-man">${pie}</span></div></article>`;
  raiz.querySelector('#resumen-prog').innerHTML = [
    t('Salidas programadas', fmt(dd.inteligente.salidas), '', `Horario base: <b>${fmt(dd.manual.salidas)}</b>`),
    t('Primera y última', hhmm(tr[0].t), ' – ' + hhmm(tr[tr.length - 1].t), `Horario base: <b>${hhmm(hm[0])} – ${hhmm(hm[hm.length - 1])}</b>`),
    t('Intervalo', fmt(Math.min(...hw), 1) + '–' + fmt(Math.max(...hw), 1), 'min', 'Se adapta a la demanda'),
    t('Unidades en servicio', fmt(unicas), `de ${S.params.flota}`, `Ocupación media <b>${fmt(dd.inteligente.ocupacion_prom * 100, 1)} %</b>`),
  ].join('');

  raiz.querySelector('#sub-hw').textContent = `${cal.largo(dd.fecha)} · la línea discontinua es la espera máxima permitida`;
  raiz.querySelector('#ley-hw').innerHTML = leyenda([{ nom: 'Horario base', color: c.manual }, { nom: 'PULSO', color: c.int }]);
  const hwSlot = (horas) => {
    const a = new Array(N).fill(null), cnt = new Array(N).fill(0);
    for (let j = 0; j < horas.length - 1; j++) { const k = Math.floor((horas[j] - M.INI) / M.I); if (k < 0 || k >= N) continue; a[k] = (a[k] || 0) + (horas[j + 1] - horas[j]); cnt[k]++; }
    let prev = null; return a.map((v, k) => { if (cnt[k]) prev = v / cnt[k]; return prev; });
  };
  const v = ventanaImprevisto(S.dia);
  grafico(raiz.querySelector('#g-hw'), {
    n: N, alto: 230, ml: 34, xticks: ticksHoras(), xlbl: slotHora, marcas: v ? [{ ...v, lbl: 'imprevisto' }] : [],
    vfmt: (x) => fmt(x, 1) + ' min', yfmt: (x) => fmt(x),
    refs: [{ y: S.params.espera_maxima, lbl: `espera máxima ${S.params.espera_maxima} min` }],
    ymax: Math.ceil((Math.max(14, S.params.espera_maxima + 2) + 0.01) / 4) * 4,
    series: [
      { nom: 'Horario base', tipo: 'escalon', valores: hwSlot(hm), color: c.manual, grosor: 1.8 },
      { nom: 'PULSO', tipo: 'escalon', valores: hwSlot(dd.inteligente.horas), color: c.int, grosor: 2.4 },
    ],
  });

  const cont = raiz.querySelector('#tiras'); cont.innerHTML = '';
  const W = Math.max(260, cont.clientWidth), H = 72, l = 92, r = 8, iw = W - l - r;
  const svg = el('svg', { width: W, height: H }, cont);
  const X = (m) => l + (m - M.INI) / (M.FIN - M.INI) * iw;
  [['Horario base', hm, c.manual, 6], ['PULSO', dd.inteligente.horas, c.int, 40]].forEach(([nom, hs, col, y]) => {
    const tx = el('text', { x: 0, y: y + 16, class: 'eje' }, svg); tx.textContent = nom.toUpperCase();
    el('rect', { x: l, y, width: iw, height: 26, rx: 7, class: 'pista' }, svg);
    for (const h of hs) el('rect', { x: X(h) - 0.7, y: y + 5, width: 1.5, height: 16, rx: 0.75, fill: col }, svg);
    const capa = el('rect', { x: l, y, width: iw, height: 26, fill: 'transparent' }, svg);
    capa.addEventListener('pointermove', (ev) => {
      const rr = svg.getBoundingClientRect(), mm = M.INI + (ev.clientX - rr.left - l) / iw * (M.FIN - M.INI);
      const ant = hs.filter((x) => x <= mm).length;
      mostrarTip(svg, ev.clientX - rr.left, y + 13, `<div class="tip-t">${nom} · ${hhmm(mm)}</div><div class="tip-f"><span>Salidas hasta esta hora</span><b>${ant}</b></div>`);
    });
    capa.addEventListener('pointerleave', ocultarTip);
  });
  tabla(raiz);
}

export default {
  id: 'programacion', nombre: 'Programación', ic: 'programacion',
  montar(raiz) {
    raiz.innerHTML = plantilla();

    alSegmentar(raiz, 'franja', (v) => { franja = v; tabla(raiz); });
    raiz.querySelector('#exportar').onclick = () => {
      const dd = S.res.dias[S.dia], f = fechaDia();
      const filas = [['fecha', 'salida', 'unidad', 'anden', 'intervalo_min', 'demanda_estimada', 'ocupacion_pct', 'regla', 'pasajeros_reales']];
      const reales = aprobada ? Object.fromEntries(aprobada.salidas.map((x) => [Math.round(x.t), x.real])) : {};
      for (const x of filasDia()) filas.push([f, hhmm(x.t), x.bus, x.anden, x.hw.toFixed(2), x.demanda, (x.oc * 100).toFixed(1), REGLAS[x.regla].nom, reales[Math.round(x.t)] ?? '']);
      descargar(`programacion_${D.ruta.codigo}_${f}.csv`, filas);
      aviso(`Programación del ${cal.corto(dd.fecha)} descargada`);
    };
    raiz.querySelector('#imprimir').onclick = () => window.print();
    pintar(raiz);
    cargarAprob(raiz);
    clearInterval(relojPizarra); relojPizarra = setInterval(() => pizarra(raiz), 20000);
  },
  actualizar(raiz, motivo) { pintar(raiz); if (motivo === 'dia') cargarAprob(raiz); else pintarAprob(raiz); },
  desmontar() { clearInterval(relojPizarra); },
};
