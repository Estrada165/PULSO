import { S } from '../estado.js';
import { fmt } from '../lib/formato.js';
import { icono } from '../lib/iconos.js';
import { cabecera, aviso, segmentado, alSegmentar } from '../ui.js';
import { listarUsuarios, actualizarUsuario, listarBuses, actualizarBus, nombreRol, enNube, ACT } from '../datos/fuente.js';

let pestana = 'usuarios';
const ESTADOS = [['operativo', 'Operativo'], ['mantenimiento', 'Mantenimiento'], ['baja', 'De baja']];
const iniciales = (n) => (n || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

function plantilla() {
  return `
  ${cabecera({
    eti: 'Administración',
    titulo: 'Usuarios y flota',
    desc: 'Gestiona quién accede al sistema y con qué rol, y el estado de cada unidad de la flota.',
    guia: 'u-cab',
    acciones: segmentado('pest-u', [['usuarios', 'Usuarios'], ['flota', 'Flota']], pestana),
  })}
  <div id="u-cuerpo"></div>`;
}

async function usuarios(cont) {
  cont.innerHTML = `<article class="tarjeta" data-guia="u-lista">
    <div class="tarjeta-cab"><div><h3>${icono('usuarios', 2)}Cuentas</h3><p class="sub">${enNube ? 'Las cuentas nuevas se crean desde Supabase Auth o con el registro por invitación; aquí se asigna el rol.' : 'Modo local: una sola cuenta administradora.'}</p></div></div>
    <div class="tabla-c"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th></tr></thead><tbody id="u-tb"><tr><td colspan="3" class="tenue">Cargando…</td></tr></tbody></table></div>
  </article>
  <section class="rejilla g-3 mt" data-guia="u-roles">
    ${[['administrador', 'Todo el sistema, usuarios y flota.'], ['jefe_operaciones', 'Carga datos, ajusta reglas y aprueba programaciones.'], ['despachador', 'Consulta la programación y registra pasajeros reales.']].map(([r, t]) => `
      <article class="tarjeta rol-c"><span class="rol-ic">${icono(r === 'despachador' ? 'bus' : r === 'administrador' ? 'candado' : 'programacion', 2)}</span><b>${nombreRol(r)}</b><p>${t}</p></article>`).join('')}
  </section>`;
  const tb = cont.querySelector('#u-tb');
  try {
    const lista = await listarUsuarios();
    tb.innerHTML = lista.map((u) => {
      const yo = u.id === ACT.usuario.id;
      return `<tr>
        <td><span class="u-fila"><span class="avatar">${iniciales(u.nombre)}</span><span><b>${u.nombre}${yo ? ' <em class="tenue">(tú)</em>' : ''}</b><small>${u.correo}</small></span></span></td>
        <td><select class="sel" data-id="${u.id}" data-k="rol" ${yo || !enNube ? 'disabled' : ''} aria-label="Rol de ${u.nombre}">
          ${['administrador', 'jefe_operaciones', 'despachador'].map((r) => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${nombreRol(r)}</option>`).join('')}</select></td>
        <td><button class="switch ${u.activo ? 'on' : ''}" role="switch" aria-checked="${u.activo}" data-id="${u.id}" data-k="activo" aria-label="Cuenta activa" ${yo || !enNube ? 'disabled' : ''}><span></span></button></td>
      </tr>`;
    }).join('');
    tb.querySelectorAll('select[data-k="rol"]').forEach((s) => {
      s.onchange = async () => { try { await actualizarUsuario(s.dataset.id, { rol: s.value }); aviso('Rol actualizado'); } catch (e) { aviso(e.message, 'error'); } };
    });
    tb.querySelectorAll('.switch[data-k="activo"]').forEach((b) => {
      b.onclick = async () => {
        const v = !b.classList.contains('on');
        try { await actualizarUsuario(b.dataset.id, { activo: v }); b.classList.toggle('on', v); b.setAttribute('aria-checked', v); aviso(v ? 'Cuenta activada' : 'Cuenta desactivada'); } catch (e) { aviso(e.message, 'error'); }
      };
    });
  } catch (e) { tb.innerHTML = `<tr><td colspan="3">${e.message}</td></tr>`; }
}

async function flota(cont) {
  cont.innerHTML = `<article class="tarjeta" data-guia="u-flota">
    <div class="tarjeta-cab"><div><h3>${icono('bus', 2)}Unidades</h3><p class="sub" id="f-sub"></p></div></div>
    <div class="flota" id="flota"><p class="tenue">Cargando…</p></div>
  </article>`;
  const grid = cont.querySelector('#flota');
  try {
    const buses = await listarBuses();
    const resumen = () => {
      const op = buses.filter((b) => b.estado === 'operativo').length;
      cont.querySelector('#f-sub').textContent = `${fmt(op)} operativas de ${fmt(buses.length)} · la programación usa una flota de ${S.params.flota}`;
    };
    grid.innerHTML = buses.map((b) => `
      <div class="bus-c ${b.estado}">
        <div class="bus-top"><span class="bus-ic">${icono('bus', 2)}</span><b>${b.codigo}</b></div>
        <small>${b.placa || 'Sin placa'} · ${b.capacidad} plazas</small>
        <select class="sel sel-sm" data-id="${b.id}" aria-label="Estado de ${b.codigo}">${ESTADOS.map(([v, t]) => `<option value="${v}" ${b.estado === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>`).join('');
    resumen();
    grid.querySelectorAll('select').forEach((s) => {
      s.onchange = async () => {
        try {
          await actualizarBus(+s.dataset.id || s.dataset.id, { estado: s.value });
          const b = buses.find((x) => String(x.id) === s.dataset.id); b.estado = s.value;
          s.closest('.bus-c').className = 'bus-c ' + s.value; resumen(); aviso(`${b.codigo}: ${s.selectedOptions[0].text.toLowerCase()}`);
        } catch (e) { aviso(e.message, 'error'); }
      };
    });
  } catch (e) { grid.innerHTML = `<p>${e.message}</p>`; }
}

function pintar(raiz) {
  const cont = raiz.querySelector('#u-cuerpo');
  (pestana === 'usuarios' ? usuarios : flota)(cont);
}

export default {
  id: 'usuarios', nombre: 'Usuarios y flota', ic: 'usuarios',
  montar(raiz) {
    raiz.innerHTML = plantilla();
    alSegmentar(raiz, 'pest-u', (v) => { pestana = v; pintar(raiz); });
    pintar(raiz);
  },
};
