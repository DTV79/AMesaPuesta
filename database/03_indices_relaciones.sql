-- Índices para uniones por comida en los listados de detalle.
create index if not exists cargos_bote_comida_idx on public.cargos_bote(comida_id) where comida_id is not null;
create index if not exists gastos_adicionales_comida_idx on public.gastos_adicionales_comida(comida_id);
create index if not exists invitados_comida_idx on public.invitados_comida(comida_id);