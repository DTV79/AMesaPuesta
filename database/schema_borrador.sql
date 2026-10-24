-- Cofradía A Mesa Puesta | Borrador de esquema v1 | 2026-10-06
-- Aún NO se ha ejecutado en Supabase. Aplicar exclusivamente al proyecto
-- de Cofradía una vez confirmado/creado y después de revisar permisos.
-- No contiene datos personales ni claves.
begin;

create table public.cofrades (
  id uuid primary key default gen_random_uuid(),
  codigo_origen text not null unique,
  nombre text not null check (length(btrim(nombre)) > 0),
  fecha_ingreso date not null,
  fecha_baja date,
  fundador_marcado_excel boolean not null default false,
  categoria_excel text,
  usuario_auth_id uuid unique references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint cofrades_baja_posterior check (fecha_baja is null or fecha_baja >= fecha_ingreso)
);

create table public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  clave_importacion text not null unique,
  nombre text not null check (length(btrim(nombre)) > 0),
  direccion text,
  telefono text,
  web text,
  latitud numeric(10,7) check (latitud between -90 and 90),
  longitud numeric(10,7) check (longitud between -180 and 180),
  creado_en timestamptz not null default now()
);

-- Una comida = una fecha/convocatoria, aunque se repita el restaurante.
-- Restaurante NULL cuando el próximo destino aún no esté decidido.
create table public.comidas (
  id uuid primary key default gen_random_uuid(),
  codigo_origen text not null unique,
  fecha date not null,
  restaurante_id uuid references public.restaurantes(id) on delete restrict,
  estado text not null default 'planificada'
    check (estado in ('planificada', 'celebrada', 'cancelada')),
  resena_estrellas smallint check (resena_estrellas between 1 and 5),
  importe_restaurante_total numeric(12,2) check (importe_restaurante_total >= 0),
  descripcion text,
  autor_resena text,
  menu_entrantes text,
  menu_principales text,
  menu_postres text,
  menu_bebidas text,
  carpeta_fotos_legacy text,
  numero_fotos_legacy integer check (numero_fotos_legacy >= 0),
  publicada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index comidas_fecha_idx on public.comidas (fecha desc);
create index comidas_restaurante_idx on public.comidas (restaurante_id);

-- Estado explícito, no inferido: una celda vacía NO equivale a "No".
-- importe_pagado: el valor numérico de la columna 'Pagado' de Excel.
create table public.asistencias (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete restrict,
  cofrade_id uuid not null references public.cofrades(id) on delete restrict,
  estado text not null check (estado in ('si', 'no', 'sin_respuesta')),
  importe_pagado numeric(12,2) check (importe_pagado >= 0),
  observaciones text,
  unique (comida_id, cofrade_id)
);
create index asistencias_cofrade_idx on public.asistencias (cofrade_id);

create table public.invitados_comida (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) > 0),
  estado text not null default 'si'
    check (estado in ('si', 'no', 'sin_respuesta')),
  importe_pagado numeric(12,2) check (importe_pagado >= 0),
  codigo_origen text unique
);

-- La 'vuelta' viene de Organizaron Comida; NULL si el organizador
-- figura solo en Restaurantes (no necesariamente cuenta como turno).
create table public.organizadores_comida (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete restrict,
  cofrade_id uuid not null references public.cofrades(id) on delete restrict,
  vuelta smallint check (vuelta between 1 and 99),
  fuente text not null check (fuente in ('organizaron_comida', 'restaurantes')),
  unique (comida_id, cofrade_id)
);
create index organizadores_por_cofrade_idx on public.organizadores_comida (cofrade_id);

-- Ingresos de cuotas anuales individuales. Los saldos NO se editan:
-- deben calcularse como ingresos - cargos, más futuros ajustes auditados.
create table public.pagos_cuotas (
  id uuid primary key default gen_random_uuid(),
  codigo_origen text not null unique,
  cofrade_id uuid not null references public.cofrades(id) on delete restrict,
  ejercicio smallint not null check (ejercicio between 2000 and 2100),
  fecha date not null,
  importe numeric(12,2) not null check (importe > 0),
  notas text
);
create index pagos_cuotas_cofrade_idx on public.pagos_cuotas (cofrade_id, fecha);

-- Los cargos existentes en 'Pagos Cuotas' son históricos acumulados.
-- Mantenerlos como una línea por cofrade evita inventar qué comidas
-- concretas correspondían a 10 € o 15 €.
create table public.cargos_bote (
  id uuid primary key default gen_random_uuid(),
  codigo_origen text not null unique,
  cofrade_id uuid not null references public.cofrades(id) on delete restrict,
  comida_id uuid references public.comidas(id) on delete restrict,
  fecha date,
  tipo text not null check (tipo in ('historico_excel', 'cargo_comida', 'regularizacion')),
  importe numeric(12,2) not null check (importe >= 0),
  comidas_a_10_excel integer check (comidas_a_10_excel >= 0),
  comidas_a_15_excel integer check (comidas_a_15_excel >= 0),
  notas text
);
create index cargos_bote_cofrade_idx on public.cargos_bote (cofrade_id);

-- Taxis y otros gastos del evento: no cargar automáticamente al saldo
-- personal de cada cofrade sin una regla de reparto aprobada.
create table public.gastos_adicionales_comida (
  id uuid primary key default gen_random_uuid(),
  codigo_origen text not null unique,
  comida_id uuid not null references public.comidas(id) on delete restrict,
  concepto text not null,
  importe numeric(12,2) not null check (importe >= 0)
);

-- Rutas de las fotos: las imágenes reales seguirán en GitHub hasta
-- definir la migración a Storage.
create table public.fotos_comida (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete restrict,
  ruta_archivo text not null,
  titulo text,
  orden integer not null default 0,
  visible boolean not null default true,
  unique (comida_id, ruta_archivo)
);

-- Seguridad: fase 1 cerrada por defecto. Aún NO existen políticas RLS.
-- Cuando se acuerde el nivel de visibilidad se crearán políticas de
-- lectura pública SOLAMENTE para proyecciones sin datos económicos.
alter table public.cofrades enable row level security;
alter table public.restaurantes enable row level security;
alter table public.comidas enable row level security;
alter table public.asistencias enable row level security;
alter table public.invitados_comida enable row level security;
alter table public.organizadores_comida enable row level security;
alter table public.pagos_cuotas enable row level security;
alter table public.cargos_bote enable row level security;
alter table public.gastos_adicionales_comida enable row level security;
alter table public.fotos_comida enable row level security;

revoke all on public.cofrades, public.restaurantes, public.comidas,
  public.asistencias, public.invitados_comida,
  public.organizadores_comida, public.pagos_cuotas,
  public.cargos_bote, public.gastos_adicionales_comida,
  public.fotos_comida from anon, authenticated;

commit;
