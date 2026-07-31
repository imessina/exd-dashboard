import axios from "axios";

// Use hardcoded backend URL for production
//const baseURL = 'https://exd-dashboard.onrender.com/api'
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const baseURL = `${apiUrl.replace(/\/$/, "")}/api`;

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    // La API exige esta key (auth.py del backend). Se define como VITE_API_KEY
    // en Vercel (y en .env.local para desarrollo). Nota: cualquier key en un
    // bundle de frontend es visible para quien abra la app; frena el acceso
    // anónimo por URL, no sustituye a un login real.
    "X-API-Key": import.meta.env.VITE_API_KEY || "",
  },
});

// ── Personas ────────────────────────────────────────────────────────────────
export const personasApi = {
  list: (params) => api.get("/personas", { params }).then((r) => r.data),
  get: (id) => api.get(`/personas/${id}`).then((r) => r.data),
  create: (data) => api.post("/personas", data).then((r) => r.data),
  update: (id, data) => api.put(`/personas/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/personas/${id}`),
  skills: (id) => api.get(`/personas/${id}/skills`).then((r) => r.data),
  replaceSkills: (id, skills) =>
    api.put(`/personas/${id}/skills`, { skills }).then((r) => r.data),
};

// ── Asignaciones ─────────────────────────────────────────────────────────────
export const asignacionesApi = {
  list: (params) => api.get("/asignaciones", { params }).then((r) => r.data),
  proximasLiberaciones: (dias = 14) =>
    api
      .get("/asignaciones/proximas-liberaciones", { params: { dias } })
      .then((r) => r.data),
  get: (id) => api.get(`/asignaciones/${id}`).then((r) => r.data),
  create: (data) => api.post("/asignaciones", data).then((r) => r.data),
  update: (id, data) =>
    api.put(`/asignaciones/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/asignaciones/${id}`),
};

// ── Proyectos ────────────────────────────────────────────────────────────────
export const proyectosApi = {
  list: (params) => api.get("/proyectos", { params }).then((r) => r.data),
  get: (id) => api.get(`/proyectos/${id}`).then((r) => r.data),
  create: (data) => api.post("/proyectos", data).then((r) => r.data),
  update: (id, data) => api.put(`/proyectos/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/proyectos/${id}`),
  hitos: (id) => api.get(`/proyectos/${id}/hitos`).then((r) => r.data),
  updateHito: (id, hitoId, data) =>
    api.patch(`/proyectos/${id}/hitos/${hitoId}`, data).then((r) => r.data),
};

// ── Oportunidades ────────────────────────────────────────────────────────────
export const oportunidadesApi = {
  list: (params) => api.get("/oportunidades", { params }).then((r) => r.data),
  get: (id) => api.get(`/oportunidades/${id}`).then((r) => r.data),
  create: (data) => api.post("/oportunidades", data).then((r) => r.data),
  update: (id, data) =>
    api.put(`/oportunidades/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/oportunidades/${id}`),
  match: (id) => api.post(`/oportunidades/${id}/match`).then((r) => r.data),
};

// ── Skill Matrix ─────────────────────────────────────────────────────────────
export const skillMatrixApi = {
  get: (params) => api.get("/skill-matrix", { params }).then((r) => r.data),
  gaps: () => api.get("/skill-matrix/gaps").then((r) => r.data),
};

// ── Skills (catálogo) ────────────────────────────────────────────────────────
export const skillsApi = {
  list: () => api.get("/skills/").then((r) => r.data),
  categorias: () => api.get("/skills/categorias").then((r) => r.data),
  create: (data) => api.post("/skills/", data).then((r) => r.data),
  update: (id, data) => api.put(`/skills/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/skills/${id}`),
  renameCategoria: (data) =>
    api.put("/skills/categorias", data).then((r) => r.data),
  deleteCategoria: (nombre) =>
    api
      .delete("/skills/categorias", { params: { nombre } })
      .then((r) => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get("/dashboard/summary").then((r) => r.data),
};

export default api;
