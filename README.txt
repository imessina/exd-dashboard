PASO 6 — FRONTEND DE PERSONAS Y PIRÁMIDE

Reemplaza estos archivos conservando sus rutas:

frontend/src/pages/Personas.jsx
frontend/src/pages/Piramide.jsx
frontend/src/utils/constants.js

Cambios:
- La Pirámide usa nivel_piramide como fuente oficial.
- Nuevo orden:
  Director
  Manager
  Chief
  Evangelist
  Expert
  Leader
  Professional
  Junior
- Equipo muestra el cargo real en rol.
- Equipo muestra número de empleado, fecha de ingreso y fecha de nacimiento.
- Los campos privados no se muestran.
- Los filtros usan nivel_piramide.
- Las 37 personas antiguas pueden aparecer como “Sin clasificar” hasta que sean reemplazadas.

Después de reemplazar:
1. Reinicia el frontend con npm run dev.
2. Revisa Equipo y Pirámide.
3. No borres todavía las personas antiguas.
