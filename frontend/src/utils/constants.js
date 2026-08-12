// Segmentos de talento.
// El orden representa la jerarquía desde el nivel superior al inferior.
export const NIVELES_PIRAMIDE = [
  "Executive",
  "Top manager",
  "Top Leader",
  "Top Expert Leader",
  "Expert Lead",
  "Lead",
  "Key Contributor",
  "Contributor",
];


// Fallback temporal. La fuente oficial es /api/ofertas-valor/.
// "Todas" NO es una oferta de valor; es solo una opción de filtro.
export const OFERTAS_VALOR = [
  "Conversational AI & VoiceBot",
  "Experience Design & Research",
  "Experience Optimization & Martech",
  "Creative Design",
  "X-Reality",
  "Digital Experiences Platforms",
  "Mobile Platforms",
];

export const OFERTA_SIN_ASIGNAR = "__sin_asignar__";

// Alias temporal para componentes que todavía importan NIVELES.
export const NIVELES = NIVELES_PIRAMIDE;

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

// Tipo de engagement:
// proyecto cerrado (fixed scope) o capacidad (time & materials).
export const TIPO_PROYECTO = ["fixed_scope", "time_materials"];

export const TIPO_LABEL = {
  fixed_scope: "Proyecto",
  time_materials: "Time & Materials",
};

export const TIPO_COLOR = {
  fixed_scope: "bg-brand-100 text-brand-700",
  time_materials: "bg-cyan-100 text-cyan-700",
};

// Estados operativos de proyectos.
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
  bidding: "En licitación",
  signed: "Firmada",
  executing: "En ejecución",
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

// Colores utilizados para los segmentos de talento
// en Equipo, Pirámide y otros componentes.
export const NIVEL_COLOR = {
  Executive: "bg-slate-900 text-white",

  "Top manager": "bg-slate-700 text-white",

  "Top Leader": "bg-blue-950 text-blue-100",

  "Top Expert Leader": "bg-amber-100 text-amber-900 border border-amber-300/70",

  "Expert Lead": "bg-blue-800 text-blue-100",

  Lead: "bg-teal-800 text-teal-100",

  "Key Contributor": "bg-slate-200 text-slate-800",

  Contributor: "bg-gray-100 text-gray-600 border border-gray-200",
};

// Heatmap de capacidades.
// Puntaje de 0 a 5.
export const SKILL_COLORS = [
  "bg-gray-100", // 0 — sin capacidad
  "bg-brand-100", // 1
  "bg-brand-200", // 2
  "bg-brand-300", // 3
  "bg-brand-500", // 4
  "bg-brand-700", // 5
];
