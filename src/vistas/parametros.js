import { S, PARAMS_BASE, recalcular, notificar } from '../estado.js';
import { fmt } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, delta, interruptor, aviso, info } from '../ui.js';
import { guardarParametros, ACT, enNube } from '../datos/fuente.js';
import { puede } from '../permisos.js';

const GRUPOS = [
  ['Unidad y flota', 'bus', 'p_flota', [
    ['flota', 'Flota disponible', 25, 70, 1, (v) => v + ' buses', 'Unidades habilitadas para el corredor. La capacidad de cada unidad se gestiona en Usuarios y flota.'],
  ]],
  ['Nivel de servicio', 'objetivo', 'p_servicio', [
    ['ocupacion_objetivo', 'Ocupación objetivo', 0.5, 1, 0.05, (v) => fmt(v * 100) + ' %', 'Carga con la que conviene que salga cada bus.'],
    ['ocupacion_minima', 'Umbral de salida en vacío', 0.1, 0.5, 0.05, (v) => fmt(v * 100) + ' %', 'Por debajo de esta carga la salida cuenta como kilometraje en vacío.'],
    ['espera_maxima', 'Espera máxima', 6, 20, 1, (v) => v + ' min', 'Tiempo máximo entre dos salidas, aunque haya pocos pasajeros.'],
    ['intervalo_minimo', 'Intervalo mínimo de andén', 1, 5, 1, (v) => fmt(v) + ' min', 'Lo mínimo que el andén permite entre dos salidas.'],
  ]],
  ['Inteligencia', 'pronostico', 'p_intel', [
    ['factor_seguridad', 'Margen sobre el pronóstico', 1, 1.3, 0.01, (v) => '×' + fmt(v, 2), 'Colchón para absorber el error del pronóstico.'],
    ['umbral_correccion', 'Umbral de corrección', 0.05, 0.4, 0.01, (v) => fmt(v * 100) + ' %', 'Desvío entre lo real y lo pronosticado que activa el ajuste en vivo.'],
  ]],
];

function plantilla() {
  return `
  ${cabecera({
    eti: 'Configuración',
    titulo: 'Reglas de despacho',
    desc: 'Cada regla del despacho es configurable. Al mover un control se recalcula la programación de la semana completa; guarda los cambios para que rijan en toda la operación.',
    guia: 'p-cab',
    acciones: puede('parametros') ? `<button class="tecla tecla-sm" id="restablecer" disabled>${icono('reiniciar')}<span>Descartar</span></button><button class="tecla tecla-sm tecla-acento" id="guardar" disabled>${icono('guardar', 2)}<span>Guardar cambios</span></button>` : `<span class="chip-rol">${icono('candado', 2)}Solo lectura</span>`,
  })}
  <div class="p-estado" id="p-estado" data-guia="p-estado"></div>
  <section class="rejilla g-param">
    <div class="col-param">
      <div class="col">${tarjetaGrupo(GRUPOS[0])}${tarjetaGrupo(GRUPOS[2])}</div>
      <div class="col">${tarjetaGrupo(GRUPOS[1])}
        <article class="tarjeta">
          <div class="tarjeta-cab"><div><h3>${icono('capas', 2)}Lógica aplicada${info('p_logica')}</h3><p class="sub">con los valores actuales</p></div></div>
          <div class="formula" id="formula"></div>
        </article>
      </div>
    </div>
    <article class="tarjeta pegajosa">
      <div class="tarjeta-cab"><div><h3>Resultado de la semana${info('p_resultado')}</h3><p class="sub">PULSO frente al horario base</p></div></div>
      <div id="resultado"></div>
    </article>
  </section>`;
}

function tarjetaGrupo([titulo, ic, inf, campos]) {
  return `
      <article class="tarjeta">
        <div class="tarjeta-cab"><div><h3>${icono(ic, 2)}${titulo}${info(inf)}</h3></div></div>
        ${campos.map(([k, nom, mn, mx, st, f, ayuda]) => `
        <div class="param">
          <div class="param-top"><label for="r-${k}">${nom}</label><output id="o-${k}">${f(S.params[k])}</output></div>
          <input type="range" class="deslizador" id="r-${k}" min="${mn}" max="${mx}" step="${st}" value="${S.params[k]}" ${puede('parametros') ? '' : 'disabled'}>
          <p>${ayuda}</p>
        </div>`).join('')}
        ${titulo === 'Inteligencia' ? `<div class="param param-sw"><div><label>Corrección en tiempo real</label><p>Compara lo observado con lo pronosticado cada 15 minutos.</p></div>${interruptor('sw-corr', S.correccion, 'Corrección en tiempo real')}</div>` : ''}
      </article>`;
}

function formula(raiz) {
  const p = S.params;
  raiz.querySelector('#formula').innerHTML = `
    <div><span class="f-n">1</span><span>D = pronóstico(t) × corrección</span></div>
    <div><span class="f-n">2</span><span>h = <b>${p.capacidad}</b> × <b>${fmt(p.ocupacion_objetivo, 2)}</b> ÷ (D × <b>${fmt(p.factor_seguridad, 2)}</b> ÷ 15)</span></div>
    <div><span class="f-n">3</span><span>h = mín(h, <b>${p.espera_maxima}</b> min)</span></div>
    <div><span class="f-n">4</span><span>h = máx(h, <b>${fmt(p.intervalo_minimo, 1)}</b> min)</span></div>
    <div><span class="f-n">5</span><span>sin bus libre → esperar el próximo retorno</span></div>
    <div><span class="f-n">6</span><span>|real ÷ pronóstico − 1| &gt; <b>${fmt(p.umbral_correccion * 100)} %</b> → corregir</span></div>`;
}

function resultado(raiz) {
  const m = S.res.total.manual, i = S.res.total.inteligente;
  const fila = (nom, a, b, f, opc) => `
    <div class="res-fila"><div><b>${nom}</b><small>horario base ${f(a)}</small></div><strong>${f(b)}</strong>${delta(a, b, opc)}</div>`;
  raiz.querySelector('#resultado').innerHTML =
    fila('Km en vacío', m.km_vacio, i.km_vacio, (v) => fmt(v) + ' km') +
    fila('Espera promedio', m.espera_prom, i.espera_prom, (v) => fmt(v, 2) + ' min') +
    fila(`Esperan más de ${S.params.espera_maxima} min`, m.pct_espera_larga, i.pct_espera_larga, (v) => fmt(v, 2) + ' %', { puntos: true, escala: 1 }) +
    fila('Ocupación promedio', m.ocupacion_prom, i.ocupacion_prom, (v) => fmt(v * 100, 1) + ' %', { menorEsMejor: false, puntos: true }) +
    fila('Salidas', m.salidas, i.salidas, (v) => fmt(v)) +
    fila('Combustible', m.costo, i.costo, (v) => 'S/ ' + fmt(v)) +
    fila('Emisiones de CO₂', m.co2_kg / 1000, i.co2_kg / 1000, (v) => fmt(v, 1) + ' t') +
    `<p class="nota-calc">${icono('reloj', 2)}Recalculado en ${fmt(S.tCalc)} ms · ${fmt(i.salidas + m.salidas)} salidas evaluadas minuto a minuto</p>`;
}

let tt;
const sucio = () => Object.keys(PARAMS_BASE).some((k) => PARAMS_BASE[k] !== S.params[k]);
function marcar(raiz) {
  const g = raiz.querySelector('#guardar'), r = raiz.querySelector('#restablecer');
  if (!g) return;
  const s = sucio(); g.disabled = !s; r.disabled = !s;
  raiz.querySelector('#p-estado').innerHTML = s ? `<span class="pend">${icono('alerta', 2)}Cambios sin guardar · solo se ven en esta sesión</span>` : `<span>${icono('check', 2.4)}Configuración vigente${enNube && ACT.parametrosId ? ' · versión ' + ACT.parametrosId : ''}</span>`;
}
function recalc(raiz) {
  clearTimeout(tt);
  marcar(raiz);
  tt = setTimeout(() => { recalcular(); resultado(raiz); formula(raiz); notificar('params'); }, 60);
}

export default {
  id: 'parametros', nombre: 'Parámetros', ic: 'parametros',
  montar(raiz) {
    raiz.innerHTML = plantilla();

    for (const [, , , campos] of GRUPOS) for (const [k, , , , , f] of campos) {
      const r = raiz.querySelector('#r-' + k);
      const pintarR = () => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
      pintarR();
      r.oninput = () => { S.params[k] = +r.value; raiz.querySelector('#o-' + k).textContent = f(S.params[k]); pintarR(); recalc(raiz); };
    }
    raiz.querySelector('#sw-corr').onclick = (e) => {
      if (!puede('parametros')) return;
      S.correccion = !S.correccion;
      e.currentTarget.classList.toggle('on', S.correccion); e.currentTarget.setAttribute('aria-checked', S.correccion);
      recalc(raiz);
    };
    const rest = raiz.querySelector('#restablecer');
    if (rest) rest.onclick = () => {
      S.params = structuredClone(PARAMS_BASE); S.correccion = true;
      recalcular(); notificar('params'); this.montar(raiz); aviso('Cambios descartados');
    };
    const g = raiz.querySelector('#guardar');
    if (g) g.onclick = async () => {
      g.disabled = true; g.classList.add('cargando');
      try {
        await guardarParametros(S.params);
        Object.assign(PARAMS_BASE, structuredClone(S.params));
        aviso('Configuración guardada');
      } catch (e) { aviso(e.message, 'error'); }
      g.classList.remove('cargando'); marcar(raiz);
    };
    formula(raiz); resultado(raiz); marcar(raiz);
  },
  actualizar(raiz, motivo) { if (motivo !== 'params') resultado(raiz); },
};
