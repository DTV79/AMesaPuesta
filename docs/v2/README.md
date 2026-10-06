# A Mesa Puesta V2 — Vista previa móvil

La propuesta se encuentra en **`docs/v2/`** y no sustituye todavía a la web publicada de GitHub Pages.

**Detalle definitivo de Restaurantes (06/10/2026):** la ficha muestra los organizadores y el autor de la cita sin repetirlos en el desplegable. Dentro, el menú aparece **primero**, con cada plato en una línea (las barras, punto y coma y saltos separan platos); después asistentes, invitados si los hubo, no asistentes; finalmente, el precio histórico **total** de la comida, en un pie discreto. Los pagos, cuotas y remanentes individuales no se exponen. Usa `public.listar_comidas_publicas_v2()`, definida en `database/05_api_detalle_comidas.sql`.

## Páginas

- `index.html`: portada editorial con las tres últimas comidas, contadores, enlaces al tablón, encuestas, cofrades, himno y estatutos.
- `restaurantes.html`: historial gastronómico ordenado por fecha, búsqueda y filtros por año, reseñas, menús, indicaciones en Google Maps y galería de fotos locales reutilizadas de `../Fotos/`.
- `styles.css`: diseño responsive con navegación inferior, botones táctiles, foco visible y adaptación a móvil.
- `app.js`: lectura exclusiva de `public.listar_comidas_publicas_v2()` en Supabase.
- `config.js`: **solo clave publishable** pública, sin credenciales privilegiadas.

## Datos y privacidad

`database/04_api_restaurantes_publicos.sql` y `database/05_api_detalle_comidas.sql` habilitan únicamente la lectura de 10 comidas celebradas y publicadas. V2 incluye **nombres históricos de organizadores, asistentes y no asistentes**, citas y precio total que la web anterior ya mostraba. Nunca sirve pagos individuales, cuotas ni cargos del bote.

Los enlaces a las páginas clásicas de Cofrades, Tablón, Encuestas, Himno y Estatutos se mantienen para evitar interrupciones. Las páginas **Cofrades y Restaurantes anteriores** todavía cargan sus JSON públicos; hay que adaptar Cofrades y retirar datos económicos de los JSON antes de poner V2 como página principal.

## Comprobaciones

- Sintaxis JavaScript correcta.
- Estructura HTML y rutas internas comprobadas.
- Estilos equilibrados y adaptados a móvil; se necesita aún prueba visual real en teléfonos.
- API: 10 registros con rol `anon`, 0 futuras publicadas; roles públicos sin SELECT en tablas personales ni financieras.
- La web pública actual no cambia.

## Previsualización

El proyecto Vercel `amesapuesta-docs` está vinculado a `DTV79/AMesaPuesta` con raíz `docs`; la rama `fase1/supabase-migracion` publica automáticamente las versiones de prueba. Las URLs de rama están protegidas por Vercel Authentication; para compartir una preview se emite un enlace temporal `?_vercel_share=...` para el despliegue concreto. La URL final de producción no cambia al publicar la rama.
 
## Pendiente previo a publicación

1. Abrir preview en móvil y escritorio y comprobar fotos, búsquedas y filtros.
2. Revisar y decidir los datos públicos de la ficha Cofrades, especialmente importes.
3. Adaptar enlaces y todas las páginas antes de cambiar la raíz `docs/index.html`.
4. Integrar anuncios y encuestas del flujo vigente de Google.
5. Auditar accesibilidad y seguridad, y confirmar el paso final a producción.
