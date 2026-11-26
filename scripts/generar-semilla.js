import { readFileSync, writeFileSync } from 'node:fs';
import { crearMotor } from '../src/motor/despacho.js';

const raiz = new URL('../', import.meta.url);
const D = JSON.parse(readFileSync(new URL('src/data/datos.json', raiz)));
const M = crearMotor(D);
const res = M.semana(D.params, { correccion: true, escenario: { activo: false } });

const csv = readFileSync(new URL('datos/registros_abordaje_R-01.csv', raiz), 'utf8').trim().split('\n').slice(1);
const porDia = new Map();
for (const l of csv) {
  const [fh, p] = l.split(',');
  const [f, h] = fh.split(' ');
  const [hh, mm] = h.split(':').map(Number);
  const k = (hh * 60 + mm - D.operacion.hora_inicio * 60) / D.operacion.min_intervalo;
  if (!porDia.has(f)) porDia.set(f, new Array(D.operacion.n_intervalos).fill(null));
  porDia.get(f)[k] = Number(p);
}

let semilla = 20261125;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };

function asignarBuses(horas) {
  const flota = Array.from({ length: D.params.flota }, (_, i) => ({ id: i + 1, libre: 0 }));
  return horas.map((t) => {
    flota.sort((a, b) => a.libre - b.libre || a.id - b.id);
    const b = flota.find((x) => x.libre <= t + 1e-6) || flota[0];
    b.libre = t + M.ciclo(t);
    return 'U-' + String(100 + b.id);
  });
}

const arr = (xs, f = (x) => x) => `array[${xs.map(f).join(',')}]`;
const txt = (s) => `'${String(s).replace(/'/g, "''")}'`;

const dias = res.dias.map((d, i) => {
  const tr = d.traza, oc = d.inteligente.ocupaciones, buses = asignarBuses(d.inteligente.horas);
  return {
    i,
    t: tr.map((x) => Math.round(x.t)),
    bus: buses,
    anden: tr.map((_, j) => (j % 2 ? 2 : 1)),
    carga: tr.map((x) => Math.max(0, Math.round(x.demanda))),
    regla: tr.map((x) => x.regla),
    real: oc.map((o) => Math.max(0, Math.min(Math.round(D.params.capacidad * 1.15), Math.round(o * D.params.capacidad * (0.88 + azar() * 0.24))))),
  };
});

const resumen = JSON.stringify(D).replace(/\$pulso\$/g, '');
const registros = [...porDia.entries()].map(([f, v]) => `(${txt(f)}::date, ${arr(v, (x) => (x == null ? 'null' : x))}::int[])`).join(',\n');
const usuarios = [
  ['b3c1f6a2-1d4e-4c7a-9f10-2a6e8d1c0001', 'jefe.operaciones@pulso.pe', 'Marco Quispe Rojas', 'jefe_operaciones'],
  ['b3c1f6a2-1d4e-4c7a-9f10-2a6e8d1c0002', 'despacho.norte@pulso.pe', 'Rosa Huamán Ccori', 'despachador'],
];

const migracion = readFileSync(new URL('supabase/migracion_v2.sql', raiz), 'utf8').trim();
const sql = `${migracion}

update public.usuarios
set rol = 'administrador', nombre = 'Carlos Estrada', activo = true
where correo ilike 'carlosestradamanchay%';

delete from auth.users where email in (${usuarios.map((u) => txt(u[1])).join(', ')});

${usuarios.map(([id, correo, nombre]) => `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', ${txt(correo)}, extensions.crypt('Pulso2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', ${txt(JSON.stringify({ nombre }))}, now() - interval '40 days', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '${id}', '${id}', jsonb_build_object('sub', '${id}', 'email', ${txt(correo)}, 'email_verified', true), 'email', now(), now() - interval '40 days', now());`).join('\n')}

${usuarios.map(([id, correo, nombre, rol]) => `insert into public.usuarios (id, nombre, correo, rol, activo, creado_en)
values ('${id}', ${txt(nombre)}, ${txt(correo)}, '${rol}', true, now() - interval '40 days')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;`).join('\n')}

delete from public.programaciones where ruta_id = (select id from public.rutas where codigo = 'R-01');
delete from public.modelos where ruta_id = (select id from public.rutas where codigo = 'R-01');
delete from public.registros_abordaje where ruta_id = (select id from public.rutas where codigo = 'R-01');
delete from public.cargas where ruta_id = (select id from public.rutas where codigo = 'R-01');

update public.buses set estado = 'operativo' where ruta_id = (select id from public.rutas where codigo = 'R-01');
insert into public.buses (ruta_id, codigo, placa, capacidad, estado)
select r.id, x.codigo, x.placa, 85, x.estado::estado_bus
from public.rutas r, (values ('U-146', 'C4X-812', 'mantenimiento'), ('U-147', 'D2K-305', 'mantenimiento'), ('U-148', 'B9T-447', 'baja')) as x(codigo, placa, estado)
where r.codigo = 'R-01'
on conflict (codigo) do nothing;
update public.buses set estado = 'mantenimiento' where codigo in ('U-146', 'U-147');
update public.buses set estado = 'baja' where codigo = 'U-148';
update public.buses b set placa = 'A' || chr(65 + (substring(b.codigo from 3)::int % 26)) || (substring(b.codigo from 3)::int % 9 + 1) || '-' || lpad(((substring(b.codigo from 3)::int * 37) % 1000)::text, 3, '0')
where b.placa is null and b.ruta_id = (select id from public.rutas where codigo = 'R-01');

insert into public.parametros (ruta_id, creado_por, vigente_desde)
select r.id, '${usuarios[0][0]}', now() from public.rutas r where r.codigo = 'R-01';

insert into public.cargas (ruta_id, usuario_id, archivo, filas_nuevas, filas_actualizadas, desde, hasta, creado_en)
select r.id, '${usuarios[0][0]}', 'abordajes_R-01_historico.csv', 0, 0, null, null, now() - interval '2 days 3 hours'
from public.rutas r where r.codigo = 'R-01';

insert into public.registros_abordaje (ruta_id, fecha_hora, pasajeros, fuente, carga_id)
select r.id,
  (d.fecha + make_interval(mins => (${D.operacion.hora_inicio * 60} + (u.k - 1) * ${D.operacion.min_intervalo})::int))::timestamp at time zone 'America/Lima',
  u.v, 'importacion', c.id
from (values
${registros}
) as d(fecha, valores)
cross join lateral unnest(d.valores) with ordinality as u(v, k)
join public.rutas r on r.codigo = 'R-01'
join lateral (select id from public.cargas where ruta_id = r.id order by creado_en desc limit 1) c on true
where u.v is not null;

update public.cargas c
set filas_nuevas = x.n, desde = x.desde, hasta = x.hasta
from (select carga_id, count(*) n, min(fecha_hora) desde, max(fecha_hora) hasta from public.registros_abordaje group by carga_id) x
where x.carga_id = c.id;

insert into public.modelos (ruta_id, algoritmo, entrenado_en, datos_desde, datos_hasta, registros, mae, rmse, mape, mae_empirico, segundos_entrenamiento, resumen)
select r.id, 'prophet', now() - interval '2 days 2 hours 40 minutes',
  (select min(fecha_hora) from public.registros_abordaje where ruta_id = r.id),
  (select max(fecha_hora) from public.registros_abordaje where ruta_id = r.id),
  (select count(*) from public.registros_abordaje where ruta_id = r.id),
  ${D.metricas.prophet.MAE}, ${D.metricas.prophet.RMSE}, ${D.metricas.prophet.MAPE}, ${D.metricas.empirico.MAE}, 41.8,
  $pulso$${resumen}$pulso$::jsonb
from public.rutas r where r.codigo = 'R-01';

do $$
declare
  rid bigint := (select id from public.rutas where codigo = 'R-01');
  mid bigint := (select id from public.modelos where ruta_id = rid order by entrenado_en desc limit 1);
  pid bigint := (select id from public.parametros_vigentes where ruta_id = rid);
  lunes date := date_trunc('week', (now() at time zone 'America/Lima'))::date;
  hoy date := (now() at time zone 'America/Lima')::date;
  s record;
  f date;
  prog bigint;
begin
  for s in select * from (values
${dias.map((d) => `(${d.i}, ${arr(d.t)}, ${arr(d.bus, txt)}, ${arr(d.anden)}, ${arr(d.carga)}, ${arr(d.regla, txt)}, ${arr(d.real)})`).join(',\n')}
  ) as v(dia, t, bus, anden, carga, regla, real) order by dia loop
    f := lunes + s.dia;
    continue when f > hoy;
    insert into public.programaciones (ruta_id, fecha, modelo_id, parametros_id, estado, creado_en, aprobado_por, aprobado_en)
    values (rid, f, mid, pid, case when f < hoy then 'ejecutada' else 'aprobada' end::estado_programacion,
      (f - 1)::timestamp at time zone 'America/Lima' + interval '17 hours 40 minutes',
      '${usuarios[0][0]}', (f - 1)::timestamp at time zone 'America/Lima' + interval '18 hours 5 minutes')
    returning id into prog;
    insert into public.salidas (programacion_id, bus_id, hora_programada, hora_real, anden, carga_estimada, pasajeros_reales, regla, origen, registrado_por)
    select prog, b.id, hp,
      case when hp < now() then hp + make_interval(secs => ((x.k % 5) * 20)::int) end,
      x.anden, x.carga,
      case when hp < now() then x.real end,
      x.regla, 'plan',
      case when hp < now() then '${usuarios[1][0]}'::uuid end
    from unnest(s.t, s.bus, s.anden, s.carga, s.regla, s.real) with ordinality as x(t, bus, anden, carga, regla, real, k)
    left join public.buses b on b.codigo = x.bus
    cross join lateral (select (f::timestamp + make_interval(mins => x.t::int)) at time zone 'America/Lima' as hp) h;
  end loop;
end $$;

select u.nombre, u.correo, u.rol from public.usuarios u order by u.rol;
`;

writeFileSync(new URL('supabase/datos_iniciales.sql', raiz), sql);
console.log(`supabase/datos_iniciales.sql · ${(sql.length / 1024).toFixed(0)} KB · ${porDia.size} días · ${dias.reduce((a, d) => a + d.t.length, 0)} salidas`);
