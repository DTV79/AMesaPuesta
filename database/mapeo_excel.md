# Mapeo de las cuatro hojas Excel

## Pagos Cuotas

- `B` (desde fila 11): nombre del **cofrade**. Se asigna UUID estable y se guarda la fila de origen; las relaciones usan IDs, nunca el nombre como clave.
- `C`,`D`: fechas de ingreso y baja.
- `A`: marca histórica de fundador; `E`: categoría **calculada/caché de Excel**, que se conserva como referencia, no como criterio automático definitivo.
- `N:AI`: pares de fecha / importe, ejercicios 2022–2032 → `pagos_cuotas` (solo pares efectivos).
- `G`: nº de cargos de 10 €; `H`: nº total de comidas cargadas; `K`: gasto acumulado. El importe `K` se conserva en **una línea de cargo histórico** por cofrade y se documentan los contadores. No inventar cargos asignados a comidas concretas.
- `L`: saldo histórico de control; `M`: ingreso histórico de control. No son campos editables ni la fuente del cálculo nuevo.
- Reconciliación por cofrade: `SUM(pagos_cuotas) == M`; `SUM(pagos_cuotas) - cargo_historico == L`.
- La definición exacta de ascensos de categoría debe validarse antes de automatizarse; no copiar sin revisar las fórmulas antiguas.

## Asistencia

- Filas 8–24: cofrades; fila 25: invitados, **sin convertir a cofrade**.
- Pares `D:E`, `F:G`, etc., por fecha/comida: `Asistió` y `Pagado` → `asistencias`.
- `Asistió`: `Sí` / `No` / vacío. Vacío significa **sin respuesta o sin registro**, nunca automáticamente `No`.
- `Pagado` es **importe monetario**, aunque la persona no asistiera. No convertir en booleano.
- `D:AE` puede contener columnas de comidas futuras en blanco. No generar asistencias ficticias.
- Fila 26: totales de cofrades de control por comida (no sumar invitados otra vez); fila 28: **otros gastos** (ej. taxis) → `gastos_adicionales_comida`.
- Los invitados tendrán tabla `invitados_comida`, que permite registrar nombre y pago puntual.

## Restaurantes

- Columnas `A:U`, filas 3–13 (última fila: comida prevista con restaurante por decidir).
- `A`: código histórico del evento `RES-0001`, etc. → `comidas.codigo_origen` (**NO** es el ID del restaurante).
- `B:E`, `R:S`: datos del restaurante físico, deduplicado por nombre + dirección.
- `F`, `G`, `I:Q`, `M`, `T:U`: fecha, reseña, menú, precio total del restaurante, descripción, autor y referencias de fotos → `comidas`.
- `H`: lista textual de organizadores; se contrasta con `Organizaron Comida` antes de crear relaciones.
- `N:O`: listas de asistentes/no asistentes, a menudo generadas por fórmulas. **Fuente primaria**: `Asistencia`.
- Si el restaurante es un marcador provisional (`¿ ?`), la comida sigue existiendo con `restaurante_id = NULL`, estado `planificada`.
- Las fotografías aún no se copian a Supabase: conservar ruta y recuento original; revisar ficheros físicos posteriormente.

## Organizaron Comida

- Columna `B`: cofrade; grupos `C:D`, `E:F`, `G:H`, `I:J`: restaurante/fecha para vueltas 1,2,3,4.
- Buscar comida por **fecha + establecimiento**, no solo por nombre del restaurante, porque hay visitas repetidas.
- Las filas de este registro determinan la `vuelta`. Los organizadores que figuran solo en `Restaurantes` se conservan también con `vuelta = NULL`, para no perder información ni inventar turnos.
- En textos de organizadores existen abreviaturas de nombres. Deben resolverse contra la lista de miembros; los ambiguos se señalan en el informe.

## Datos de Google Sheets (fuera de esta fase)

- **Anuncios y encuestas** no se migran desde este Excel. Para ambos se necesita el origen vivo de Google Sheets / Apps Script, con estructura, historial y reglas de voto/publicación.

## Controles antes de cargar en Supabase

1. Igualdad en número de miembros, comidas celebradas, comida pendiente y restaurantes únicos.
2. Fechas Excel convertidas correctamente (base 1899-12-30).
3. Cada registro de asistencia y cada organizador resuelve un UUID existente.
4. Reconciliación de cuotas, cargos y saldos con las fórmulas cacheadas en Excel.
5. Contraste de asistencias/importes por comida con los totales registrados.
6. Revisión manual de posibles omisiones entre las hojas `Organizaron Comida` y `Restaurantes`.
7. Ningún dato privado se sube a repositorios públicos.
