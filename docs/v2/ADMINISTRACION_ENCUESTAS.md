# Administración de encuestas — fase de preparación

El módulo se encuentra en `docs/v2/admin-encuestas.html` y `admin-encuestas.js`. Su diseño reutiliza `styles.css` y el menú compartido. La API y las tablas nuevas están en:

- `database/07_encuestas_administracion.sql`
- `database/08_encuestas_indices.sql`
- `database/09_api_publica_encuestas.sql` (lectura pública con privacidad por tipo y fechas)
- `database/10_identidad_votantes_y_opciones.sql` (identificadores de opciones y vinculación Auth)

**Ya aplicadas al proyecto Supabase Cofradía A Mesa Puesta** (`wmfcpnihymiiwgpvbngj`). La aplicación publicada y los votos de Google Apps Script **no se han tocado**. En esta fase, el administrador puede preparar borradores en Supabase, pero **la página pública sigue leyendo y escribiendo en Google**.

## Capacidades

- Crear, editar, programar, abrir, pausar, cerrar y archivar encuestas.
- Preguntas y descripciones, de 2 a 20 opciones, límite de opciones seleccionables por votante.
- Elegibilidad: todos los miembros activos o solo cofrades/fundadores.
- Tipos: pública, secreta, participación visible.
- Configuración de fecha y hora de apertura/cierre, visibilidad de resultados y ganador.
- Buscador, filtro por estado, indicadores, vista previa y recuento agregado por opción.
- Eliminación solo de borradores sin votos. Las reglas y opciones de una encuesta votada son inmutables.
- Acceso por correo/contraseña de Supabase Auth, con autorización en la base de datos; sin auto-registro.
- Gestión de identidades en el propio panel: lista de cofrades activos, vinculación de correo confirmado, revocación y control de una cuenta por cofrade.
- `encuestas-supabase.html` y `encuestas-supabase.js`: **entorno de pruebas independiente** con lectura desde Supabase, autenticación y voto asociado a la cuenta, sin selector de nombres ni conexión con Google.

## Activar la primera cuenta administradora

Actualmente Supabase Auth tiene **0 usuarios**, por lo que el panel no se puede utilizar con credenciales reales hasta dar de alta al primer administrador. Este paso **no debe automatizarse con credenciales en GitHub**.

1. En el panel de Supabase del proyecto **Cofradía A Mesa Puesta**, abrir **Authentication → Users** y crear un usuario con correo válido, contraseña robusta y correo confirmado. No reutilizar contraseñas del campeonato.
2. En **SQL Editor**, ejecutar sustituyendo el marcador por el correo exacto del usuario recién creado:

```sql
insert into public.administradores_cofradia(usuario_id,activo)
select id,true from auth.users where lower(email)=lower('CORREO_DEL_ADMINISTRADOR')
on conflict (usuario_id) do update set activo=excluded.activo;
```

3. Entrar a `docs/v2/admin-encuestas.html` en una versión de prueba publicada con el correo y contraseña. Solo los usuarios dados de alta en `administradores_cofradia` tienen permiso de gestión. El formulario de acceso no permite registrarse.
4. Crear una encuesta **de prueba en borrador**, editarla y eliminarla. No publicar ni registrar votos reales durante las pruebas de migración.
5. En el apartado **Acceso de los cofrades** del administrador, vincular las cuentas de cada miembro activo por su correo confirmado. El sistema impide asociar una misma cuenta a dos cofrades.
6. Revisar la página independiente `encuestas-supabase.html` para probar la identificación y las votaciones de prueba. Esta página no sustituye a `encuestas.html`.

**Para revocar permisos** sin eliminar la cuenta Auth:

```sql
update public.administradores_cofradia set activo=false
where usuario_id=(select id from auth.users where lower(email)=lower('CORREO_DEL_ADMINISTRADOR'));
```

## Seguridad y privacidad

- RLS habilitado en todas las tablas nuevas, sin acceso directo de `anon` ni `authenticated`.
- Las RPC de administración exigen sesión y pertenencia a `administradores_cofradia`. No se utiliza `user_metadata` para autorización.
- La función de voto exige `auth.uid()` vinculado a un cofrade activo y bloquea votos duplicados, fechas cerradas y opciones inválidas. No se aceptan nombres de votantes enviados por el navegador.
- La lectura pública `listar_encuestas_cofradia()` no muestra borradores ni programadas antes de su apertura. Aplica automáticamente las fechas de cierre y nunca muestra elecciones secretas ni resultados ocultos. La función de identidad solo devuelve el cofrade vinculado a la sesión.
- En encuestas secretas y de participación visible, los resultados permanecen ocultos hasta el cierre **también en el administrador**.
- En encuestas secretas y de participación visible **no se almacena una relación votante→opción**. Solo se guardan contadores y, separadamente, el control de participación. En encuestas públicas se conserva la relación en un esquema no expuesto.
- La base de datos y la API de administración **no exponen pagos, cuotas ni saldos**.
- El acceso no está habilitado para usuarios sin alta previa; `sessionStorage` guarda la sesión solo en la pestaña actual. Nunca colocar `service_role` en la web.
- La auditoría de Supabase puede avisar sobre RPC `SECURITY DEFINER` ejecutables por `authenticated`: son intencionadas, pero **cada una valida la identidad y los permisos dentro de la función**. No se permite ejecutarlas como `anon`.

## Verificaciones efectuadas

- SQL aplicado correctamente y tablas con RLS, sin permisos de lectura directa para roles públicos.
- RPC `soy_admin_cofradia`, `guardar_encuesta_admin`, `listar_encuestas_admin`, `eliminar_encuesta_admin` y `votar_encuesta_cofradia` restringidas a autenticados.
- Pruebas transaccionales con usuarios ficticios y **ROLLBACK**: creación, edición y borrado de borrador; rechazo de no-administrador; voto público/secreto, recuento agregado y rechazo del voto duplicado.
- El test de editor JS usa DOM y datos simulados: opciones, selección múltiple, previsualización y detección de opciones repetidas.
- Probada con `ROLLBACK` la lectura de 3 tipos de privacidad, el ocultamiento de programadas/borradores, la revelación del resultado secreto solo al cerrar, la vinculación/revocación de cuentas y el rechazo de una vinculación hecha por un no administrador.
- Probado el frontend Supabase con datos simulados: recupera la identidad, muestra opciones con ID y envía el voto sin selector de nombres ni llamadas a Google.
- Verificador de respaldo Google disponible en `scripts/verificar_encuestas_google.mjs`: valida estructura, tipos, totales, duplicados y encuestas abiertas, sin imprimir identidades ni modificar bases de datos.
- Confirmado que los usuarios ficticios, encuestas y votos de prueba **no permanecen en la base de datos**.

## Pendientes antes de activar el nuevo sistema público

1. Dar de alta y autorizar al administrador real; probar inicio/cierre de sesión.
2. Revisar el panel visualmente en móvil y ordenador. Vercel ha alcanzado el límite diario de despliegues, por lo que aún no se ha podido generar esta nueva vista previa.
3. Exportar y validar con `node scripts/verificar_encuestas_google.mjs ruta\\al\\respaldo.json` **todas las encuestas y votos históricos** desde Google Apps Script/Sheets. Revisar tipos, fechas, opciones, participantes, privacidad, cierre y resultados. **Aún no se ha realizado la importación** y no deben guardarse respaldos con datos personales en GitHub.
4. Dar de alta/vincular a los cofrades con Supabase Auth mediante la nueva sección del panel. Actualmente hay 0 usuarios Auth y 0 cofrades vinculados.
5. La API de lectura y el frontend autenticado de pruebas ya existen; comprobarlos con usuarios reales y **solo entonces** sustituir el GET/POST antiguo, sin permitir doble registro de votos.
6. Probar cierre programado, empate, varias opciones, encuesta sin votos, cofrade dado de baja, votante no autorizado, múltiples dispositivos y protección contra doble voto.
7. Preparar un histórico y una copia de seguridad comprobable antes del corte definitivo.
