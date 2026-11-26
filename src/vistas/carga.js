import { D, cal } from '../estado.js';
import { fmt } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, aviso } from '../ui.js';
import { leerCSV, subirRegistros, historialCargas, estadoModelo, enNube } from '../datos/fuente.js';
import { descargar } from '../lib/exportar.js';

let lectura = null, archivo = '', sondeo = 0;

const fechaCorta = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fechaHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
};

function plantilla() {
  return `
  ${cabecera({
    eti: `Ruta ${D.ruta.codigo}`,
    titulo: 'Carga de datos',
    desc: 'Importa los registros de abordaje exportados del sistema de recaudo. Cada carga actualiza el historial y deja el modelo de pronóstico listo para volver a entrenarse.',
    guia: 'c-cab',
    acciones: `<button class="tecla tecla-sm" id="plantilla">${icono('descargar', 2)}<span>Plantilla CSV</span></button>`,
  })}
  <section class="rejilla g-carga">
    <div class="col">
      <article class="tarjeta">
        <div class="tarjeta-cab"><div><h3>${icono('subir', 2)}Importar registros</h3><p class="sub">CSV con columnas <code>fecha_hora</code> y <code>pasajeros</code>, intervalos de 15 minutos</p></div></div>
        <label class="soltar" id="soltar" data-guia="c-soltar" tabindex="0">
          <input type="file" id="archivo" accept=".csv,text/csv" hidden>
          <span class="soltar-ic">${icono('archivo', 1.8)}</span>
          <b>Arrastra el archivo aquí</b>
          <small>o <u>elige un archivo</u> desde tu equipo · máximo 20 MB</small>
        </label>
        <div id="vista-previa"></div>
      </article>
    </div>
    <div class="col">
      <article class="tarjeta" data-guia="c-modelo">
        <div class="tarjeta-cab"><div><h3>${icono('pronostico', 2)}Estado del modelo</h3><p class="sub">entrenamiento automático tras cada carga</p></div></div>
        <div id="modelo"></div>
      </article>
      <article class="tarjeta" data-guia="c-hist">
        <div class="tarjeta-cab"><div><h3>${icono('reloj', 2)}Cargas recientes</h3></div></div>
        <div id="historial" class="hist-c"></div>
      </article>
    </div>
  </section>`;
}

function previa(raiz) {
  const cont = raiz.querySelector('#vista-previa');
  if (!lectura) { cont.innerHTML = ''; return; }
  const dias = new Set(lectura.filas.map((x) => x.fecha_hora.slice(0, 10))).size;
  const total = lectura.filas.reduce((a, x) => a + x.pasajeros, 0);
  const muestra = lectura.filas.slice(0, 6);
  cont.innerHTML = `
    <div class="prev">
      <div class="prev-cab"><span class="prev-ic">${icono('archivo', 2)}</span><div><b>${archivo}</b><small>${fmt(lectura.filas.length)} filas válidas${lectura.errores.length ? ` · <span class="txt-mal">${fmt(lectura.errores.length)} con error</span>` : ''}</small></div>
        <button class="tecla tecla-ic tecla-sm" id="quitar" aria-label="Quitar archivo">${icono('cerrar', 2)}</button></div>
      <div class="prev-kpis">
        <div><small>Desde</small><b>${fechaCorta(lectura.desde)}</b></div>
        <div><small>Hasta</small><b>${fechaCorta(lectura.hasta)}</b></div>
        <div><small>Días</small><b>${fmt(dias)}</b></div>
        <div><small>Pasajeros</small><b>${fmt(total)}</b></div>
      </div>
      <div class="tabla-c compacta"><table><thead><tr><th>Fecha y hora</th><th class="n">Pasajeros</th></tr></thead>
        <tbody>${muestra.map((x) => `<tr><td class="mono">${x.fecha_hora.slice(0, 16).replace('T', ' ')}</td><td class="n">${x.pasajeros}</td></tr>`).join('')}
        ${lectura.filas.length > muestra.length ? `<tr><td colspan="2" class="tenue">… y ${fmt(lectura.filas.length - muestra.length)} filas más</td></tr>` : ''}</tbody></table></div>
      ${lectura.errores.length ? `<p class="nota-err">${icono('alerta', 2)}Se omitirán las filas ${lectura.errores.slice(0, 8).join(', ')}${lectura.errores.length > 8 ? '…' : ''}: fecha no válida, minuto fuera de los cuartos de hora o valor negativo.</p>` : ''}
      <div class="prev-barra" hidden><span></span></div>
      <button class="tecla tecla-acento ancho" id="importar">${icono('subir', 2)}<span>Importar ${fmt(lectura.filas.length)} registros</span></button>
    </div>`;
  cont.querySelector('#quitar').onclick = () => { lectura = null; previa(raiz); };
  cont.querySelector('#importar').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.classList.add('cargando');
    const barra = cont.querySelector('.prev-barra'); barra.hidden = false;
    try {
      const r = await subirRegistros(lectura, archivo, (p) => { barra.firstElementChild.style.width = p * 100 + '%'; });
      aviso(`${fmt(r.nuevas)} registros nuevos · ${fmt(r.actualizadas)} actualizados`);
      lectura = null; previa(raiz);
      await Promise.all([historial(raiz), modelo(raiz)]);
    } catch (err) { aviso(err.message, 'error'); b.disabled = false; b.classList.remove('cargando'); barra.hidden = true; }
  };
}

async function abrir(raiz, f) {
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) { aviso('El archivo supera los 20 MB', 'error'); return; }
  try {
    lectura = leerCSV(await f.text()); archivo = f.name; previa(raiz);
  } catch (e) { lectura = null; previa(raiz); aviso(e.message, 'error'); }
}

async function historial(raiz) {
  const cont = raiz.querySelector('#historial');
  try {
    const h = await historialCargas();
    const base = { archivo: 'Historial inicial', filas_nuevas: D.historico.registros, filas_actualizadas: 0, desde: cal.visible(D.historico.desde), hasta: cal.visible(D.historico.hasta), creado_en: null, usuario: 'Sistema' };
    const lista = enNube ? h : [...h, base];
    cont.innerHTML = lista.length ? lista.map((x) => `
      <div class="hist">
        <span class="hist-ic">${icono('archivo', 2)}</span>
        <div><b>${x.archivo || 'Carga'}</b><small>${fechaCorta(x.desde)} – ${fechaCorta(x.hasta)} · ${x.usuario}</small></div>
        <div class="hist-n"><b>+${fmt(x.filas_nuevas ?? 0)}</b><small>${x.creado_en ? fechaHora(x.creado_en) : 'origen'}</small></div>
      </div>`).join('') : `<p class="vacio-mini">Aún no hay cargas registradas.</p>`;
  } catch (e) { cont.innerHTML = `<p class="vacio-mini">${e.message}</p>`; }
}

async function modelo(raiz) {
  const cont = raiz.querySelector('#modelo'); if (!cont) return;
  clearTimeout(sondeo);
  let e;
  try { e = await estadoModelo(); } catch (err) { cont.innerHTML = `<p class="vacio-mini">${err.message}</p>`; return; }
  const mt = D.metricas;
  cont.innerHTML = `
    <div class="mod-estado ${e.pendiente ? 'pend' : 'ok'}">
      <span class="mod-pulso"></span>
      <div><b>${e.pendiente ? 'Entrenamiento en cola' : 'Modelo al día'}</b><small>${e.pendiente ? 'Hay registros nuevos. El modelo se vuelve a entrenar automáticamente en los próximos minutos.' : `Último entrenamiento: ${e.entrenado_en ? fechaHora(e.entrenado_en) : '—'}`}</small></div>
    </div>
    <div class="mod-met">
      <div><small>Error medio</small><b>±${fmt(mt.prophet.MAE, 1)}</b><span>pasajeros / 15 min</span></div>
      <div><small>Error porcentual</small><b>${fmt(mt.prophet.MAPE, 1)} %</b><span>MAPE</span></div>
      <div><small>Historial</small><b>${fmt(D.historico.registros)}</b><span>intervalos</span></div>
    </div>
    ${e.pendiente ? `<button class="tecla tecla-sm ancho" id="recargar">${icono('reiniciar', 2)}<span>Actualizar al terminar</span></button>` : ''}`;
  const rb = cont.querySelector('#recargar');
  if (rb) rb.onclick = () => location.reload();
  if (e.pendiente && raiz.isConnected) sondeo = setTimeout(() => modelo(raiz), 60000);
}

export default {
  id: 'carga', nombre: 'Carga de datos', ic: 'subir',
  montar(raiz) {
    raiz.innerHTML = plantilla();
    const z = raiz.querySelector('#soltar'), inp = raiz.querySelector('#archivo');
    inp.onchange = () => { abrir(raiz, inp.files[0]); inp.value = ''; };
    z.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inp.click(); } };
    ['dragenter', 'dragover'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.add('encima'); }));
    ['dragleave', 'drop'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.remove('encima'); }));
    z.addEventListener('drop', (ev) => abrir(raiz, ev.dataTransfer.files[0]));
    raiz.querySelector('#plantilla').onclick = () => {
      const f = cal.ahoraISO();
      const filas = [['fecha_hora', 'pasajeros']];
      for (let m = D.operacion.hora_inicio * 60; m < D.operacion.hora_fin * 60; m += 15) filas.push([`${f} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, '']);
      descargar('plantilla_registros_abordaje.csv', filas);
    };
    previa(raiz); historial(raiz); modelo(raiz);
  },
  desmontar() { clearTimeout(sondeo); },
};
