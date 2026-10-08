# Cofradía A Mesa Puesta — Migración de Excel a Supabase

## Fase 1 — Base de datos: implantada en entorno privado

Proyecto independiente: **Cofradía A Mesa Puesta** (DTV79), región `eu-west-1`. Se ejecutó `01_estructura_privada.sql` en el nuevo Supabase y se importaron los registros útiles del Excel privado, sin macros y sin publicar el archivo en GitHub.

### Origen
Solo las hojas **Pagos Cuotas, Asistencia, Restaurantes y Organizaron Comida**. Se excluyen expresamente **Leyenda Actas, Anuncios y Config** por estar en desuso. **Anuncios y Encuestas** continúan procediendo de Google Sheets/Apps Script; no se han importado desde Excel.

### Diseño (10 tablas)
- `cofrades` — socios, fechas, condición fundadora, categoría histórica informativa
- `restaurantes` — establecimientos únicos, datos de ubicación
- `comidas` — cada fecha es una convocatoria independiente y puede repetir restaurante
- `asistencias` — participación y **importe pagado** por cofrade/comida (no se fuerza respuesta a No)
- `invitados_comida` — invitados sin crear un cofrade ficticio
- `organizadores_comida` — asignación por comida; `vuelta` NULL si no consta
- `pagos_cuotas` — ingresos por ejercicio y fecha
- `cargos_bote` — acumulados históricos sin inventar cargos por comida
- `gastos_adicionales_comida` — otros gastos (sin aplicarlos automáticamente a saldos personales)
- `fotos_comida` — preparada para futura incorporación de imágenes

### Verificaciones realizadas
- 17 cofrades (16 activos), 9 restaurantes únicos, 11 comidas (10 celebradas, 1 planificada).
- 63 ingresos de cuotas, 17 cargos, 143 asistencias, 21 relaciones de organizadores, 1 invitado y 2 gastos adicionales.
- Las 10 comidas celebradas cuadran en asistentes e importes con el informe de conciliación del Excel; se distingue el invitado.
- Totales de cuotas y cargos conciliados con el Excel, sin diferencias por cofrade.
- 10/10 tablas tienen RLS activa; **anon y authenticated sin permisos directos** sobre tablas, incluida información económica.

### Seguridad y publicación
**Este repositorio es público**. No subir Excel, CSV de importación, saldos por persona, credenciales, datos individuales de asistentes ni exportaciones de pagos. El código SQL versionado no contiene nombres de cofrades ni importes privados.

**IMPORTANTE:** los JSON del sitio público anterior siguen alojados en GitHub; la instalación de Supabase **no los retira**. Antes de cambiar la web, hay que definir qué datos deben ser públicos, retirar detalles económicos del JSON y preparar API/consultas públicas seguras.

### Siguiente fase
1. Definir las vistas de lectura pública sin datos financieros privados y autenticación administrativa.
2. Sustituir los JSON de la web por consultas autorizadas al nuevo Supabase, sin interrumpir el sitio actual.
3. Rediseñar portada, restaurantes, cofrades y navegación **mobile-first**.
4. Mantener **Anuncios** y **Encuestas** conectados a sus orígenes de Google, con una integración segura.
5. Revisar fotos históricas de las comidas; todavía no se han trasladado sus archivos a Storage.

La rama `fase1/supabase-migracion` no modifica `docs/` ni la publicación actual.
