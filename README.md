# ExD Control Center

Panel de gestión operativa para el equipo **Experience Design (ExD)** de NTT DATA. Centraliza la información del equipo, las asignaciones, los proyectos activos, las oportunidades comerciales, las capacidades técnicas y los currículums profesionales, con el objetivo de apoyar decisiones sobre staffing, disponibilidad, desarrollo y presentación de perfiles.

La aplicación es de uso interno. En su versión actual no requiere autenticación de usuarios.

## Módulos

- **Dashboard** (`/`) — Resumen ejecutivo con KPIs en tiempo real: personas, asignaciones activas, liberaciones próximas, proyectos activos, pipeline abierto y proyectos en riesgo.
- **Asignaciones** (`/asignaciones`) — Gestión de asignaciones de personas a proyectos, incluyendo dedicación, fechas, estado y próximas liberaciones.
- **Equipo / Personas** (`/personas`) — Registro del equipo, seniority, rol, experiencia, habilidades y datos profesionales.
- **Proyectos** (`/proyectos`) — Administración de proyectos activos, distinguiendo _Fixed Scope_ de _Time & Materials_, junto con su estado y health.
- **Oportunidades** (`/oportunidades`) — Pipeline comercial y seguimiento de oportunidades.
- **Skill Matrix** (`/skill-matrix`) — Matriz de capacidades basada en el catálogo de skills y evaluaciones reales de las personas.
- **Skills** (`/skills`) — Catálogo de habilidades con creación, edición, eliminación y categorización.
- **Currículums** (`/curriculums`) — Mantenedor de CV profesionales integrado con personas y skills.
- **Carrera** y **Pirámide** — Vistas para desarrollo profesional y estructura del equipo.

## Módulo de currículums

El módulo de currículums permite administrar los perfiles profesionales del equipo desde una única vista.

### Funcionalidades principales

- Visualización de todas las personas registradas, incluso cuando todavía no tienen CV.
- Estados:
  - **Sin CV**
  - **Requiere revisión**
  - **Actualizado**
- Búsqueda por nombre, rol, área, número de empleado, skill o herramienta.
- Filtro por estado del CV.
- Edición de resumen profesional, áreas de especialización, herramientas, clientes, estudios, idiomas, certificaciones y hasta tres experiencias seleccionadas.
- Reutilización de skills desde `persona_skills`.
- Creación automática de registros vacíos para personas que aún no tienen currículum.
- Cambio automático a estado **Actualizado** al guardar.
- Mensaje de confirmación después de guardar cambios.
- Generación de PDF individual.
- Descarga múltiple de currículums en un archivo ZIP.
- Normalización Unicode para mostrar correctamente tildes, eñes y caracteres especiales en los PDF.

### Endpoints principales

```text
GET    /api/curriculums/
GET    /api/curriculums/persona/{persona_id}
POST   /api/curriculums/
PUT    /api/curriculums/persona/{persona_id}
GET    /api/curriculums/persona/{persona_id}/pdf
POST   /api/curriculums/exportar-zip
```

Ejemplo de descarga múltiple:

```json
{
  "persona_ids": ["emp-123", "emp-456"]
}
```

## Stack tecnológico

**Backend:** Python 3.11 · FastAPI · Uvicorn · SQLAlchemy 2 · PostgreSQL · Pydantic v2 · Alembic · Psycopg2 · ReportLab

**Frontend:** React 18 · React Router · TanStack React Query · Axios · Recharts · Zustand · Tailwind CSS · Vite

**Datos e infraestructura:** PostgreSQL / Supabase · Backend preparado para Docker · Frontend preparado para Vercel

## Estructura del proyecto

```text
exd-dashboard/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── config.py
│   ├── init_db.py
│   ├── seed_data.py
│   ├── importar_curriculums.py
│   ├── importar_skills_excel.py
│   ├── routes/
│   │   ├── personas.py
│   │   ├── asignaciones.py
│   │   ├── proyectos.py
│   │   ├── oportunidades.py
│   │   ├── skill_matrix.py
│   │   ├── skills.py
│   │   └── curriculums.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── curriculum_pdf.py
│   ├── data/
│   │   ├── curriculums_carga_inicial.json
│   │   └── skills_evaluaciones.json
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       ├── components/
│       ├── services/
│       │   └── api.js
│       └── utils/
├── docs/
├── Dockerfile
├── render.yaml
├── vercel.json
└── runtime.txt
```

## Puesta en marcha en desarrollo

### Requisitos previos

- Python 3.11
- Node.js 18 o superior
- PostgreSQL o proyecto Supabase
- Git

### 1. Variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Ejemplo:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/exd_control
ENVIRONMENT=development
DEBUG=true
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
VITE_API_URL=http://localhost:8000
```

No se deben versionar archivos `.env` ni credenciales.

### 2. Backend

```bash
cd backend
python -m venv .venv
```

En Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

En Linux o macOS:

```bash
source .venv/bin/activate
```

Instala las dependencias:

```bash
python -m pip install -r requirements.txt
```

Inicializa las tablas:

```bash
python init_db.py
```

Opcionalmente, carga datos de ejemplo:

```bash
python seed_data.py
```

Levanta la API:

```bash
python -m uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000` y la documentación interactiva en `http://localhost:8000/docs`.

### 3. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Importación de datos

### Currículums

```bash
cd backend
python importar_curriculums.py
```

Fuente de carga:

```text
backend/data/curriculums_carga_inicial.json
```

### Skills

```bash
cd backend
python importar_skills_excel.py
```

Los scripts deben ejecutarse con el entorno virtual activo y con `DATABASE_URL` configurada.

## Generación de PDF

La generación de documentos se realiza con ReportLab.

Instalación manual, si fuera necesario:

```bash
python -m pip install reportlab
```

Los PDF incluyen nombre, rol, número de empleado, área, resumen profesional, áreas de especialización, experiencias, skills, herramientas, clientes, estudios, idiomas y certificaciones.

## Despliegue

### Backend

El backend puede desplegarse como servicio web mediante Docker.

Archivos relevantes:

```text
Dockerfile
render.yaml
runtime.txt
```

Después del primer despliegue, se pueden inicializar tablas mediante:

```text
POST /api/admin/init-db
```

### Frontend

El frontend puede desplegarse en Vercel.

```bash
npm run build
```

Configuración principal:

```text
vercel.json
```

## Endpoints de administración

- `POST /api/admin/init-db` — Crea las tablas requeridas.
- `POST /api/admin/migrate-skills-catalog` — Genera o actualiza el catálogo de skills.
- `POST /api/admin/migrate-proyecto-types` — Añade o actualiza los campos de tipo y estado de proyectos.

## Flujo de ramas recomendado

- `develop` — Desarrollo e integración.
- `main` — Versión estable.

```bash
git checkout develop
git pull origin develop
git add .
git commit -m "feat: descripción del cambio"
git push origin develop

git checkout main
git pull origin main
git merge develop
git push origin main
```

En entornos colaborativos se recomienda integrar mediante Pull Request.

## Documentación

Documentación complementaria en [`docs/`](./docs/):

- [Documentación funcional](./docs/funcional.md)
- [Documentación técnica](./docs/tecnica.md)

## Estado actual

La aplicación incluye:

- gestión de personas;
- asignaciones;
- proyectos;
- oportunidades;
- catálogo y matriz de skills;
- currículums editables;
- incorporación de personas sin CV;
- filtro por estado;
- PDF individual;
- descarga múltiple en ZIP;
- carga inicial de currículums y skills.
