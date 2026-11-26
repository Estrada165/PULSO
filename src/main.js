import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/vistas.css';
import './estilos/app.css';

import { MARCA, AJUSTES_INICIALES } from './config.js';
import { ISOTIPO, icono } from './lib/iconos.js';
import { enNube, sb, ACT, perfilActual, ingresar, recuperarClave, cargarDatos, salir, leerCSV, subirRegistros, nombreRol } from './datos/fuente.js';

import './pwa.js';

const raiz = document.querySelector('#app');
const tema = (() => { try { return JSON.parse(localStorage.getItem('pulso:ajustes'))?.tema; } catch { return null; } })() || AJUSTES_INICIALES.tema;
document.documentElement.dataset.tema = tema;

function inicio(texto = 'Cargando la operación') {
  raiz.innerHTML = `<div class="arranque"><div class="marca-logo grande">${ISOTIPO}</div><b>${MARCA.nombre}</b><span>${texto}</span><i class="arr-barra"><em></em></i></div>`;
}

function pantallaIngreso(modo = 'ingreso', msj = '') {
  const recuperar = modo === 'recuperar', nueva = modo === 'nueva';
  raiz.innerHTML = `
  <main class="ingreso">
    <section class="ing-marca" aria-hidden="true">
      <div class="ing-top"><span class="marca-logo">${ISOTIPO}</span><b>${MARCA.nombre}</b></div>
      <div class="ing-lema">
        <h1>Cada salida,<br>a la hora que <em>la demanda</em> pide.</h1>
        <p>Pronóstico de pasajeros y programación de salidas para la operación diaria de ${MARCA.empresa}</p>
      </div>
      <div class="ing-pulso">${Array.from({ length: 36 }, (_, i) => `<span style="--h:${(18 + 70 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21))).toFixed(0)}%;--d:${i * 40}ms"></span>`).join('')}</div>
    </section>
    <section class="ing-form">
      <form class="ing-caja" id="f-ing" novalidate>
        <span class="marca-logo solo-movil">${ISOTIPO}</span>
        <h2>${nueva ? 'Crea tu nueva contraseña' : recuperar ? 'Recupera tu acceso' : 'Ingresa a tu cuenta'}</h2>
        <p class="ing-sub">${nueva ? 'Escribe una contraseña de al menos 8 caracteres.' : recuperar ? 'Te enviaremos un enlace para crear una contraseña nueva.' : 'Usa el correo que te asignó el administrador.'}</p>
        ${nueva ? '' : `<label class="campo"><span>Correo</span><input type="email" id="i-correo" autocomplete="email" required placeholder="nombre@etusa.pe"></label>`}
        ${recuperar ? '' : `<label class="campo"><span>${nueva ? 'Nueva contraseña' : 'Contraseña'}</span><div class="campo-ojo"><input type="password" id="i-clave" autocomplete="${nueva ? 'new-password' : 'current-password'}" required minlength="${nueva ? 8 : 1}" placeholder="••••••••"><button type="button" class="ojo" aria-label="Mostrar contraseña">${icono('ojo', 2)}</button></div></label>`}
        <p class="ing-msj" id="i-msj" role="alert">${msj}</p>
        <button class="tecla tecla-acento ancho" type="submit" id="i-btn"><span>${nueva ? 'Guardar contraseña' : recuperar ? 'Enviar enlace' : 'Ingresar'}</span>${icono('derecha', 2.2)}</button>
        ${nueva ? '' : `<button type="button" class="enlace" id="i-alt">${recuperar ? 'Volver a ingresar' : '¿Olvidaste tu contraseña?'}</button>`}
      </form>
      <p class="ing-pie">${MARCA.empresa} · acceso restringido al personal autorizado</p>
    </section>
  </main>`;
  const f = raiz.querySelector('#f-ing'), msjEl = raiz.querySelector('#i-msj'), btn = raiz.querySelector('#i-btn');
  const ojo = raiz.querySelector('.ojo');
  if (ojo) ojo.onclick = () => { const i = raiz.querySelector('#i-clave'); i.type = i.type === 'password' ? 'text' : 'password'; ojo.classList.toggle('on'); };
  const alt = raiz.querySelector('#i-alt');
  if (alt) alt.onclick = () => pantallaIngreso(recuperar ? 'ingreso' : 'recuperar');
  raiz.querySelector('input')?.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    msjEl.textContent = ''; msjEl.classList.remove('ok');
    const correo = raiz.querySelector('#i-correo')?.value || '';
    const clave = raiz.querySelector('#i-clave')?.value || '';
    if (!nueva && !/^\S+@\S+\.\S+$/.test(correo)) { msjEl.textContent = 'Escribe un correo válido.'; return; }
    if (!recuperar && (nueva ? clave.length < 8 : !clave)) { msjEl.textContent = nueva ? 'La contraseña debe tener al menos 8 caracteres.' : 'Escribe tu contraseña.'; return; }
    btn.disabled = true; btn.classList.add('cargando');
    try {
      if (recuperar) { await recuperarClave(correo); msjEl.textContent = 'Listo. Revisa tu correo y sigue el enlace.'; msjEl.classList.add('ok'); }
      else if (nueva) { const r = await sb.auth.updateUser({ password: clave }); if (r.error) throw new Error(r.error.message); history.replaceState(null, '', location.pathname); await arrancar(); return; }
      else { await ingresar(correo, clave); await arrancar(); return; }
    } catch (err) { msjEl.textContent = err.message; }
    btn.disabled = false; btn.classList.remove('cargando');
  };
}

function pantallaSinModelo() {
  const puedeCargar = ['administrador', 'jefe_operaciones'].includes(ACT.usuario?.rol);
  raiz.innerHTML = `
  <main class="sin-modelo">
    <div class="sm-caja">
      <span class="marca-logo grande">${ISOTIPO}</span>
      <h1>${ACT.ruta ? `Ruta ${ACT.ruta.codigo} lista para empezar` : 'No hay una ruta activa'}</h1>
      <p>${!ACT.ruta ? 'Registra al menos una ruta activa en la base de datos para comenzar.' : puedeCargar ? 'Sube el historial de abordajes para entrenar el primer modelo. El entrenamiento corre en segundo plano y toma unos minutos.' : 'El jefe de operaciones aún no ha cargado el historial de abordajes. Vuelve a intentarlo más tarde.'}</p>
      ${ACT.ruta && puedeCargar ? `<label class="tecla tecla-acento"><input type="file" id="sm-archivo" accept=".csv" hidden>${icono('subir', 2)}<span>Subir historial (CSV)</span></label>` : ''}
      <p class="ing-msj" id="sm-msj" role="status"></p>
      <div class="sm-pie"><span>${ACT.usuario?.nombre || ''} · ${nombreRol(ACT.usuario?.rol || '')}</span><button class="enlace" id="sm-salir">Cerrar sesión</button><button class="enlace" id="sm-recargar">Actualizar</button></div>
    </div>
  </main>`;
  raiz.querySelector('#sm-salir').onclick = salir;
  raiz.querySelector('#sm-recargar').onclick = () => location.reload();
  const inp = raiz.querySelector('#sm-archivo'), msj = raiz.querySelector('#sm-msj');
  if (inp) inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const l = leerCSV(await f.text());
      msj.textContent = `Importando ${l.filas.length.toLocaleString('es-PE')} registros…`;
      await subirRegistros(l, f.name, (p) => { msj.textContent = `Importando… ${Math.round(p * 100)} %`; });
      msj.textContent = 'Historial importado. El modelo se está entrenando; esta pantalla se actualizará sola.'; msj.classList.add('ok');
      setTimeout(() => location.reload(), 90000);
    } catch (e) { msj.textContent = e.message; }
  };
}

let arrancado = false;
async function arrancar() {
  if (arrancado) return;
  inicio();
  try {
    const u = await perfilActual();
    if (!u) { pantallaIngreso(); return; }
    const D = await cargarDatos();
    if (!D) { pantallaSinModelo(); return; }
    arrancado = true;
    await import('./app.js');
  } catch (e) {
    raiz.innerHTML = `<main class="sin-modelo"><div class="sm-caja"><span class="marca-logo grande">${ISOTIPO}</span><h1>No se pudo conectar</h1><p>${e.message}</p><button class="tecla tecla-acento" onclick="location.reload()">${icono('reiniciar', 2)}<span>Reintentar</span></button></div></main>`;
  }
}

if (enNube) {
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') pantallaIngreso('nueva');
    if (ev === 'SIGNED_OUT' && arrancado) location.reload();
  });
  if (/type=recovery/.test(location.hash)) inicio('Validando enlace'); else arrancar();
} else arrancar();
