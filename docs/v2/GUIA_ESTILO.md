# Identidad visual común — Cofradía A Mesa Puesta V2

Decisión del proyecto: **todas las páginas nuevas tendrán una apariencia uniforme**. El diseño se desarrolla primero en `docs/v2/`, sin alterar la versión pública anterior hasta la aprobación final.

## Sistema compartido

- **Hoja principal única:** `styles.css`. No incorporar hojas distintas con encabezados, paletas ni tipografías contradictorias.
- **Colores:** papel `#f8f4ed`; fondo blanco cálido `#fffdf9`; vino principal `#8b252f`; vino oscuro `#531923`; dorado `#d7aa68`; líneas `#e8dcd1`.
- **Tipografía:** títulos en Georgia, contenido en la tipografía del sistema; jerarquía consistente de `eyebrow`, `section-title` y textos informativos.
- **Cabecera fija:** mismo logotipo cangrejo, título “A Mesa Puesta”, sección actual identificada, enlaces Inicio / Nuestras comidas / Cofrades / Tablón / Encuestas. El botón de acción mantiene posición y estilo.
- **Navegación móvil fija:** exactamente cuatro accesos y en el mismo orden en todas las páginas: **Inicio → Comidas → Cofrades → Más**. “Más” conduce a las secciones de la portada hasta que haya menú propio.
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
| Tablón | Pendiente de migrar su diseño; sigue Google | `docs/anuncios.html` |
| Encuestas | Pendiente de migrar su diseño; sigue Google | `docs/encuestas.html` |
| Estatutos | Nueva versión con sello AMP sobre cangrejo, contenido original íntegro y PDF oficial | `docs/v2/estatutos.html` |
| Himno | Pendiente de migrar su diseño | Página anterior |

**No se consideran uniformes las páginas anteriores hasta rediseñarlas** con el sistema compartido. Los enlaces a Tablón/Encuestas/Himno son temporales y seguirán funcionando mientras dure la migración.

## Cofrades

Se muestran nombre, categoría, fecha de ingreso, fecha de baja cuando existe, comidas asistidas y comidas organizadas, sin cifras económicas. Los 17 registros pueden consultarse: por defecto se muestran 16 activos, con filtros para fundadores, aprendices y miembros históricos. La función `public.listar_cofrades_publicos()` permite exclusivamente esos datos históricos; `anon` carece de permisos de lectura directa sobre `cofrades`, `pagos_cuotas` y `cargos_bote`.

El sello decorativo AMP se reserva a Estatutos: usa el cangrejo de fondo con las letras superpuestas. En Cofrades no aparece sello y Restaurantes no tiene botón de volver al inicio en cabecera. La web anterior todavía incluye `docs/cofrades.json` con datos económicos. **La V2 no lo carga**, pero su mera existencia en la web anterior significa que hay que retirarlo o sanearlo en el paso final a producción, después de sustituir la página antigua y probar los enlaces.

## Procedimiento futuro

1. Reutilizar cabecera, menú móvil, pie y `styles.css`.
2. Añadir estilos locales solo dentro del sistema de componentes compartidos.
3. Comprobar escritorio, móvil, búsqueda y accesibilidad.
4. Comparar datos funcionales con la versión anterior y comprobar acceso anónimo permitido.
5. Probar en la rama `fase1/supabase-migracion` antes de aprobar el cambio de producción.
