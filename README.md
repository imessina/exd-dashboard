# ExD Control Center

Panel de gestión operativa para el equipo **Experience Design (ExD)** de NTT DATA. Centraliza la información del equipo, los proyectos activos, las oportunidades de negocio y el desarrollo profesional de cada persona, para dar soporte a las decisiones sobre asignaciones, capacidades y crecimiento del equipo.

Aplicación de uso interno. En su versión actual no requiere autenticación de usuarios.

## Módulos

- **Dashboard** (`/`) — Resumen ejecutivo con KPIs en tiempo real: personas, asignaciones activas, liberaciones a 14 días, proyectos activos, pipeline abierto y proyectos en riesgo.
- **Asignaciones** (`/asignaciones`) — Gestión de asignaciones de personas a proyectos (dedicación, fechas, estado) y próximas liberaciones.
- **Equipo / Personas** (`/personas`) — Registro del equipo, seniority, habilidades y datos profesionales.
- **Proyectos** (`/proyectos`) — Proyectos activos, distinguiendo *fixed scope* de *Time & Materials*, con estado y health.
- **Oportunidades** (`/oportunidades`) — Pipeline comercial y seguimiento de oportunidades.
- **Skill Matrix** (`/skill-matrix`) — Matriz de skills del equipo basada en el catálogo y evaluaciones reales.
- **Skills** (`/skills`) — Catálogo de habilidades con CRUD y categorización.
- **Carrera** y **Pirámide** — Vistas de desarrollo profesional y estructura del equipo.

## Stack tecnológico

**Backend:** FastAPI · Uvicorn · SQLAlchemy 2 · PostgreSQL · Pydantic v2 · Alembic

**Frontend:** React 18 · React Router · TanStack React Query · Axios · Recharts · Zustand · Tailwind CSS · Vite

**Infraestructura:** Backend en Render (Docker) · Frontend en Vercel · PostgreSQL en Render

## Estructura del proyecto

```
exd-dashboard/
├── backend/            # API FastAPI
│   ├── main.py         # App, routers y endpoints admin/dashboard
│   ├── models.py       # Modelos SQLAlchemy
│   ├── schemas.py      # Esquemas Pydantic
│   ├── database.py     # Engine y sesión
│   ├── config.py       # Configuración (pydantic-settings)
│   ├── routes/         # Routers: personas, asignaciones, proyectos,
│   │                   #          oportunidades, skill_matrix, skills
│   ├── init_db.py      # Inicialización de tablas
│   ├── seed_data.py    # Datos de ejemplo
│   └── requirements.txt
├── frontend/           # SPA React (Vite)
│   └── src/
│       ├── pages/      # Vistas de cada módulo
│       ├── components/ # Componentes reutilizables
│       ├── services/   # Cliente API (Axios)
│       └── utils/      # Constantes y helpers
├── docs/               # Documentación funcional y técnica
├── Dockerfile          # Imagen del backend
├── render.yaml         # Configuración de despliegue en Render
└── runtime.txt         # Versión de Python (3.11.10)
```

## Puesta en marcha (desarrollo)

### Requisitos previos

- Python 3.11
- Node.js 18+
- PostgreSQL

### 1. Configurar variables de entorno

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

```env
# Backend (FastAPI)
DATABASE_URL=postgresql://user:password@localhost:5432/exd_control
ENVIRONMENT=development
DEBUG=true
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend (Vite/React)
VITE_API_URL=http://localhost:8000
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Inicializar las tablas de la base de datos
python init_db.py
# (opcional) cargar datos de ejemplo
python seed_data.py

# Arrancar la API
uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000`. Documentación interactiva en `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Despliegue

- **Backend:** desplegado en Render como servicio web Docker (ver `Dockerfile` y `render.yaml`). Tras el primer despliegue, inicializar las tablas llamando una vez a `POST /api/admin/init-db`.
- **Frontend:** desplegado en Vercel (build con `npm run build`, ver `vercel.json`).

### Endpoints de administración

Endpoints idempotentes para inicialización y migraciones de esquema:

- `POST /api/admin/init-db` — crea las tablas de la base de datos.
- `POST /api/admin/migrate-skills-catalog` — genera el catálogo de skills a partir de las habilidades declaradas.
- `POST /api/admin/migrate-proyecto-types` — añade las columnas `tipo` y `estado` a proyectos.

## Documentación

Documentación detallada en la carpeta [`docs/`](./docs/):

- [Documentación funcional](./docs/funcional.md) — módulos y flujos de usuario.
- [Documentación técnica](./docs/tecnica.md) — arquitectura, modelos de datos, API y stack.
