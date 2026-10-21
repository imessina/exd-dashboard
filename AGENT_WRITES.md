# Escrituras del chat con confirmación

Este documento describe cómo TalentIA propone cambios sin dar al modelo permisos para guardarlos.

## Flujo

1. Las herramientas de `tools/escritura.py` solo devuelven propuestas estructuradas. No realizan peticiones HTTP ni utilizan credenciales de escritura.
2. `tools/proposals.py` extrae propuestas de resultados de herramientas, no del texto del asistente.
3. El backend valida operación y campos, exige un usuario editor, administrador o superadministrador y conserva la propuesta durante diez minutos en `agent_actions`, vinculada al usuario y a la conversación.
4. El chat muestra los datos y botones **Confirmar** y **Cancelar**. Escribir «sí» al modelo no ejecuta cambios.
5. `POST /api/ai/actions/{id}/decision` recibe únicamente `session_id` y un booleano `confirm`. El contenido se recupera del servidor; el navegador no puede sustituirlo.
6. La escritura y el estado final se confirman en una misma transacción. Un reintento de una acción ejecutada devuelve su resultado sin duplicar registros. PostgreSQL bloquea la fila para coordinar procesos concurrentes.

Operaciones admitidas: crear persona, proyecto u oportunidad y actualizar proyecto. Actualizar un hito conserva su registro histórico. Las rutas REST de escritura también exigen identidad y rol; una API key compartida no autoriza escrituras.

## Instalación

Desplegar juntos backend, frontend y agente; un agente antiguo no implementa este protocolo. Antes de habilitar confirmaciones, ejecutar desde `backend`, con su entorno configurado:

```powershell
.\.venv\Scripts\python.exe init_agent_actions.py
```

El script crea solo la tabla de confirmaciones. En PostgreSQL activa RLS y revoca el acceso de los roles de cliente Supabase `anon` y `authenticated`. La conexión del backend necesita permisos administrativos adecuados para crear y acceder a esta tabla. No exponerla mediante políticas de cliente.

Reiniciar backend y runtime del agente y reconstruir el frontend. Sin tabla o con versiones incompatibles, no se debe dar por validada la integración. No colocar secretos de Supabase en el frontend ni en herramientas del agente.

## Verificación

Las pruebas del backend utilizan SQLite y servicios simulados, sin modificar datos reales. Cubren permisos, propietario, conversación, caducidad, cancelación, reintentos y rollback. No sustituyen una prueba de concurrencia contra PostgreSQL ni una prueba integrada del runtime desplegado.

En una cuenta de pruebas, solicitar una propuesta y verificar que el registro no existe antes de confirmar. Confirmar una vez, reintentar la misma decisión y comprobar que existe un solo registro. Verificar que lectores no pueden escribir y que cancelar no guarda cambios.

## Plantilla CSV

La coma separa columnas. Dentro de las columnas de listas, como certificaciones e intereses, el punto y coma separa elementos. La plantilla descargable utiliza este formato y cuenta con una prueba de regresión.
