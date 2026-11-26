import { S, D, M, cal, colores, ventanaImprevisto } from '../estado.js';
import { grafico, leyenda, escalaBonita } from '../lib/graficos.js';
import { fmt, hhmm, DIAS_CORTOS, MESES_CORTOS } from '../lib/formato.js';
import { cabecera, segmentado, alSegmentar, info, conSiglas, sigla } from '../ui.js';
import { icono } from '../lib/iconos.js';
import { ticksHoras } from './resumen.js';

let alcance = 'dia';
let tipoComp = 'laboral';
const slotHora = (i) => hhmm(M.INI + i * M.I);

function plantilla() {
  return `
  ${cabecera({
    eti: 'Modelo de pronóstico',
    titulo: 'Pronóstico y precisión',
    desc: 'Demanda estimada para cada intervalo de 15 minutos frente a lo registrado. El modelo aprende del historial cómo cambia la afluencia según la hora, el día y los feriados.',
    acciones: segmentado('alcance-p', [['dia', 'Día elegido'], ['semana', 'Semana']], alcance),
  })}
  <section class="pregunta" id="pregunta"></section>
  <section class="rejilla g-2 mt">
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Demanda real y pronosticada${info('pron_principal')}</h3><p class="sub" id="sub-pron"></p></div><div id="ley-pron"></div></div>
      <div id="g-pron"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>¿Qué tanto acierta?${info('error')}</h3><p class="sub">semana de validación · ${fmt(D.semana.length * D.operacion.n_intervalos)} intervalos</p></div></div>
      <div class="solo-simple acierto" id="acierto"></div>
      <div class="metricas solo-tecnica" id="metricas"></div>
      <p class="lectura solo-tecnica" id="lectura"></p>
    </article>
  </section>
  <details class="plegable mt" id="pleg-comp" ><summary><span>Cómo lo calcula el modelo</span>${icono('abajo', 2)}</summary><div class="pleg-c">
  <section class="rejilla g-3">
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Patrón diario${info('patron_diario')}</h3><p class="sub">multiplicador sobre el nivel base</p></div></div>
      ${segmentado('comp', [['laboral', 'Laboral'], ['sabado', 'Sábado'], ['domingo', 'Domingo y feriado']], tipoComp)}
      <div id="g-c1" class="mt-s"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Efecto del día de la semana${info('efecto_semana')}</h3><p class="sub">ajuste respecto al promedio</p></div></div>
      <div id="g-c2"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Tendencia${info('tendencia')}</h3><p class="sub">nivel base de pasajeros por intervalo</p></div></div>
      <div id="g-c3"></div>
    </article>
  </section></div></details>`;
}

function pintarPrincipal(raiz) {
  const c = colores();
  raiz.querySelector('#ley-pron').innerHTML = leyenda([
    { nom: 'Lo que pasó', color: c.real, forma: 'caja' }, { nom: 'Pronóstico del modelo', color: c.pro },
    { nom: 'Margen probable', color: c.pro, forma: 'caja suave' }, { nom: 'Método actual', color: c.manual, forma: 'punteada' },
  ]);
  let real, pr, lo, hi, emp, xl, xt, marcas = [];
  if (alcance === 'dia') {
    const d = D.semana[S.dia];
    real = S.res.dias[S.dia].real; pr = d.prophet; lo = d.inf; hi = d.sup; emp = d.empirico;
    xl = slotHora; xt = ticksHoras();
    const v = ventanaImprevisto(S.dia); if (v) marcas = [{ ...v, lbl: 'imprevisto' }];
    raiz.querySelector('#sub-pron').textContent = `${cal.largo(d.fecha)} · pasajeros cada 15 minutos`;
  } else {
    const cat = (k) => D.semana.flatMap((d) => d[k]);
    real = S.res.dias.flatMap((d) => d.real); pr = cat('prophet'); lo = cat('inf'); hi = cat('sup'); emp = cat('empirico');
    const n = D.operacion.n_intervalos;
    xl = (i) => `${DIAS_CORTOS[Math.floor(i / n)]} ${cal.corto(D.semana[Math.floor(i / n)].fecha)} · ${slotHora(i % n)}`;
    xt = DIAS_CORTOS.map((d, i) => ({ i: i * n + n / 2, lbl: d }));
    const v = S.escenario.activo ? ventanaImprevisto(S.escenario.dia) : null;
    if (v) marcas = [{ i0: S.escenario.dia * n + v.i0, i1: S.escenario.dia * n + v.i1 }];
    raiz.querySelector('#sub-pron').textContent = `Semana del ${cal.rangoSemana()}`;
  }
  grafico(raiz.querySelector('#g-pron'), {
    n: real.length, alto: 310, xticks: xt, xlbl: xl, marcas, vfmt: (v) => fmt(v) + ' personas',
    series: [
      { nom: 'Lo que pasó', tipo: 'barra', valores: real, color: c.real, opacidad: 0.45 },
      { nom: 'Margen probable', tipo: 'banda', lo, hi, valores: pr, color: c.pro },
      { nom: 'Método actual', tipo: 'linea', valores: emp, color: c.manual, punteada: true, grosor: 1.6, sinPunto: true },
      { nom: 'Pronóstico del modelo', tipo: 'linea', valores: pr, color: c.pro, grosor: 2.3 },
    ],
  });
}

function pintarComp(raiz) {
  const c = colores();
  const C = D.metricas.componentes;
  const mult = (a) => a.map((v) => 1 + v);
  const tope = escalaBonita(Math.max(...mult(C.laboral), ...mult(C.sabado), ...mult(C.domingo)));
  grafico(raiz.querySelector('#g-c1'), {
    n: D.operacion.n_intervalos, alto: 196, ml: 36, ymax: tope, xticks: ticksHoras(6), xlbl: slotHora,
    yfmt: (v) => '×' + (+v.toFixed(2)).toLocaleString('es-PE'), vfmt: (v) => '×' + fmt(v, 2),
    refs: [{ y: 1, lbl: 'nivel base' }],
    series: [{ nom: 'Multiplicador', tipo: 'linea', valores: mult(C[tipoComp]), color: c.pro, area: true }],
  });
}

function pregunta(raiz) {
  const d = D.semana[S.dia], pr = d.prophet;
  const total = pr.reduce((a, b) => a + b, 0);
  let k = 0; pr.forEach((v, i) => { if (v > pr[k]) k = i; });
  let km = 16; for (let i = 16; i < 60; i++) if (pr[i] < pr[km]) km = i;
  const hoy = S.dia === cal.indiceHoy;
  raiz.querySelector('#pregunta').innerHTML = `
    <div class="preg-txt">
      <span class="eti">${hoy ? 'Hoy' : cal.largo(d.fecha)}</span>
      <h3>¿Cuánta gente ${hoy ? 'vendrá hoy' : 'se esperaba ese día'}?</h3>
      <p>El modelo estima unas <b>${fmt(Math.round(total / 100) * 100)} personas</b> en el terminal entre las 05:00 y las 23:00.</p>
    </div>
    <div class="preg-datos">
      <div><span>Hora más cargada</span><b>${hhmm(M.INI + k * M.I)}</b><small>unas ${fmt(pr[k])} personas en 15 min</small></div>
      <div><span>Hora más tranquila del día</span><b>${hhmm(M.INI + km * M.I)}</b><small>unas ${fmt(pr[km])} personas en 15 min</small></div>
      <div><span>Margen de error típico</span><b>±${fmt(D.metricas.prophet.MAE)}</b><small>personas por cuarto de hora</small></div>
    </div>`;
}

function pintarComponentes(raiz) {
  const det = raiz.querySelector('#pleg-comp');
  if (!det || !det.open) return;
  const c = colores();
  pintarComp(raiz);
  const C = D.metricas.componentes;
  const sem = C.semanal.map((v) => v * 100), lim = escalaBonita(Math.max(...sem.map(Math.abs)) * 1.05);
  grafico(raiz.querySelector('#g-c2'), {
    n: 7, alto: 238, ml: 40, ymin: -lim, ymax: lim, anchoBarra: 0.5,
    xticks: DIAS_CORTOS.map((d, i) => ({ i: i + 0.5, lbl: d })), xlbl: (i) => DIAS_CORTOS[i],
    vfmt: (v) => (v > 0 ? '+' : '') + fmt(v, 1) + ' %', yfmt: (v) => (v > 0 ? '+' : '') + fmt(v) + '%',
    series: [{ nom: 'Efecto', tipo: 'barra', valores: sem, color: c.pro }],
  });
  const tr = C.tendencia;
  const ini = new Date(D.historico.desde + 'T12:00:00Z');
  const fechaI = (i) => new Date(ini.getTime() + (i + cal.desfase) * 864e5);
  const xt = [];
  tr.forEach((_, i) => { const f = fechaI(i); if (f.getUTCDate() === 1) xt.push({ i: i + 0.5, lbl: MESES_CORTOS[f.getUTCMonth()], anchor: 'start' }); });
  grafico(raiz.querySelector('#g-c3'), {
    n: tr.length, alto: 238, ml: 36, ymax: escalaBonita(Math.max(...tr) * 1.1), xticks: xt,
    xlbl: (i) => { const f = fechaI(i); return `${f.getUTCDate()} ${MESES_CORTOS[f.getUTCMonth()]} ${f.getUTCFullYear()}`; },
    vfmt: (v) => fmt(v, 1) + ' pas.',
    series: [{ nom: 'Tendencia', tipo: 'linea', valores: tr, color: c.pro, area: true }],
  });
}

function pintar(raiz) {
  const c = colores();
  pregunta(raiz);
  pintarPrincipal(raiz);
  const mt = D.metricas;
  const mejor = (a, b) => (a < b ? 'gana' : '');
  raiz.querySelector('#metricas').innerHTML = `
    <div class="met-cab"><span></span><span><i style="background:${c.pro}"></i>Prophet</span><span><i style="background:${c.manual}"></i>Empírico</span></div>
    ${[['MAE', 'error absoluto medio', 'pas.'], ['RMSE', 'penaliza errores grandes', 'pas.'], ['MAPE', 'error porcentual', '%']].map(([k, d, u]) => {
      const p = mt.prophet[k], e = mt.empirico[k], tope = Math.max(p, e);
      return `<div class="met-fila">
        <div><b>${sigla(k)}</b><small>${d}</small></div>
        <div class="met-v ${mejor(p, e)}"><span>${fmt(p, 1)}<em>${u}</em></span><i style="--w:${p / tope * 100}%;--c:${c.pro}"></i></div>
        <div class="met-v"><span>${fmt(e, 1)}<em>${u}</em></span><i style="--w:${e / tope * 100}%;--c:${c.manual}"></i></div>
      </div>`;
    }).join('')}`;
  raiz.querySelector('#acierto').innerHTML = `<p>En la semana de prueba, el modelo se equivocó en promedio por <b>${fmt(mt.prophet.MAE)} personas</b> en cada cuarto de hora. El método que se usa hoy (promediar las últimas cuatro semanas) se equivoca por <b>${fmt(mt.empirico.MAE)}</b>.</p><div class="acierto-barras"><div><span>Modelo</span><i style="--w:${mt.prophet.MAE / mt.empirico.MAE * 100}%;--c:${c.pro}"></i><b>±${fmt(mt.prophet.MAE)}</b></div><div><span>Método actual</span><i style="--w:100%;--c:${c.manual}"></i><b>±${fmt(mt.empirico.MAE)}</b></div></div>`;
  raiz.querySelector('#lectura').innerHTML = conSiglas(`Prophet reduce el error absoluto medio en <b>${fmt(mt.mejora_mae_pct, 1)} %</b> y el RMSE en <b>${fmt(mt.mejora_rmse_pct, 1)} %</b>. Su ventaja crece en semanas con feriados o cambios de tendencia, que el promedio de cuatro semanas no detecta. Entrenamiento: ${fmt(mt.registros_entrenamiento)} registros en ${fmt(mt.tiempo_entrenamiento_s, 1)} s.`);

  pintarComponentes(raiz);
}

export default {
  id: 'pronostico', nombre: 'Pronóstico', ic: 'pronostico',
  montar(raiz) {
    raiz.innerHTML = plantilla();

    alSegmentar(raiz, 'alcance-p', (v) => { alcance = v; pintarPrincipal(raiz); });
    alSegmentar(raiz, 'comp', (v) => { tipoComp = v; pintarComp(raiz); });
    raiz.querySelector('#pleg-comp').addEventListener('toggle', () => pintarComponentes(raiz));
    pintar(raiz);
  },
  actualizar(raiz) { pintar(raiz); },
};
