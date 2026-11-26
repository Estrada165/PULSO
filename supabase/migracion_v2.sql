alter table public.modelos add column if not exists resumen jsonb;

create index if not exists modelos_ruta_fecha on public.modelos (ruta_id, entrenado_en desc);
create index if not exists cargas_ruta_fecha on public.cargas (ruta_id, creado_en desc);
create index if not exists salidas_programacion on public.salidas (programacion_id, hora_programada);
