// "Categoría" del diseñador (antes 'seniority'). Orden ascendente = jerarquía.
export const NIVELES = [
  "Junior Designer",
  "Designer",
  "Lead Designer",
  "Expert Designer",
  "Chief Designer",
  "Manager",
];

export const COMPETENCIAS = [
  "UX Research",
  "UI Design",
  "Product Design",
  "Service Design",
  "Design Systems",
];

export const FASES_PROYECTO = [
  "discovery",
  "design",
  "testing",
  "launch",
  "evolution",
];

export const FASES_LABEL = {
  discovery: "Discovery",
  design: "Design",
  testing: "Testing",
  launch: "Launch",
  evolution: "Evolution",
};

// Tipo de engagement: proyecto cerrado (fixed scope) vs T&M (capacidad)
export const TIPO_PROYECTO = ["fixed_scope", "time_materials"];

export const TIPO_LABEL = {
  fixed_scope: "Proyecto",
  time_materials: "Time & Materials",
};

export const TIPO_COLOR = {
  fixed_scope: "bg-brand-100 text-brand-700",
  time_materials: "bg-cyan-100 text-cyan-700",
};

// Estado operativo (aplica a ambos tipos)
export const ESTADOS_PROYECTO = [
  "pre_sales",
  "active",
  "paused",
  "completed",
  "cancelled",
];

export const ESTADO_LABEL = {
  pre_sales: "Pre-venta",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const ESTADO_COLOR = {
  pre_sales: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

export const OPORTUNIDAD_STATUS = [
  "opportunity",
  "approved",
  "bidding",
  "signed",
  "executing",
];

export const OPORTUNIDAD_STATUS_LABEL = {
  opportunity: "Oportunidad",
  approved: "Aprobada",
  bidding: "En Licitación",
  signed: "Firmada",
  executing: "En Ejecución",
};

export const HEALTH_COLOR = {
  on_track: "bg-emerald-100 text-emerald-700",
  at_risk: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
};

export const HEALTH_LABEL = {
  on_track: "En curso",
  at_risk: "En riesgo",
  blocked: "Bloqueado",
};

export const NIVEL_COLOR = {
  "Junior Designer": "bg-gray-100 text-gray-600",
  Designer: "bg-sky-100 text-sky-700",
  "Lead Designer": "bg-brand-100 text-brand-600",
  "Expert Designer": "bg-brand-200 text-brand-700",
  "Chief Designer": "bg-pink-100 text-pink-700",
  Manager: "bg-slate-200 text-slate-700",
};

// Heatmap skill: score 0-5 → bg color (escala de brand)
export const SKILL_COLORS = [
  "bg-gray-100", // 0 — sin skill
  "bg-brand-100", // 1 — Junior Designer
  "bg-brand-200", // 2 — Designer
  "bg-brand-300", // 3 — Lead Designer
  "bg-brand-500", // 4 — Expert Designer
  "bg-brand-700", // 5 — Chief Designer
];
