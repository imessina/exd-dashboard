# Gestión de ofertas de valor — versión corregida

Esta versión sigue la regla acordada:

- Conserva todas las ofertas reales que ya existen en `personas.oferta_valor`.
- Conserva a cada persona en su oferta actual.
- Solo corrige aliases/typos conocidos.
- `"Todas"` deja de existir como oferta real y pasa a `NULL` (Sin asignar).
- Crea un catálogo administrable.
- Permite editar, crear, activar/desactivar y eliminar solo ofertas sin personas.
- Renombrar una oferta actualiza a las personas asociadas, por lo que no se pierde la relación.
- Los responsables oficiales se guardan por `persona_id`.

## Responsables iniciales

- Creative Design → emp-259091
- Experience Optimization & Martech → emp-259091
- Experience Design & Research → emp-172741
- X-Reality → emp-114556
- Conversational AI & VoiceBot → emp-229913
- Digital Experiences Platforms → emp-125193
- Mobile Platforms → emp-125193

## Instalación segura

1. Reemplaza los archivos del ZIP en sus rutas equivalentes.
2. Reinicia FastAPI y confirma que levanta.
3. Ejecuta una sola vez:
   POST /api/admin/migrate-ofertas-valor
4. Valida:
   GET /api/ofertas-valor/
5. Reinicia Vite.

La migración es idempotente y no elimina ofertas reales ni sus asignaciones.
