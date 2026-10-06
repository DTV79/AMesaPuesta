# A Mesa Puesta V2 — Vista previa móvil

La propuesta se encuentra en **`docs/v2/`** y no sustituye todavía a la web publicada de GitHub Pages.

**Detalle definitivo de Restaurantes (06/10/2026):** la ficha muestra los organizadores y el autor de la cita sin repetirlos en el desplegable. Dentro, el menú aparece **primero**, con cada plato en una línea (las barras, punto y coma y saltos separan platos); después asistentes, invitados si los hubo, no asistentes; finalmente, el precio histórico **total** de la comida, en un pie discreto. Los pagos, cuotas y remanentes individuales no se exponen. Usa `public.listar_comidas_publicas_v2()`, definida en `database/05_api_detalle_comidas.sql`.

## Páginas

- `index.html`: portada editorial con las tres últimas comidas, contadores, enlaces al tablón, encuestas, cofrades, himno y estatutos.
- `restaurantes.html`: historial gastronómico ordenado por fecha, búsqueda y filtros por año, reseñas, menús, indicaciones en Google Maps y galería de fotos locales reutilizadas de `../Fotos/`.
- `cofrades.html` y `cofrades.js`: 17 fichas públicas, filtro de activos/fundadores/aprendices/históricos, búsqueda, ordenación y recuentos de asistencias/organizaciones sin información económica.
- `encuestas.html` y `encuestas.js`: rediseño completo de votaciones públicas, secretas y de participación visible, con selección de hasta N opciones, elegibilidad, resultados, empates, cerradas recientes e histórico. **Reutiliza la API actual de Google Apps Script** para no alterar votos ni resultados. El módulo de administración y la migración de encuestas a Supabase están pendientes.
- `anuncios.html` y `anuncios.js`: Tablón de anuncios V2 con búsqueda, filtros por categoría y destacados, anuncios urgentes, enlaces seguros, fecha de publicación/evento y contenido expandible. **Continúa leyendo `../anuncios.json` sincronizado desde Google Sheets** hasta implementar administración con Supabase. Respeta visibilidad, publicación programada, fecha de caducidad y vigencia de destacados.
- `estatutos.html`: versión de lectura con los **6 capítulos y 11 artículos originales**, enlaces al PDF aprobado, índice responsive y sello AMP con cangrejo al fondo. Sin alterar el contenido de los artículos.
- `styles.css`: diseño responsive con navegación inferior, botones táctiles, foco visible y adaptación a móvil.
- `scroll-top.js`: botón móvil `↑` compartido para regresar a la cabecera después de bajar 500 px. Todas las páginas V2 lo cargan con `defer`; debe incluirse también en cada nueva página.
- `app.js`: lectura exclusiva de `public.listar_comidas_publicas_v2()` en Supabase.
- `config.js`: **solo clave publishable** pública, sin credenciales privilegiadas.
- `GUIA_ESTILO.md`: misma cabecera, navegación, paleta, tipografía y componentes en todas las páginas nuevas.

## Datos y privacidad

Las API de `database/04_api_restaurantes_publicos.sql`, `05_api_detalle_comidas.sql` y `06_api_cofrades_publicos.sql` sirven únicamente datos públicos de comidas celebradas y cofrades. Cofrades expone nombre, categoría, fecha de ingreso/baja, número de comidas asistidas y organizadas: no contiene cuotas, gastos, remanentes ni importes pagados. El rol `anon` puede ejecutar la función pero **no leer directamente las tablas personales ni financieras**.

El enlace a Himno sigue apuntando temporalmente a la página clásica, que también se adaptará al mismo sistema visual. Encuestas ya tiene su propia V2; la votación continúa usando el sistema anterior hasta completar la migración y su seguridad. El Tablón ya usa la V2, aunque los anuncios siguen llegando desde Google Sheets mientras no se haya creado el administrador. Estatutos ya usa la V2. La web anterior sigue exponiendo `docs/cofrades.json` con datos económicos históricos: **hay que sustituir la ruta y sanear/eliminar el JSON antes de publicar V2 en producción**.

## Comprobaciones

- Sintaxis JavaScript correcta.
- Estructura HTML y rutas internas comprobadas.
- Estilos equilibrados y adaptados a móvil; se necesita aún prueba visual real en teléfonos.
- API: 10 registros con rol `anon`, 0 futuras publicadas; roles públicos sin SELECT en tablas personales ni financieras.
- Cofrades: 17 registros, 16 activos, 5 fundadores, 111 participaciones históricas; `anon` ejecuta solo la RPC pública, sin acceso a cuotas ni cargos.
- Identidad uniforme: cabeceras, pies, menús móviles y CSS compartidos por Inicio, Restaurantes y Cofrades.
- La web pública actual no cambia.

## Previsualización

El proyecto Vercel `amesapuesta-docs` está vinculado a `DTV79/AMesaPuesta` con raíz `docs`; la rama `fase1/supabase-migracion` publica automáticamente las versiones de prueba. Las URLs de rama están protegidas por Vercel Authentication; para compartir una preview se emite un enlace temporal `?_vercel_share=...` para el despliegue concreto. La URL final de producción no cambia al publicar la rama.
 
## Pendiente previo a publicación

1. Abrir preview en móvil y escritorio y comprobar fotos, búsquedas y filtros.
2. Revisar y decidir los datos públicos de la ficha Cofrades, especialmente importes.
3. Adaptar enlaces y todas las páginas antes de cambiar la raíz `docs/index.html`.
4. Preparar administración de anuncios y encuestas en Supabase; por ahora se mantiene el flujo vigente de Google Sheets/Apps Script para no interrumpir la publicación ni los votos. Verificar la identidad del votante al migrar, especialmente para las encuestas secretas.
5. Auditar accesibilidad y seguridad, y confirmar el paso final a producción.
