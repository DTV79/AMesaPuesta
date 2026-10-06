# Identidad visual común — Cofradía A Mesa Puesta V2

Decisión del proyecto: **todas las páginas nuevas tendrán una apariencia uniforme**. El diseño se desarrolla primero en `docs/v2/`, sin alterar la versión pública anterior hasta la aprobación final.

## Sistema compartido

- **Hoja principal única:** `styles.css`. No incorporar hojas distintas con encabezados, paletas ni tipografías contradictorias.
- **Colores:** papel `#f8f4ed`; fondo blanco cálido `#fffdf9`; vino principal `#8b252f`; vino oscuro `#531923`; dorado `#d7aa68`; líneas `#e8dcd1`.
- **Tipografía:** títulos en Georgia, contenido en la tipografía del sistema; jerarquía consistente de `eyebrow`, `section-title` y textos informativos.
- **Cabecera fija:** mismo logotipo cangrejo, título “A Mesa Puesta”, sección actual identificada y menú de escritorio centrado: Inicio / Nuestras comidas / Cofrades / Tablón / Encuestas. No repetir botones de navegación en la esquina superior.
- **Navegación móvil fija:** exactamente cuatro accesos y en el mismo orden en todas las páginas: **Inicio → Comidas → Cofrades → Más**. “Más” conduce a las secciones de la portada hasta que haya menú propio.
- **Volver arriba (obligatorio en todas las páginas V2 presentes y futuras):** incluir `<script src="./scroll-top.js" defer></script>` en el `<head>` de cada HTML, junto a `styles.css`. Al desplazarse 500 px aparece un botón circular `↑` en el lateral derecho del móvil, justo encima del menú inferior. Al pulsarlo vuelve al inicio con desplazamiento suave, salvo preferencia de movimiento reducido. Se oculta automáticamente al regresar arriba y no se muestra en escritorio.
- **Pie de página:** mismo crédito, mismo acceso a Estatutos.
- **Componentes:** mismas tarjetas redondeadas, bordes suaves, etiquetas, formularios, botones, textos de carga/error y estados de foco de teclado. Los colores distintivos se aplican solo a información con valor real (p. ej. fundador).
- **Anchura y responsive:** contenedor máximo 1160 px; rejillas adaptativas, componentes táctiles y desplazamiento de contenido sin tablas horizontales obligatorias.
- **Datos:** consultas directas a Supabase exclusivamente mediante funciones públicas de mínimos privilegios. Nunca incluir pagos individuales, cuotas o saldos en JSON/JS del navegador.

## Páginas de la nueva versión

| Página | Estado | Fichero |
|---|---|---|
| Inicio | Propuesta desarrollada | `docs/v2/index.html` |
| Comidas y Restaurantes | Aprobada por el usuario | `docs/v2/restaurantes.html` |
| Cofrades | Propuesta lista para prueba | `docs/v2/cofrades.html` |
| Tablón | Versión V2 responsive con filtros, avisos destacados, categorías y lectura ampliada; mantiene el JSON sincronizado desde Google Sheets hasta disponer de administración | `docs/v2/anuncios.html` + `docs/v2/anuncios.js` |
| Encuestas | Nueva versión V2 responsive: públicas, secretas y participación visible, votos múltiples, resultados, cierre reciente e histórico; conserva API de Google Apps Script hasta crear administración | `docs/v2/encuestas.html` + `docs/v2/encuestas.js` |
| Estatutos | Nueva versión con sello AMP sobre cangrejo, contenido original íntegro y PDF oficial | `docs/v2/estatutos.html` |
| Himno | Pendiente de migrar su diseño | Página anterior |

**No se consideran uniformes las páginas anteriores hasta rediseñarlas** con el sistema compartido. El enlace a Himno es temporal y seguirá funcionando mientras dure la migración.

## Encuestas

La página V2 mantiene la API **GET/POST** de `docs/encuestas.html` para conservar el historial, las encuestas en curso y la escritura de votos sin modificar el sistema actual. El POST envía `{pollId, cofrade, cofradeNombre, options}` con `Content-Type: text/plain;charset=utf-8`. No hacer pruebas con votos reales.

**Privacidad y reglas:** pública = resultados y votantes por opción visibles; secreta = ni resultados ni identidad antes de cerrar, y nunca revelar quién votó qué; participación visible = participantes visibles pero elección oculta, resultados solo al cerrar. Respetar `showResults`, `showWinner`, `maxChoices`, `votersMode`, fechas de cierre, recientes de 5 días, empates y participación. La lista de cofrades proviene de la API anterior. La selección de nombre no verifica por sí sola la identidad: la migración futura a Supabase y administración debe contemplar autenticación/autorización antes de aceptar votos, evitando suplantaciones, votos duplicados y exposición de elecciones secretas.

**Administración futura:** crear/editar preguntas y opciones, programar apertura/cierre, definir elegibilidad, tipos de privacidad y visibilidad, consultar resultados y archivar; migrar los datos y votos existentes sin perder integridad. No se ha creado todavía un administrador de encuestas ni una nueva API de votación. El botón «Volver arriba» y toda la navegación son los componentes compartidos.

## Tablón de anuncios

La nueva página usa el mismo menú centrado en escritorio, barra inferior en móvil, pie, CSS y botón flotante «Volver arriba» que el resto. Mantiene **sin cambios el origen** `docs/anuncios.json`, generado desde Google Sheets: solo publica anuncios `visible`, cuya `fechaPublicacion` ya ha llegado y cuya `fechaFin` no ha vencido. Destacados activos durante `dias_destacado` desde `fecha`, urgentes primero, búsqueda y filtros. No duplica los destacados en el listado general. No hay administración de anuncios en esta fase; se migrará posteriormente a Supabase y zona privada de gestión, sin interrumpir publicaciones.

## Cofrades

Se muestran nombre, categoría, fecha de ingreso, fecha de baja cuando existe, comidas asistidas y comidas organizadas, sin cifras económicas. Los 17 registros pueden consultarse: por defecto se muestran 16 activos, con filtros para fundadores, aprendices y miembros históricos. La función `public.listar_cofrades_publicos()` permite exclusivamente esos datos históricos; `anon` carece de permisos de lectura directa sobre `cofrades`, `pagos_cuotas` y `cargos_bote`.

El sello decorativo AMP se reserva a Estatutos: usa el cangrejo de fondo con las letras superpuestas. En Cofrades no aparece sello y Restaurantes no tiene botón de volver al inicio en cabecera. La web anterior todavía incluye `docs/cofrades.json` con datos económicos. **La V2 no lo carga**, pero su mera existencia en la web anterior significa que hay que retirarlo o sanearlo en el paso final a producción, después de sustituir la página antigua y probar los enlaces.

## Procedimiento futuro

1. Reutilizar cabecera, menú móvil, pie, `styles.css` y el script compartido `scroll-top.js`.
2. Añadir estilos locales solo dentro del sistema de componentes compartidos.
3. Comprobar escritorio, móvil, búsqueda y accesibilidad; verificar en móvil que el botón `↑` aparece tras desplazarse, funciona y no tapa la navegación inferior.
4. Comparar datos funcionales con la versión anterior y comprobar acceso anónimo permitido.
5. Probar en la rama `fase1/supabase-migracion` antes de aprobar el cambio de producción.
