# Rendimiento de navegación de Talentia

Este documento explica las optimizaciones de carga, sus límites y cómo comprobar que los menús mantienen su comportamiento. Los archivos modificados incluyen una descripción inicial y comentarios en las decisiones relevantes.

## Cambios

| Área | Antes | Ahora |
| --- | --- | --- |
| Código de pantallas | Todas se incluían en el archivo principal | Descarga por menú con React.lazy; precarga al pasar el cursor o enfocar el enlace |
| Perfil autorizado | Varias pantallas repetían validación de usuario y consulta de perfil | Solicitudes simultáneas compartidas y caché en memoria de hasta 30 segundos por token |
| Eventos de sesión | Se esperaban consultas de Supabase dentro de su callback | Revalidación diferida fuera del callback; evita bloquear la autenticación |
| Usuarios | Se consultaba el listado en cada montaje | React Query reutiliza datos durante dos minutos y refresca después de mutaciones |
| Equipo | Reconstrucción de índices y filtrado en cada render | Índices y resultados memorizados; búsqueda normalizada una vez por filtro |
| Listados de API | Rutas sin barra final provocaban redirección a la ruta declarada | Uso directo de la URL canónica en Equipo, Asignaciones, Proyectos, Oportunidades y Capacidades |
| Ofertas de valor | Una consulta de catálogo y hasta dos consultas por oferta | Máximo de tres consultas para el listado completo |

## Seguridad y actualización

- La caché del perfil solo acelera la interfaz. No reemplaza las comprobaciones del backend ni las políticas RLS de Supabase.
- El perfil se invalida al cambiar token, cerrar sesión, cambiar cuenta, actualizar el usuario o modificar el listado administrativo. Al consultar un perfil vencido se valida nuevamente; no hay una tarea periódica de refresco.
- La generación de la caché impide que una respuesta pendiente restaure permisos después de invalidarlos.
- Los datos de React Query se borran al cerrar sesión o cambiar cuenta. No se persisten nuevos datos privados en almacenamiento del navegador.
- Se conserva el tiempo de frescura global existente de dos minutos. Una mutación de Usuarios invalida su listado y lo actualiza sin ocultar la pantalla.
- El código de precarga solo descarga módulos; no consulta datos ni concede permisos.

## Verificación local

Desde `frontend`:

```powershell
node --test tests/*.test.mjs
npm run build
```

Desde `backend`:

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Las pruebas usan servicios simulados y SQLite en memoria. Verifican deduplicación, caducidad, cambio de cuenta, invalidación durante solicitudes, el número de consultas SQL, filtros y compatibilidad de respuestas. También se ejecutan las regresiones existentes del chat.

La compilación previa generaba un archivo principal de 893,35 kB (250,04 kB gzip). Después de separar las pantallas, el principal mide aproximadamente 672 kB (198 kB gzip). Los módulos del menú seleccionado se descargan aparte: esta comparación no representa el total transferido al abrir Equipo ni una medición de tiempo de respuesta. Vite todavía advierte que el archivo principal supera 500 kB.

## Comprobación con servicios reales

1. Abrir Equipo y Usuarios con la pestaña Network del navegador y registrar duración de documentos, JavaScript, Supabase y API.
2. Navegar a otro menú y volver en menos de dos minutos: Usuarios debe reutilizar su listado, sin una descarga bloqueante adicional.
3. Crear o editar un registro de prueba autorizado y comprobar que aparece el resultado actualizado.
4. Cerrar sesión y entrar con otra cuenta: no deben aparecer datos ni permisos de la cuenta anterior.
5. Comparar primera carga y navegación repetida por separado, usando la misma red y condiciones de caché.

No se han medido tiempos de producción ni modificado la infraestructura. Las mejoras no eliminan arranques en frío del hosting, latencia de red o tiempos de Supabase. Equipo todavía obtiene el listado completo de CV; si la medición identifica ese volumen como cuello de botella, el siguiente cambio debería separar resúmenes y detalles, conservando las funciones actuales.
