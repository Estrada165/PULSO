import { S, D, M, cal, colores } from '../estado.js';
import { grafico, leyenda } from '../lib/graficos.js';
import { fmt, hhmm, DIAS_CORTOS } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, info } from '../ui.js';
import { ticksHoras } from './resumen.js';

const F = D.futuro;
let sel = 0;
let cache = { clave: null, planes: null };
const slotHora = (i) => hhmm(M.INI + i * M.I);

function planes() {
  const clave = JSON.stringify(S.params);
  if (cache.clave === clave) return cache.planes;
  cache = {
    clave,
    planes: F.dias.map((d) => {
      const dem = d.prophet.map((v) => Math.round(v));
      const h = M.heuristica(d.prophet, null, S.params, false);
      const sim = M.simular(h.salidas, dem, S.params);
      let pico = 0; d.prophet.forEach((v, i) => { if (v > d.prophet[pico]) pico = i; });
      const hw = h.salidas.slice(0, -1).map((t, i) => h.salidas[i + 1] - t);
      return { total: dem.reduce((a, b) => a + b, 0), salidas: h.salidas, traza: h.traza, sim, pico, hwMin: Math.min(...hw) };
    }),
  };
  return cache.planes;
}

function estadoDatos() {
  const hoy = new Date(cal.ahoraISO() + 'T12:00:00Z');
  const ult = new Date(cal.visible(F.ultimo_dato) + 'T12:00:00Z');
  const dias = Math.round((hoy - ult) / 864e5);
  if (dias <= 7) return ['ok', 'Datos al día', 'El pronóstico de la próxima semana usa información reciente.'];
  if (dias <= 14) return ['aviso', 'Conviene actualizar', `Han pasado ${dias} días desde el último registro.`];
  return ['mal', 'Datos desactualizados', `Han pasado ${dias} días desde el último registro: el pronóstico pierde precisión.`];
}

function plantilla() {
  const p0 = F.dias[0].fecha, p6 = F.dias[6].fecha;
  return `
  ${cabecera({
    eti: 'Planificación',
    titulo: 'Pronóstico de los próximos 7 días',
    desc: 'El modelo pronostica la demanda de los siete días siguientes y deja preparada la programación de salidas de cada uno.',
  })}
  <section class="tarjeta estado-datos" id="estado-datos"></section>
  <div class="fila-info mt"><span>Semana del ${cal.corto(p0)} al ${cal.corto(p6)}</span>${info('fut_dias')}</div>
  <section class="dias-fut" id="dias-fut"></section>
  <section class="rejilla g-2 mt">
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3 id="tit-fut"></h3><p class="sub">pasajeros esperados cada 15 minutos</p></div><div id="ley-fut"></div></div>
      <div id="g-fut"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab"><div><h3>Programación preparada${info('fut_plan')}</h3><p class="sub" id="sub-plan"></p></div></div>
      <dl class="plan" id="plan"></dl>
      <p class="nota-calc">${icono('info', 2)}Si ese día llega más o menos gente de lo previsto, la corrección en vivo ajusta las salidas.</p>
    </article>
  </section>
  <article class="tarjeta mt">
    <div class="tarjeta-cab"><div><h3>Cómo se mantiene actualizado${info('fut_ciclo')}</h3><p class="sub">recomendado: cada lunes, con los registros de la semana anterior</p></div></div>
    <ol class="ciclo">
      <li><span class="ciclo-n">${icono('datos', 2)}</span><b>Exportar</b><p>La empresa exporta los registros de la semana (Excel o CSV con fecha, hora y pasajeros).</p></li>
      <li><span class="ciclo-n">${icono('capas', 2)}</span><b>Agregar</b><p>Se suman al historial. No se borra nada: si un registro ya existía, se reemplaza por el más reciente.</p></li>
      <li><span class="ciclo-n">${icono('pronostico', 2)}</span><b>Reentrenar</b><p>El modelo vuelve a aprender con el historial completo y pronostica los siete días siguientes.</p></li>
      <li><span class="ciclo-n">${icono('programacion', 2)}</span><b>Programar</b><p>Se genera la programación de la semana y se publica en el panel.</p></li>
    </ol>
    <div class="guardado">
      <div><h4>Dónde se guardan los datos</h4><p>Hoy, en un archivo de historial acumulado (<span class="mono">datos/abordajes_reales.csv</span>) que crece con cada carga. En la siguiente etapa, en una base de datos con una fila por cada cuarto de hora y la fecha como clave única, para que nunca se dupliquen.</p></div>
      <div class="solo-tecnica"><h4>Comando de carga</h4><pre class="mono">python main.py --datos registros_semana.csv</pre><p>Con <span class="mono">--reemplazar</span> se descarta el historial anterior y se empieza de cero.</p></div>
    </div>
  </article>`;
}

function pintar(raiz) {
  const c = colores(), P = planes();
  const [cls, tit, txt] = estadoDatos();
  raiz.querySelector('#estado-datos').innerHTML = `
    <div class="ed-item"><span>Último registro cargado</span><b>${cal.largo(F.ultimo_dato)}</b></div>
    <div class="ed-item"><span>Pronóstico disponible</span><b>${cal.corto(F.dias[0].fecha)} al ${cal.corto(F.dias[6].fecha)}</b></div>
    <div class="ed-item"><span>Próxima actualización sugerida</span><b>${cal.largo(F.dias[0].fecha)}</b></div>
    <div class="ed-estado ${cls}"><b>${icono(cls === 'ok' ? 'check' : 'info', 2.4)}${tit}</b><p>${txt}</p>${info('fut_estado')}</div>`;

  raiz.querySelector('#dias-fut').innerHTML = F.dias.map((d, i) => {
    const p = cal.partes(d.fecha), pl = P[i];
    return `<button class="tarjeta dia-fut ${i === sel ? 'sel' : ''}" data-i="${i}">
      <span class="df-dia">${DIAS_CORTOS[p.dow]} ${p.dia}</span>
      ${d.feriado ? `<span class="df-fer">${cal.ajustada ? 'Feriado' : d.feriado}</span>` : ''}
      <b>${fmt(Math.round(pl.total / 100) * 100)}</b><small>personas</small>
      <span class="df-sal">${icono('bus', 1.8)}${fmt(pl.salidas.length)} salidas</span>
    </button>`;
  }).join('');
  raiz.querySelectorAll('.dia-fut').forEach((b) => { b.onclick = () => { sel = +b.dataset.i; pintar(raiz); }; });

  const d = F.dias[sel], pl = P[sel];
  raiz.querySelector('#tit-fut').innerHTML = `${cal.largo(d.fecha)}${info('fut_detalle')}`;
  raiz.querySelector('#ley-fut').innerHTML = leyenda([{ nom: 'Pronóstico', color: c.pro }, { nom: 'Margen probable', color: c.pro, forma: 'caja suave' }]);
  grafico(raiz.querySelector('#g-fut'), {
    n: D.operacion.n_intervalos, alto: 270, xticks: ticksHoras(), xlbl: slotHora, vfmt: (v) => fmt(v) + ' personas',
    series: [
      { nom: 'Margen probable', tipo: 'banda', lo: d.inf, hi: d.sup, valores: d.prophet, color: c.pro },
      { nom: 'Pronóstico', tipo: 'linea', valores: d.prophet, color: c.pro, grosor: 2.3, area: true },
    ],
  });
  raiz.querySelector('#sub-plan').textContent = 'calculada con el pronóstico de ese día';
  const tr = pl.traza;
  raiz.querySelector('#plan').innerHTML = [
    ['Salidas programadas', fmt(pl.salidas.length)],
    ['Primera y última', `${hhmm(tr[0].t)} – ${hhmm(tr[tr.length - 1].t)}`],
    ['Hora más cargada', `${slotHora(pl.pico)} (unas ${fmt(d.prophet[pl.pico])} personas en 15 min)`],
    ['Bus más frecuente', `cada ${fmt(pl.hwMin, 1)} min en hora punta`],
    ['Espera estimada', `${fmt(pl.sim.espera_prom, 1)} min por pasajero`],
    ['Pasajeros por bus', `${fmt(pl.sim.ocupacion_prom * S.params.capacidad)} en promedio`],
  ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

export default {
  id: 'proxima', nombre: 'Próxima semana', ic: 'reloj',
  montar(raiz) { raiz.innerHTML = plantilla(); pintar(raiz); },
  actualizar(raiz, motivo) { if (motivo !== 'dia') pintar(raiz); },
};
