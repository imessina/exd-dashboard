import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const baseURL = `${apiUrl.replace(/\/$/, "")}/api`;

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": import.meta.env.VITE_API_KEY || "",
  },
});

// Personas
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

// Asignaciones
export const asignacionesApi = {
  list: (params) => api.get("/asignaciones", { params }).then((r) => r.data),

  proximasLiberaciones: (dias = 14) =>
    api
      .get("/asignaciones/proximas-liberaciones", {
        params: { dias },
      })
      .then((r) => r.data),

  get: (id) => api.get(`/asignaciones/${id}`).then((r) => r.data),

  create: (data) => api.post("/asignaciones", data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/asignaciones/${id}`, data).then((r) => r.data),

  delete: (id) => api.delete(`/asignaciones/${id}`),
};

// Proyectos
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

// Oportunidades
export const oportunidadesApi = {
  list: (params) => api.get("/oportunidades", { params }).then((r) => r.data),

  get: (id) => api.get(`/oportunidades/${id}`).then((r) => r.data),

  create: (data) => api.post("/oportunidades", data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/oportunidades/${id}`, data).then((r) => r.data),

  delete: (id) => api.delete(`/oportunidades/${id}`),

  match: (id) => api.post(`/oportunidades/${id}/match`).then((r) => r.data),
};

// Skill Matrix
export const skillMatrixApi = {
  get: (params) => api.get("/skill-matrix", { params }).then((r) => r.data),

  gaps: () => api.get("/skill-matrix/gaps").then((r) => r.data),
};

// Skills / Capacidades
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
      .delete("/skills/categorias", {
        params: { nombre },
      })
      .then((r) => r.data),
};

// Currículums
export const curriculumsApi = {
  list: (params) => api.get("/curriculums/", { params }).then((r) => r.data),

  getByPersona: (personaId) =>
    api.get(`/curriculums/persona/${personaId}`).then((r) => r.data),

  updateByPersona: (personaId, data) =>
    api.put(`/curriculums/persona/${personaId}`, data).then((r) => r.data),

  downloadPdf: (personaId) =>
    api.get(`/curriculums/persona/${personaId}/pdf`, {
      responseType: "blob",
    }),

  downloadZip: (personaIds) =>
    api.post(
      "/curriculums/exportar-zip",
      {
        persona_ids: personaIds,
      },
      {
        responseType: "blob",
      },
    ),
};

// Ofertas de Valor
export const ofertasValorApi = {
  list: (params) => api.get("/ofertas-valor/", { params }).then((r) => r.data),

  get: (id) => api.get(`/ofertas-valor/${id}`).then((r) => r.data),

  create: (data) => api.post("/ofertas-valor/", data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/ofertas-valor/${id}`, data).then((r) => r.data),

  delete: (id) =>
    api.delete(`/ofertas-valor/${id}`).then((r) => r.data),
};

// Dashboard
export const dashboardApi = {
  summary: () => api.get("/dashboard/summary").then((r) => r.data),
};

// TalentIA
export const aiApi = {
  chatStream: async (
    message,
    { sessionId, onDelta, signal } = {},
  ) => {
    const response = await fetch(`${baseURL}/ai/chat`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-API-Key": import.meta.env.VITE_API_KEY || "",
      },

      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),

      signal,
    });

    if (!response.ok) {
      let detail = "No fue posible comunicarse con TalentIA.";

      try {
        const payload = await response.json();

        if (payload?.detail) {
          detail = payload.detail;
        }
      } catch {
        // Conserva el mensaje genérico.
      }

      throw new Error(detail);
    }

    if (!response.body) {
      throw new Error("El navegador no pudo iniciar el stream de TalentIA.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let fullText = "";
    let streamError = null;

    const processEvent = (rawEvent) => {
      const dataLines = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        return;
      }

      const data = dataLines.join("\n");

      if (!data || data === "[DONE]") {
        return;
      }

      let payload;

      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }

      if (payload.type === "delta") {
        const text = payload.text || "";

        if (!text) {
          return;
        }

        fullText += text;

        onDelta?.(text, fullText);

        return;
      }

      if (payload.type === "error") {
        streamError = new Error(
          payload.detail || "TalentIA respondió con un error.",
        );
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const events = buffer.split(/\r?\n\r?\n/);

        buffer = events.pop() ?? "";

        for (const event of events) {
          processEvent(event);

          if (streamError) {
            throw streamError;
          }
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processEvent(buffer);
      }

      if (streamError) {
        throw streamError;
      }

      return {
        response: fullText,
      };
    } finally {
      reader.releaseLock();
    }
  },
};

export default api;