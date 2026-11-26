import { S, D, M, cal, colores, ventanaImprevisto } from '../estado.js';
import { grafico, leyenda } from '../lib/graficos.js';
import { fmt, hhmm, DIAS, DIAS_CORTOS } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, kpi, delta, segmentado, alSegmentar, info, plegable } from '../ui.js';

let alcance = 'semana';
const N = D.operacion.n_intervalos;
const slotHora = (i) => hhmm(M.INI + i * M.I);
export const ticksHoras = (cada = 3) => {
  const t = [];
  for (let h = D.operacion.hora_inicio; h <= D.operacion.hora_fin; h += cada) t.push({ i: (h - D.operacion.hora_inicio) * 60 / M.I, lbl: String(h).padStart(2, '0') + 'h' });
  return t;
};

export function bloqueKPI(m, i) {
  const mx = (a, b) => Math.max(a, b, 1e-9);
  return [
    kpi({ tag: 'Km en vacío', inf: 'kpi_km_vacio', valor: fmt(i.km_vacio), unidad: 'km', manual: fmt(m.km_vacio) + ' km', d: delta(m.km_vacio, i.km_vacio), propInt: i.km_vacio / mx(m.km_vacio, i.km_vacio), propMan: m.km_vacio / mx(m.km_vacio, i.km_vacio) }),
    kpi({ tag: 'Espera promedio', inf: 'kpi_espera', valor: fmt(i.espera_prom, 1), unidad: 'min', manual: fmt(m.espera_prom, 1) + ' min', d: delta(m.espera_prom, i.espera_prom), propInt: i.espera_prom / mx(m.espera_prom, i.espera_prom), propMan: m.espera_prom / mx(m.espera_prom, i.espera_prom) }),
    kpi({ tag: `Esperan más de ${S.params.espera_maxima} min`, inf: 'kpi_espera_larga', valor: fmt(i.pct_espera_larga, i.pct_espera_larga < 1 ? 2 : 1), unidad: '%', manual: fmt(m.pct_espera_larga, 1) + ' %', d: delta(m.pct_espera_larga, i.pct_espera_larga, { puntos: true, escala: 1 }), propInt: i.pct_espera_larga / mx(m.pct_espera_larga, i.pct_espera_larga), propMan: m.pct_espera_larga / mx(m.pct_espera_larga, i.pct_espera_larga) }),
    kpi({ tag: 'Ocupación promedio', inf: 'kpi_ocupacion', valor: fmt(i.ocupacion_prom * 100, 1), unidad: '%', manual: fmt(m.ocupacion_prom * 100, 1) + ' %', d: delta(m.ocupacion_prom, i.ocupacion_prom, { menorEsMejor: false, puntos: true }), propInt: i.ocupacion_prom, propMan: m.ocupacion_prom }),
    kpi({ tag: 'Kilómetros recorridos', inf: 'kpi_km', valor: fmt(i.km), unidad: 'km', manual: `${fmt(m.km)} km`, d: delta(m.km, i.km), propInt: i.km / mx(m.km, i.km), propMan: m.km / mx(m.km, i.km) }),
    kpi({ tag: 'Combustible estimado', inf: 'kpi_combustible', valor: 'S/ ' + fmt(i.costo), unidad: '', manual: 'S/ ' + fmt(m.costo), d: delta(m.costo, i.costo), propInt: i.costo / mx(m.costo, i.costo), propMan: m.costo / mx(m.costo, i.costo) }),
  ].join('');
}

function plantilla() {
  return `
  ${cabecera({
    eti: `Semana del ${cal.rangoSemana()}`,
    titulo: 'Panel de operación',
    desc: `Indicadores de la ruta ${D.ruta.codigo} con la programación de PULSO frente al horario base, con los mismos pasajeros.`,
    acciones: segmentado('alcance', [['semana', 'Semana'], ['dia', 'Día elegido']], alcance),
  })}
  <section class="relato" id="relato" data-guia="relato"></section>
  <section id="kpis" data-guia="kpis"></section>
  <section class="rejilla g-2 mt">
    <article class="tarjeta" data-guia="oferta">
      <div class="tarjeta-cab">
        <div><h3>Asientos ofrecidos y pasajeros${info('oferta')}</h3><p class="sub" id="sub-oferta"></p></div>
        <div id="ley-oferta"></div>
      </div>
      <div id="g-oferta"></div>
    </article>
    <article class="tarjeta">
      <div class="tarjeta-cab">
        <div><h3>Espera promedio por día${info('espera_dia')}</h3><p class="sub">minutos por pasajero en el terminal</p></div>
        <div id="ley-espera"></div>
      </div>
      <div id="g-espera"></div>
    </article>
  </section>
  <article class="tarjeta mt" data-guia="estado">
    <div class="tarjeta-cab"><div><h3>Estado del sistema</h3><p class="sub">datos, modelo y programación</p></div></div>
    <div class="estado-sis" id="estado-sis" class="es-lista"></div>
  </article>`;
}

function bloqueSimple(m, i) {
  const kv = (x) => Math.round(x.km_vacio / M.KM_VIAJE);
  const unoDe = (pct) => (pct <= 0 ? 'nadie' : `1 de cada ${fmt(Math.max(1, Math.round(100 / pct)))}`);
  const cap = S.params.capacidad;
  const mx = (a, b) => Math.max(a, b, 1e-9);
  const principales = [
    kpi({ tag: 'Espera en el terminal', inf: 'kpi_espera', valor: fmt(i.espera_prom, 1), unidad: 'min por pasajero', manual: fmt(m.espera_prom, 1) + ' min', d: delta(m.espera_prom, i.espera_prom), propInt: i.espera_prom / mx(m.espera_prom, i.espera_prom), propMan: m.espera_prom / mx(m.espera_prom, i.espera_prom) }),
    kpi({ tag: 'Buses que salieron casi vacíos', inf: 'kpi_km_vacio', valor: fmt(kv(i)), unidad: 'salidas', manual: fmt(kv(m)) + ' salidas', d: delta(kv(m), kv(i)), propInt: kv(i) / mx(kv(m), kv(i)), propMan: kv(m) / mx(kv(m), kv(i)) }),
    kpi({ tag: 'Combustible', inf: 'kpi_combustible', valor: 'S/ ' + fmt(i.costo), unidad: '', manual: 'S/ ' + fmt(m.costo), d: delta(m.costo, i.costo), propInt: i.costo / mx(m.costo, i.costo), propMan: m.costo / mx(m.costo, i.costo) }),
  ].join('');
  const extra = [
    kpi({ tag: 'Esperaron demasiado', inf: 'kpi_espera_larga', valor: unoDe(i.pct_espera_larga), unidad: '', manual: unoDe(m.pct_espera_larga), d: '' }),
    kpi({ tag: 'Pasajeros por bus', inf: 'kpi_ocupacion', valor: fmt(i.ocupacion_prom * cap), unidad: `de ${cap} plazas`, manual: fmt(m.ocupacion_prom * cap) + ' por bus', d: delta(m.ocupacion_prom, i.ocupacion_prom, { menorEsMejor: false }) }),
    kpi({ tag: 'Salidas del terminal', inf: 'kpi_km', valor: fmt(i.salidas), unidad: 'buses', manual: fmt(m.salidas) + ' buses', d: delta(m.salidas, i.salidas) }),
  ].join('');
  return `<div class="rejilla g-3">${principales}</div>${plegable('Ver todos los indicadores', `<div class="rejilla g-3">${extra}</div>`)}`;
}

function relato(m, i, cuando) {
  const dEsp = m.espera_prom - i.espera_prom;
  const vacios = Math.round((m.km_vacio - i.km_vacio) / M.KM_VIAJE);
  const ahorro = m.costo - i.costo;
  const esp = dEsp >= 0 ? `cada pasajero esperó <b>${fmt(dEsp, 1)} minutos menos</b>` : `cada pasajero esperó <b>${fmt(-dEsp, 1)} minutos más</b>`;
  const vac = vacios > 0 ? `salieron <b>${fmt(vacios)} buses menos casi vacíos</b>` : 'la cantidad de buses casi vacíos fue similar';
  return `
    <div class="relato-txt">
      <p>${cuando}, con PULSO ${esp} y ${vac}.</p>
      <p class="relato-sub">${ahorro > 0 ? `Eso son <b>S/ ${fmt(ahorro)}</b> menos en combustible y ${fmt((m.co2_kg - i.co2_kg) / 1000, 1)} toneladas menos de CO₂, ` : ''}frente al horario base y con los mismos pasajeros.</p>
    </div>`;
}

function pintar(raiz) {
  const c = colores();
  const t = alcance === 'semana' ? S.res.total : S.res.dias[S.dia];
  raiz.querySelector('#relato').innerHTML = relato(t.manual, t.inteligente, alcance === 'semana' ? 'Esta semana' : cal.largo(S.res.dias[S.dia].fecha));
  raiz.querySelector('#kpis').innerHTML = bloqueSimple(t.manual, t.inteligente);

  const dd = S.res.dias[S.dia];
  const cap = S.params.capacidad;
  const porSlot = (horas) => { const a = new Array(N).fill(0); for (const h of horas) { const k = Math.floor((h - M.INI) / M.I); if (k >= 0 && k < N) a[k] += cap; } return a; };
  raiz.querySelector('#sub-oferta').textContent = `${cal.largo(dd.fecha)} · por intervalo de 15 minutos`;
  raiz.querySelector('#ley-oferta').innerHTML = leyenda([{ nom: 'Pasajeros que llegaron', color: c.real, forma: 'caja' }, { nom: 'Asientos con horario base', color: c.manual }, { nom: 'Asientos con PULSO', color: c.int }]);
  const v = ventanaImprevisto(S.dia);
  grafico(raiz.querySelector('#g-oferta'), {
    n: N, alto: 290, xticks: ticksHoras(), xlbl: slotHora, aria: 'Plazas ofrecidas frente a pasajeros',
    marcas: v ? [{ ...v, lbl: 'imprevisto' }] : [],
    vfmt: (x) => fmt(x) + ' asientos',
    series: [
      { nom: 'Pasajeros que llegaron', tipo: 'barra', valores: dd.real, color: c.real, opacidad: 0.5, vfmt: (x) => fmt(x) + ' personas' },
      { nom: 'Asientos con horario base', tipo: 'escalon', valores: porSlot(dd.manual.horas), color: c.manual, grosor: 1.8 },
      { nom: 'Asientos con PULSO', tipo: 'escalon', valores: porSlot(dd.inteligente.horas), color: c.int, grosor: 2.4, area: true },
    ],
  });
  raiz.querySelector('#ley-espera').innerHTML = leyenda([{ nom: 'Horario base', color: c.manual, forma: 'caja' }, { nom: 'PULSO', color: c.int, forma: 'caja' }]);
  grafico(raiz.querySelector('#g-espera'), {
    n: 7, alto: 290, ml: 30, anchoBarra: 0.64,
    xticks: DIAS_CORTOS.map((d, i) => ({ i: i + 0.5, lbl: d })), xlbl: (i) => cal.largo(D.semana[i].fecha),
    vfmt: (x) => fmt(x, 2) + ' min', yfmt: (x) => fmt(x, x % 1 ? 1 : 0),
    series: [
      { nom: 'Horario base', tipo: 'barra', valores: S.res.dias.map((d) => d.manual.espera_prom), color: c.manual },
      { nom: 'PULSO', tipo: 'barra', valores: S.res.dias.map((d) => d.inteligente.espera_prom), color: c.int },
    ],
  });

  pintarEstado(raiz);
}

function pintarEstado(raiz) {
  const cont = raiz.querySelector('#estado-sis'); if (!cont) return;
  const mt = D.metricas, H = D.historico;
  const items = [
    ['datos', 'Último registro cargado', cal.largo(H.hasta), `${fmt(H.registros)} intervalos en el historial`, '#carga', 'Cargar registros'],
    ['pronostico', 'Modelo de pronóstico', `Error medio ±${fmt(mt.prophet.MAE, 1)} pasajeros`, `${fmt(mt.mejora_mae_pct, 1)} % más preciso que el promedio de cuatro semanas`, '#pronostico', 'Ver precisión'],
    ['programacion', 'Programación de hoy', `${fmt(S.res.dias[cal.indiceHoy].inteligente.salidas)} salidas`, `primera a las ${hhmm(S.res.dias[cal.indiceHoy].inteligente.horas[0])}`, '#programacion', 'Abrir tablero'],
  ];
  cont.innerHTML = items.map(([ic, t, v, s2, href, cta]) => `
    <a class="es-item" href="${href}">
      <span class="es-ic">${icono(ic, 2)}</span>
      <div><small>${t}</small><b>${v}</b><span>${s2}</span></div>
      <span class="es-cta">${cta}${icono('derecha', 2.2)}</span>
    </a>`).join('');
}

export default {
  id: 'panel', nombre: 'Panel', ic: 'resumen',
  montar(raiz) {
    raiz.innerHTML = plantilla();

    alSegmentar(raiz, 'alcance', (v) => { alcance = v; pintar(raiz); });
    pintar(raiz);
  },
  actualizar(raiz) { pintar(raiz); },
};
