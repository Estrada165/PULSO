import { D, cal, colores } from '../estado.js';
import { grafico, leyenda, el, css, mostrarTip, ocultarTip } from '../lib/graficos.js';
import { fmt, DIAS, DIAS_CORTOS, MESES_CORTOS } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, info } from '../ui.js';

function plantilla() {
  const H = D.historico;
  return `
  ${cabecera({
    eti: `Ruta ${D.ruta.codigo} · terminal de origen`,
    titulo: 'Historial de demanda',
    desc: `${D.historico.registros.toLocaleString('es-PE')} intervalos de 15 minutos registrados entre ${cal.corto(D.historico.desde)} y ${cal.corto(D.historico.hasta)}. Son los patrones de afluencia con los que se entrena el modelo de pronóstico.`,
  })}
  <section class="rejilla g-2 mt">
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Afluencia por día y hora${info('calor')}</h3><p class="sub">pasajeros por hora, sin feriados</p></div><div class="escala" id="escala"></div></div>
      <div id="calor" class="calor-c"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Ficha del conjunto de datos${info('ficha')}</h3></div></div>
      <dl class="ficha" id="ficha"></dl>
      <h3 class="mt">Estructura de entrada</h3>
      <p class="sub">una fila por intervalo de 15 minutos</p>
      <div class="tabla-c mt-s"><table class="tabla-min">
        <thead><tr><th>fecha_hora</th><th class="n">pasajeros</th><th>tipo_dia</th></tr></thead>
        <tbody><tr><td class="mono">2026-05-04 07:00</td><td class="n">412</td><td>laboral</td></tr><tr><td class="mono">2026-05-04 07:15</td><td class="n">398</td><td>laboral</td></tr><tr><td class="mono">2026-05-09 10:30</td><td class="n">171</td><td>sabado</td></tr></tbody>
      </table></div>
    </article>
  </section>
  <article class="tarjeta mt">
    <div class="tarjeta-cab"><div><h3>Pasajeros por día${info('diario')}</h3><p class="sub" id="sub-diario"></p></div><div id="ley-diario"></div></div>
    <div id="g-diario"></div>
  </article>`;
}

function pintar(raiz) {
  const c = colores(), H = D.historico;
  const d0 = cal.partes(H.desde), d1 = cal.partes(H.hasta);
  raiz.querySelector('#ficha').innerHTML = [
    ['Período', `${d0.dia} ${MESES_CORTOS[d0.mes]} ${d0.anio} – ${d1.dia} ${MESES_CORTOS[d1.mes]} ${d1.anio}`],
    ['Registros', fmt(H.registros)], ['Frecuencia', 'cada 15 minutos'], ['Horario', `${D.operacion.hora_inicio}:00 a ${D.operacion.hora_fin}:00`],
    ['Faltantes', `${fmt(H.faltantes)} (${fmt(H.faltantes / H.registros * 100, 1)} %)`], ['Ruta', `${D.ruta.codigo} · ${D.ruta.km_ida} km por sentido`],
    ['Paraderos', fmt(D.ruta.paraderos)], ['Feriados', `${H.diario.filter((x) => D.feriados[x.fecha]).length} en el período`],
  ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');

  const cal2 = H.calor, horas = H.calor_horas, mx = Math.max(...cal2.flat());
  const base = css('--surface-3');
  const color = (v) => `color-mix(in oklab, ${c.pro} ${Math.round(6 + 94 * Math.pow(v / mx, 1.2))}%, ${base})`;
  const cont = raiz.querySelector('#calor');
  cont.innerHTML = `<div class="calor" style="grid-template-columns:34px repeat(${horas.length},1fr)">
    ${cal2.map((fila, d) => `<div class="calor-eje">${DIAS_CORTOS[d]}</div>${fila.map((v, h) => `<div class="celda" data-d="${d}" data-h="${h}" style="background:${color(v)}"></div>`).join('')}`).join('')}
    <div></div>${horas.map((h) => `<div class="calor-eje c">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>`).join('')}
  </div>`;
  cont.querySelectorAll('.celda').forEach((cel) => {
    cel.onpointermove = (e) => {
      const r = cont.getBoundingClientRect(), d = +cel.dataset.d, h = +cel.dataset.h;
      mostrarTip(cont, e.clientX - r.left, e.clientY - r.top, `<div class="tip-t">${DIAS[d]} · ${horas[h]}:00 a ${horas[h] + 1}:00</div><div class="tip-f"><span><i style="background:${c.pro}"></i>Pasajeros por hora</span><b>${fmt(cal2[d][h])}</b></div>`);
    };
    cel.onpointerleave = ocultarTip;
  });
  raiz.querySelector('#escala').innerHTML = `<span>0</span><i style="background:linear-gradient(90deg, ${color(0)}, ${color(mx * 0.5)}, ${color(mx)})"></i><span>${fmt(mx)}</span>`;

  const di = H.diario;
  raiz.querySelector('#sub-diario').textContent = `${d0.dia} ${MESES_CORTOS[d0.mes]} – ${d1.dia} ${MESES_CORTOS[d1.mes]} ${d1.anio} · los puntos marcan feriados`;
  raiz.querySelector('#ley-diario').innerHTML = leyenda([{ nom: 'Pasajeros por día', color: c.pro }, { nom: 'Feriado', color: c.alerta, forma: 'punto' }]);
  const xt = [];
  di.forEach((x, i) => { const p = cal.partes(x.fecha); if (p.dia === 1) xt.push({ i: i + 0.5, lbl: MESES_CORTOS[p.mes], anchor: 'start' }); });
  const g = grafico(raiz.querySelector('#g-diario'), {
    n: di.length, alto: 260, ml: 46, xticks: xt,
    xlbl: (i) => { const x = di[i]; const f = cal.feriado(x.fecha); return cal.largo(x.fecha) + (f ? ' · ' + f : ''); },
    vfmt: (v) => fmt(v) + ' pas.',
    series: [{ nom: 'Pasajeros', tipo: 'linea', valores: di.map((x) => x.total), color: c.pro, grosor: 1.7, area: true }],
  });
  di.forEach((x, i) => { if (D.feriados[x.fecha]) el('circle', { cx: g.X(i), cy: g.Y(x.total), r: 4.4, fill: c.alerta, stroke: css('--surface'), 'stroke-width': 2, class: 'feriado' }, g.svg); });
}

export default {
  id: 'demanda', nombre: 'Demanda', ic: 'datos',
  montar(raiz) { raiz.innerHTML = plantilla(); pintar(raiz); },
  actualizar(raiz) { pintar(raiz); },
};
