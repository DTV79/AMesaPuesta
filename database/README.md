# Cofradía A Mesa Puesta — Fase 1: base de datos

**Estado: diseño preparado, no desplegado.** La web sigue funcionando como antes.

Este directorio contiene el **borrador de PostgreSQL/Supabase** y el mapeo de los datos. Los CSV de datos personales **no se suben a GitHub**. El script de importación y los CSV se entregan en el paquete privado.

## Origen autorizado

Solo se tienen en cuenta estas 4 hojas del Excel `.xlsm`:

1. `Pagos Cuotas`
2. `Asistencia`
3. `Restaurantes`
4. `Organizaron Comida`

Se excluyen expresamente `Leyenda Actas`, `Anuncios` y `Config`. Anuncios y encuestas se obtendrán en una fase posterior de **Google Sheets / Apps Script**, no de las hojas antiguas.

## Archivos

- `schema_borrador.sql`: 10 tablas, claves foráneas, índices y RLS cerrada por defecto. **No ejecutar aún en un proyecto ajeno.**
- `mapeo_excel.md`: correspondencia entre columnas y entidades, validaciones y puntos por confirmar.
- `preparar_importacion.py` (paquete privado, todavía no subido): lector de las 4 hojas directamente desde un `.xlsm`, sin ejecutar macros. Produce CSV locales y un informe de conciliación.

## Estructura

```
cofrades ─── pagos_cuotas ─────┐
   ├──────── cargos_bote        │ saldo de un cofrade = cuotas ingresadas - cargos
   ├──────── asistencias ────── comidas ── restaurantes
   └──────── organizadores ────┤
                              ├── invitados_comida
                              ├── gastos_adicionales_comida
                              └── fotos_comida
```

Una comida/fecha es distinta de un restaurante; se puede repetir restaurante. `comidas.restaurante_id` acepta `NULL` mientras esté sin decidir la próxima comida. La valoración, menú, precios y descripción corresponden a **la comida**, no al establecimiento permanente.

## Privacidad

- El proyecto de GitHub es público: **no añadir CSV, Excel, saldos, invitaciones, credenciales ni SQL con datos reales**.
- Todas las tablas se crean con RLS activada y sin acceso directo `anon` / `authenticated`. Se abrirá únicamente la lectura de información no sensible tras definir permisos.
- La exportación JSON actual sigue visible: el cambio de base de datos por sí solo NO la hace privada. Habrá que retirar la exposición de cuotas/saldos al publicar la nueva web.
- No se incluye ningún token o clave de `Config`.

## Siguientes pasos

1. Elegir o crear un **proyecto independiente Supabase** para esta cofradía; no reutilizar por accidente uno de pádel/otros proyectos.
2. Revisar el informe generado por el script y las anomalías de organizadores/alias.
3. Convertir este SQL revisado en una migración con Supabase CLI, ejecutarla en el proyecto correcto y verificar RLS y conteos.
4. Importar CSV **privadamente** en orden de dependencias: cofrades, restaurantes, comidas, pagos_cuotas, cargos_bote, asistencias, invitados, organizadores, gastos. Fotos después.
5. Obtener los esquemas reales de encuestas y anuncios de Google Sheets y diseñar esa migración sin usar los datos obsoletos del `.xlsm`.
6. Crear administración y, posteriormente, web pública móvil.
