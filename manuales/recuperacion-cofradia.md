# Recuperación segura de A Mesa Puesta

Actualizado: 17/11/2026

## Estado y alcance

- Las copias de seguridad se producen los días 1 y 16 de cada mes mediante `.github/workflows/cofradia-backup.yml`.
- La base de datos se exporta con `pg_dump -Fc` (PostgreSQL 17).
- Los objetos de Supabase Storage incluidos son `comidas` y `estatutos`.
- Las copias se guardan cifradas con rclone en Google Drive, en `cofradia_cifrado:automaticas/` o `cofradia_cifrado:manuales/`.
- Cada copia contiene `base.dump`, `storage/` y `manifest.json` con huellas SHA-256.
- Se conservan las ocho últimas copias **automáticas**; las manuales no se purgan con esa política.
- **No se deben guardar contraseñas, tokens, claves de rclone o claves privadas en GitHub.** La pérdida de la configuración y contraseñas del remoto cifrado puede impedir recuperar las copias.

## Verificación automatizada sin tocar producción

En GitHub, abrir **Actions → Prueba de restauración aislada de Cofradía**.

Workflow: `.github/workflows/cofradia-prueba-restauracion.yml`

1. Se ejecuta automáticamente el día 17 de cada mes a las 04:00, después de la copia del día 16. También permite ejecución manual.
2. Descarga la copia más reciente de `automaticas/` (o la más reciente de `manuales/` si no existen automáticas) a un ejecutor temporal de GitHub.
3. Comprueba los archivos del remoto, el manifiesto y todos los SHA-256, incluyendo fotografías y documentos.
4. Comprueba que `base.dump` tiene formato PostgreSQL y que su índice puede leerse mediante `pg_restore --list`.
5. Crea un contenedor **PostgreSQL 17 aislado sin red** y recupera los datos de 15 tablas de negocio en tablas temporales de texto; verifica que las filas recuperadas coinciden con las del volcado.
6. Elimina el contenedor y los archivos descifrados del ejecutor.

Las tablas verificadas cubren cofrades, cuotas, pagos, comidas, asistencias, invitados, pagos de restaurante, gastos, liquidaciones y ajustes del bote.

**Interpretar el resultado:** la marca `PRUEBA_DE_RECUPERACION_OK` acredita que los datos críticos de esa copia pueden extraerse y cargarse en un PostgreSQL aislado y que los objetos conservan sus huellas. **No acredita una restauración funcional completa de Supabase**: no reconstruye en la prueba los servicios de Auth, políticas RLS, funciones RPC, triggers, Storage ni las opciones externas del proyecto. Para esas dependencias hace falta una restauración integral adicional en otro proyecto.

Si falla, **no borrar ninguna copia** y examinar el paso que falló. No modificar la producción para intentar arreglar el ensayo.

## Recuperación ante un fallo real (procedimiento supervisado)

1. **Preservar la situación**: detener escrituras administrativas, registrar la fecha y hora del problema y conservar todas las copias cifradas. No restaurar a ciegas sobre el Supabase en producción.
2. **Elegir copia**: seleccionar una carpeta concreta en `automaticas/` o `manuales/`. Anotar su fecha/hora UTC. Si ha habido cambios posteriores, podrían no estar incluidos.
3. **Descifrar fuera del repositorio público**: disponer de la configuración y clave de rclone; copiar el respaldo a un equipo seguro y comprobar `manifest.json` y los SHA-256.
4. **Crear destino independiente**: aprovisionar un proyecto de Supabase nuevo, con un identificador **diferente** del de producción. Configurar PostgreSQL, extensiones, Auth, roles, políticas y Edge Functions compatibles. No reutilizar credenciales de producción en clientes públicos.
5. **Restaurar base y servicios**: reconstruir la estructura compatible desde las migraciones y procedimientos de Supabase; cargar los datos seleccionados desde `base.dump` y verificar restricciones, índices, funciones, RLS, permisos y referencias de identidad. Evitar ejecutar un `pg_restore --clean` general contra un proyecto activo.
6. **Recuperar Storage**: subir los archivos de `storage/comidas/` y `storage/estatutos/` al almacenamiento del nuevo proyecto. Comprobar número de objetos, tamaños, huellas y acceso a fotografías/PDF con los permisos correctos.
7. **Reinstalar y comprobar la aplicación**: desplegar las Edge Functions y configuración necesarias en el destino; verificar login de cofrades, login admin y MFA, cuotas, remanente, listados, comidas, fotos y documentos. Nunca probar liquidaciones modificando los datos reales.
8. **Verificar contabilidad**: contrastar pagos vigentes, gastos históricos, reembolsos, saldos y estado de las liquidaciones con la copia y con un informe previo.
9. **Cambiar al nuevo proyecto solo después de la revisión**: actualizar URLs y claves públicas de la web, comprobar las rutas y comunicar cualquier pérdida de información desde la fecha/hora de la copia.

## Comprobaciones pendientes para considerar la recuperación completa

- Realizar en un **segundo proyecto Supabase** una restauración total funcional de Auth, tablas, funciones, políticas y Storage.
- Verificar por separado el acceso con contraseñas y los factores MFA tras el cambio de proyecto; la prueba de tablas no valida que sesiones antiguas o configuraciones externas se restauren.
- Probar la web completa apuntando únicamente al proyecto de ensayo, con datos de prueba si es necesario.
- Guardar fuera de GitHub, de forma segura, los procedimientos de acceso a la configuración cifrada y los pasos de recuperación.

## Protección de producción

La prueba automatizada solo necesita el secreto de rclone para **leer** las copias cifradas. No necesita ni usa contraseñas de la base de datos real ni la clave `service_role` de Supabase. El contenedor PostgreSQL se ejecuta sin red ni puertos publicados.
