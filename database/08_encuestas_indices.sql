-- Índices de soporte para el módulo de encuestas (sin modificar datos).
create index if not exists encuestas_cofradia_creada_por_idx on public.encuestas_cofradia(creada_por);
create index if not exists encuesta_participaciones_cofrade_idx on public.encuesta_participaciones_cofradia(cofrade_id);
create index if not exists votos_publicos_opcion_encuesta_idx on cofradia_privada.votos_publicos(opcion_id,encuesta_id);
