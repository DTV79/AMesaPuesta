# A Mesa Puesta V2 — Vista previa móvil

La propuesta se encuentra en **`docs/v2/`** y no sustituye todavía a la web publicada de GitHub Pages.

## Páginas

- `index.html`: portada editorial con las tres últimas comidas, contadores, enlaces al tablón, encuestas, cofrades, himno y estatutos.
- `restaurantes.html`: historial gastronómico ordenado por fecha, búsqueda y filtros por año, reseñas, menús, indicaciones en Google Maps y galería de fotos locales reutilizadas de `../Fotos/`.
- `styles.css`: diseño responsive con navegación inferior, botones táctiles, foco visible y adaptación a móvil.
- `app.js`: lectura exclusiva de `public.listar_comidas_publicas()` en Supabase.
- `config.js`: **solo clave publishable** pública, sin credenciales privilegiadas.

## Datos y privacidad

`database/04_api_restaurantes_publicos.sql` habilita exclusivamente la lectura de 10 comidas celebradas y autorizadas para publicación. No se sirven cofrades, asistencias, organizadores, recaudaciones, cuotas ni cargos del bote.

Los enlaces a las páginas clásicas de Cofrades, Tablón, Encuestas, Himno y Estatutos se mantienen para evitar interrupciones. Las páginas **Cofrades y Restaurantes anteriores** todavía cargan sus JSON públicos; hay que adaptar Cofrades y retirar datos económicos de los JSON antes de poner V2 como página principal.

## Comprobaciones

- Sintaxis JavaScript correcta.
- Estructura HTML y rutas internas comprobadas.
- Estilos equilibrados y adaptados a móvil; se necesita aún prueba visual real en teléfonos.
- API: 10 registros con rol `anon`, 0 futuras publicadas; roles públicos sin SELECT en tablas personales ni financieras.
- La web pública actual no cambia.

## Previsualización

Vercel ha denegado crear automáticamente un nuevo proyecto con la conexión disponible (HTTP 403, sin permiso `create project`). **No existe todavía una URL Vercel de preview.** No se debe inventar una dirección de prueba ni fusionar este PR para obtenerla.

Cuando se conecte el repositorio a un proyecto de Vercel con permisos adecuados, configurar:
- Repositorio GitHub: `DTV79/AMesaPuesta`
- Rama preview: `fase1/supabase-migracion`
- Root Directory: `docs`
- Framework: Other
- Build Command: vacío
- Output Directory: vacío (servir archivos estáticos)

El enlace será `/v2/` dentro del dominio de esa preview, ya que el `index.html` principal sigue en `docs/index.html`.

## Pendiente previo a publicación

1. Abrir preview en móvil y escritorio y comprobar fotos, búsquedas y filtros.
2. Revisar y decidir los datos públicos de la ficha Cofrades, especialmente importes.
3. Adaptar enlaces y todas las páginas antes de cambiar la raíz `docs/index.html`.
4. Integrar anuncios y encuestas del flujo vigente de Google.
5. Auditar accesibilidad y seguridad, y confirmar el paso final a producción.
