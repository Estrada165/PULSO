create extension if not exists pgcrypto;

create type rol_usuario as enum ('administrador', 'jefe_operaciones', 'despachador');
create type estado_bus as enum ('operativo', 'mantenimiento', 'baja');
create type tipo_dia as enum ('laboral', 'sabado', 'domingo');
create type fuente_registro as enum ('importacion', 'validador', 'manual', 'simulado');
create type estado_programacion as enum ('borrador', 'aprobada', 'ejecutada', 'anulada');
create type origen_salida as enum ('plan', 'correccion');

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  rol rol_usuario not null default 'despachador',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.rutas (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nombre text not null,
  km_ida numeric(6,2) not null check (km_ida > 0),
  paraderos int not null default 0 check (paraderos >= 0),
  hora_inicio time not null default '05:00',
  hora_fin time not null default '23:00',
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.buses (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete restrict,
  codigo text not null unique,
  placa text unique,
  capacidad int not null default 85 check (capacidad > 0),
  estado estado_bus not null default 'operativo',
  creado_en timestamptz not null default now()
);

create table public.feriados (
  fecha date primary key,
  nombre text not null
);

create table public.ciclos (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete cascade,
  hora_inicio time not null,
  hora_fin time not null,
  minutos int not null check (minutos > 0),
  check (hora_fin > hora_inicio)
);

create table public.horario_manual (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete cascade,
  tipo tipo_dia not null,
  hora_inicio time not null,
  hora_fin time not null,
  intervalo_min int not null check (intervalo_min > 0),
  check (hora_fin > hora_inicio)
);

create table public.cargas (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete restrict,
  usuario_id uuid references public.usuarios (id) on delete set null,
  archivo text not null,
  filas_nuevas int not null default 0,
  filas_actualizadas int not null default 0,
  desde timestamptz,
  hasta timestamptz,
  creado_en timestamptz not null default now()
);

create table public.registros_abordaje (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete restrict,
  fecha_hora timestamptz not null,
  pasajeros int not null check (pasajeros >= 0),
  fuente fuente_registro not null default 'importacion',
  carga_id bigint references public.cargas (id) on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (ruta_id, fecha_hora),
  check (extract(minute from fecha_hora at time zone 'America/Lima')::int % 15 = 0)
);

create table public.parametros (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete cascade,
  ocupacion_objetivo numeric(4,2) not null default 0.80 check (ocupacion_objetivo between 0.1 and 1.2),
  ocupacion_minima numeric(4,2) not null default 0.30 check (ocupacion_minima between 0 and 1),
  factor_seguridad numeric(4,2) not null default 1.05 check (factor_seguridad between 1 and 2),
  intervalo_minimo int not null default 2 check (intervalo_minimo > 0),
  espera_maxima int not null default 10 check (espera_maxima > 0),
  flota int not null default 45 check (flota > 0),
  umbral_correccion numeric(4,2) not null default 0.12 check (umbral_correccion between 0 and 1),
  alpha_correccion numeric(4,2) not null default 0.60 check (alpha_correccion between 0 and 1),
  correccion_min numeric(4,2) not null default 0.80,
  correccion_max numeric(4,2) not null default 1.40,
  vigente_desde timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  check (espera_maxima > intervalo_minimo),
  check (correccion_max > correccion_min)
);

create table public.modelos (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete cascade,
  algoritmo text not null default 'prophet',
  entrenado_en timestamptz not null default now(),
  datos_desde timestamptz not null,
  datos_hasta timestamptz not null,
  registros int not null check (registros > 0),
  mae numeric(10,3),
  rmse numeric(10,3),
  mape numeric(6,2),
  mae_empirico numeric(10,3),
  segundos_entrenamiento numeric(8,3),
  check (datos_hasta > datos_desde)
);

create table public.pronosticos (
  id bigint generated always as identity primary key,
  modelo_id bigint not null references public.modelos (id) on delete cascade,
  fecha_hora timestamptz not null,
  valor numeric(8,2) not null check (valor >= 0),
  minimo numeric(8,2) check (minimo >= 0),
  maximo numeric(8,2) check (maximo >= 0),
  unique (modelo_id, fecha_hora)
);

create table public.programaciones (
  id bigint generated always as identity primary key,
  ruta_id bigint not null references public.rutas (id) on delete restrict,
  fecha date not null,
  modelo_id bigint references public.modelos (id) on delete set null,
  parametros_id bigint not null references public.parametros (id) on delete restrict,
  estado estado_programacion not null default 'borrador',
  creado_en timestamptz not null default now(),
  aprobado_por uuid references public.usuarios (id) on delete set null,
  aprobado_en timestamptz
);

create unique index programaciones_vigente_unica
  on public.programaciones (ruta_id, fecha)
  where estado in ('aprobada', 'ejecutada');

create table public.salidas (
  id bigint generated always as identity primary key,
  programacion_id bigint not null references public.programaciones (id) on delete cascade,
  bus_id bigint references public.buses (id) on delete set null,
  hora_programada timestamptz not null,
  hora_real timestamptz,
  anden int,
  carga_estimada int check (carga_estimada >= 0),
  pasajeros_reales int check (pasajeros_reales >= 0),
  regla text,
  origen origen_salida not null default 'plan',
  registrado_por uuid references public.usuarios (id) on delete set null
);

create table public.correcciones (
  id bigint generated always as identity primary key,
  programacion_id bigint not null references public.programaciones (id) on delete cascade,
  fecha_hora timestamptz not null,
  demanda_prevista numeric(8,2) not null,
  demanda_real int not null check (demanda_real >= 0),
  factor numeric(4,2) not null,
  accion text not null,
  creado_en timestamptz not null default now()
);

create index registros_ruta_fecha on public.registros_abordaje (ruta_id, fecha_hora desc);
create index pronosticos_fecha on public.pronosticos (fecha_hora);
create index salidas_programacion on public.salidas (programacion_id, hora_programada);
create index correcciones_programacion on public.correcciones (programacion_id, fecha_hora);
create index modelos_ruta on public.modelos (ruta_id, entrenado_en desc);

create or replace function public.rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo
$$;

create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, correo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

create or replace function public.marcar_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger registros_actualizado
  before update on public.registros_abordaje
  for each row execute function public.marcar_actualizacion();

create or replace view public.parametros_vigentes
with (security_invoker = true) as
select distinct on (ruta_id) *
from public.parametros
where vigente_desde <= now()
order by ruta_id, vigente_desde desc;

create or replace view public.indicadores_programacion
with (security_invoker = true) as
select
  p.id as programacion_id,
  p.ruta_id,
  p.fecha,
  p.estado,
  count(s.id) as salidas,
  count(s.pasajeros_reales) as salidas_registradas,
  round(avg(s.pasajeros_reales::numeric / nullif(b.capacidad, 0)) * 100, 1) as ocupacion_promedio,
  count(*) filter (where s.pasajeros_reales::numeric / nullif(b.capacidad, 0) < pr.ocupacion_minima) as salidas_baja_ocupacion,
  round(count(*) filter (where s.pasajeros_reales::numeric / nullif(b.capacidad, 0) < pr.ocupacion_minima) * r.km_ida * 2, 1) as km_en_vacio,
  count(*) filter (where s.origen = 'correccion') as salidas_por_correccion
from public.programaciones p
join public.rutas r on r.id = p.ruta_id
join public.parametros pr on pr.id = p.parametros_id
left join public.salidas s on s.programacion_id = p.id
left join public.buses b on b.id = s.bus_id
group by p.id, p.ruta_id, p.fecha, p.estado, r.km_ida;

alter table public.usuarios enable row level security;
alter table public.rutas enable row level security;
alter table public.buses enable row level security;
alter table public.feriados enable row level security;
alter table public.ciclos enable row level security;
alter table public.horario_manual enable row level security;
alter table public.cargas enable row level security;
alter table public.registros_abordaje enable row level security;
alter table public.parametros enable row level security;
alter table public.modelos enable row level security;
alter table public.pronosticos enable row level security;
alter table public.programaciones enable row level security;
alter table public.salidas enable row level security;
alter table public.correcciones enable row level security;

create policy usuarios_ver on public.usuarios for select to authenticated
  using (id = auth.uid() or public.rol_actual() = 'administrador');
create policy usuarios_admin on public.usuarios for update to authenticated
  using (public.rol_actual() = 'administrador')
  with check (public.rol_actual() = 'administrador');

create policy rutas_ver on public.rutas for select to authenticated using (public.rol_actual() is not null);
create policy buses_ver on public.buses for select to authenticated using (public.rol_actual() is not null);
create policy feriados_ver on public.feriados for select to authenticated using (public.rol_actual() is not null);
create policy ciclos_ver on public.ciclos for select to authenticated using (public.rol_actual() is not null);
create policy horario_ver on public.horario_manual for select to authenticated using (public.rol_actual() is not null);
create policy cargas_ver on public.cargas for select to authenticated using (public.rol_actual() is not null);
create policy registros_ver on public.registros_abordaje for select to authenticated using (public.rol_actual() is not null);
create policy parametros_ver on public.parametros for select to authenticated using (public.rol_actual() is not null);
create policy modelos_ver on public.modelos for select to authenticated using (public.rol_actual() is not null);
create policy pronosticos_ver on public.pronosticos for select to authenticated using (public.rol_actual() is not null);
create policy programaciones_ver on public.programaciones for select to authenticated using (public.rol_actual() is not null);
create policy salidas_ver on public.salidas for select to authenticated using (public.rol_actual() is not null);
create policy correcciones_ver on public.correcciones for select to authenticated using (public.rol_actual() is not null);

create policy rutas_admin on public.rutas for all to authenticated
  using (public.rol_actual() = 'administrador') with check (public.rol_actual() = 'administrador');
create policy buses_gestion on public.buses for all to authenticated
  using (public.rol_actual() in ('administrador', 'jefe_operaciones'))
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy feriados_admin on public.feriados for all to authenticated
  using (public.rol_actual() = 'administrador') with check (public.rol_actual() = 'administrador');
create policy ciclos_gestion on public.ciclos for all to authenticated
  using (public.rol_actual() in ('administrador', 'jefe_operaciones'))
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy horario_gestion on public.horario_manual for all to authenticated
  using (public.rol_actual() in ('administrador', 'jefe_operaciones'))
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy cargas_gestion on public.cargas for insert to authenticated
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy registros_gestion on public.registros_abordaje for insert to authenticated
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy registros_editar on public.registros_abordaje for update to authenticated
  using (public.rol_actual() in ('administrador', 'jefe_operaciones'))
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy parametros_gestion on public.parametros for insert to authenticated
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy programaciones_gestion on public.programaciones for all to authenticated
  using (public.rol_actual() in ('administrador', 'jefe_operaciones'))
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy salidas_gestion on public.salidas for insert to authenticated
  with check (public.rol_actual() in ('administrador', 'jefe_operaciones'));
create policy salidas_registrar on public.salidas for update to authenticated
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);
create policy correcciones_registrar on public.correcciones for insert to authenticated
  with check (public.rol_actual() is not null);

insert into public.rutas (codigo, nombre, km_ida, paraderos)
values ('R-01', 'Corredor Terminal Norte – Terminal Sur', 21.0, 9);

insert into public.buses (ruta_id, codigo, capacidad)
select r.id, 'U-' || (100 + n), 85
from public.rutas r, generate_series(1, 45) as n
where r.codigo = 'R-01';

insert into public.parametros (ruta_id)
select id from public.rutas where codigo = 'R-01';

insert into public.ciclos (ruta_id, hora_inicio, hora_fin, minutos)
select r.id, c.hi::time, c.hf::time, c.m
from public.rutas r,
  (values ('05:00', '06:00', 85), ('06:00', '10:00', 115), ('10:00', '16:00', 95),
          ('16:00', '21:00', 115), ('21:00', '23:00', 85)) as c (hi, hf, m)
where r.codigo = 'R-01';

insert into public.horario_manual (ruta_id, tipo, hora_inicio, hora_fin, intervalo_min)
select r.id, h.t::tipo_dia, h.hi::time, h.hf::time, h.i
from public.rutas r,
  (values ('laboral', '05:00', '06:00', 8), ('laboral', '06:00', '09:00', 4), ('laboral', '09:00', '12:00', 6),
          ('laboral', '12:00', '15:00', 6), ('laboral', '15:00', '17:00', 6), ('laboral', '17:00', '20:00', 4),
          ('laboral', '20:00', '22:00', 8), ('laboral', '22:00', '23:00', 12),
          ('sabado', '05:00', '07:00', 10), ('sabado', '07:00', '21:00', 6), ('sabado', '21:00', '23:00', 12),
          ('domingo', '05:00', '10:00', 12), ('domingo', '10:00', '19:00', 8), ('domingo', '19:00', '23:00', 12)) as h (t, hi, hf, i)
where r.codigo = 'R-01';

insert into public.feriados (fecha, nombre) values
  ('2025-12-08', 'Inmaculada Concepción'), ('2025-12-09', 'Batalla de Ayacucho'), ('2025-12-25', 'Navidad'),
  ('2026-01-01', 'Año Nuevo'), ('2026-04-02', 'Jueves Santo'), ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'), ('2026-06-07', 'Batalla de Arica'), ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-23', 'Día de la Fuerza Aérea'), ('2026-07-28', 'Fiestas Patrias'), ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-06', 'Batalla de Junín'), ('2026-08-30', 'Santa Rosa de Lima'), ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'), ('2026-12-08', 'Inmaculada Concepción'), ('2026-12-09', 'Batalla de Ayacucho'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'), ('2027-03-25', 'Jueves Santo'), ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'), ('2027-06-07', 'Batalla de Arica'), ('2027-06-29', 'San Pedro y San Pablo'),
  ('2027-07-23', 'Día de la Fuerza Aérea'), ('2027-07-28', 'Fiestas Patrias'), ('2027-07-29', 'Fiestas Patrias'),
  ('2027-08-06', 'Batalla de Junín'), ('2027-08-30', 'Santa Rosa de Lima'), ('2027-10-08', 'Combate de Angamos'),
  ('2027-11-01', 'Todos los Santos'), ('2027-12-08', 'Inmaculada Concepción'), ('2027-12-09', 'Batalla de Ayacucho'),
  ('2027-12-25', 'Navidad');
