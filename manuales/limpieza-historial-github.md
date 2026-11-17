# Eliminación de datos privados del historial de GitHub

Proyecto: `DTV79/AMesaPuesta`. Auditoría iniciada el 17/11/2026.

## Situación comprobada

Se han retirado de las **versiones actuales** de las seis ramas los siguientes archivos obsoletos:

- `docs/cofrades.json`
- `docs/restaurantes.json`
- `docs/anuncios.json`
- `docs/Estatutos.pdf`
- `docs2/cofrades.json`
- `docs2/restaurantes.json`
- `docs2/anuncios.json`
- `docs2/Estatutos.pdf`
- `docs/v2/Estatutos Versión 1.0.pdf`
- `nueva-web/v2/Estatutos Versión 1.0.pdf`

La web activa consulta Supabase. Los PDF de estatutos y las fotos de las comidas están protegidos mediante el almacenamiento privado y enlaces temporales de sesión.

**La eliminación de un archivo de la punta de una rama NO lo elimina de las confirmaciones anteriores.**

## Bloqueadores para una limpieza histórica completa

- El repositorio conserva seis ramas y solicitudes de cambio históricas (PR #1 y PR #2).
- Los refs internos `refs/pull/1/{head,merge}` y `refs/pull/2/{head,merge}` todavía apuntan a commits con las copias antiguas.
- `refs/pull/*` son referencias de solo lectura: incluso con force-push no pueden actualizarse desde un clon normal.
- Reescribir el historial altera SHA de commits, puede romper PR, automatizaciones, clones y las referencias de trabajo en curso.
- Para purgar versiones antiguas accesibles por su SHA y cachés en GitHub, después de reescribir todas las ramas y etiquetas, suele ser necesario contactar con **GitHub Support**.

**No ejecutar `git push --force` desde un clon desactualizado ni crear una nueva rama pública de respaldo que conserve los datos privados.**

## Procedimiento de eliminación definitiva recomendado

La limpieza histórica exige una operación coordinada, con una copia de seguridad local segura **fuera de GitHub** y una pausa temporal de cambios en este repositorio.

1. Conservar un clon de espejo completo **fuera de espacios públicos**, protegido, y anotar los SHA y el inventario de ramas/tags actuales.
2. Revisar las PR #1 y #2 para decidir su cierre o integración sin reintroducir datos sensibles.
3. Clonar de nuevo para la limpieza, siguiendo la [guía oficial de GitHub](https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) y asegurando una versión de `git-filter-repo` que soporte `--sensitive-data-removal`.
4. **En el clon de limpieza**, ejecutar una única pasada que excluya los diez archivos conocidos, incluyendo sus rutas antiguas:

```bash
git filter-repo --sensitive-data-removal --invert-paths \
  --path docs/cofrades.json \
  --path docs/restaurantes.json \
  --path docs/anuncios.json \
  --path docs/Estatutos.pdf \
  --path docs2/cofrades.json \
  --path docs2/restaurantes.json \
  --path docs2/anuncios.json \
  --path docs2/Estatutos.pdf \
  --path "docs/v2/Estatutos Versión 1.0.pdf" \
  --path "nueva-web/v2/Estatutos Versión 1.0.pdf"
```

5. Comprobar que el historial reescrito **no** contiene las rutas: `git log --all --name-only -- <rutas>` y contrastar los árboles de todas las ramas. Revisar `.git/filter-repo/changed-refs` y el número de PR afectadas.
6. Solo si el resultado es correcto y se han coordinado las PR/automatizaciones, actualizar el remoto con el procedimiento de force-push documentado por GitHub. No usar esta operación en un trabajo automatizado sin supervisión.
7. Solicitar a **GitHub Support** la eliminación de refs de PR y la purga de cachés, indicando repositorio, PR afectadas y `First Changed Commit(s)` reportados por `git-filter-repo`.
8. Re-clonar desde la historia limpia y verificar la publicación de GitHub Pages, la zona de administración, los Workflows de copias y las pruebas de recuperación.

## Alcance de la protección actual

- ✅ Ninguna de las seis ramas publica los diez archivos en su versión actual.
- ✅ `.gitignore` en `main` y `nueva-web` evita reintroducciones accidentales de rutas conocidas.
- ⏳ El historial Git y las referencias internas de PR requieren todavía la reescritura y la intervención indicada.
- ⏳ No se puede revocar lo que ya hayan copiado terceros de un repositorio público.

Si además se detectaran **credenciales reales** publicadas en el historial, deben rotarse o revocarse **antes** de cualquier filtrado de commits: reescribir Git no invalida secretos.

Guía oficial de GitHub: https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
