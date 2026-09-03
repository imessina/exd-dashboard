import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { skillMatrixApi } from "../services/api";
import { OFERTAS_VALOR } from "../utils/constants";
import clsx from "clsx";

const TODAS_TAB = "__todas__";
const HUERFANAS_TAB = "__huerfanas__";

function normalizarBusqueda(valor = "") {
  return String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function coincidePorTerminos(valor = "", busqueda = "") {
  const terminos = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);

  if (terminos.length === 0) return true;

  const contenido = normalizarBusqueda(valor);
  return terminos.every((termino) => contenido.includes(termino));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TABLA HEATMAP — personas × skills
// ═══════════════════════════════════════════════════════════════════════════════
function HeatmapTable({ skills, personaSearch = "" }) {
  const [hoveredSkillId, setHoveredSkillId] = useState(null);
  const personaIdToData = {};

  for (const skill of skills) {
    for (const persona of skill.personas ?? []) {
      personaIdToData[persona.persona_id] = persona;
    }
  }

  const personasOrdenadas = Object.values(personaIdToData)
    .filter((persona) => coincidePorTerminos(persona.nombre, personaSearch))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (personasOrdenadas.length === 0 || skills.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Sin datos para esta vista.
      </p>
    );
  }

  const nivelesPorPersonaSkill = {};

  for (const skill of skills) {
    for (const persona of skill.personas ?? []) {
      nivelesPorPersonaSkill[`${persona.persona_id}:${skill.skill_id}`] =
        persona.nivel;
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-300 overflow-auto max-h-[calc(100dvh-330px)]">
      <table className="text-sm min-w-max w-full">
        <thead>
          <tr className="border-b border-slate-300 bg-white">
            <th
              className="text-left text-xs font-semibold text-gray-600 py-3 px-4 sticky top-0 left-0 z-30 bg-white border-r border-slate-300 shadow-[0_1px_0_rgba(203,213,225,1)]"
              style={{ minWidth: 210 }}
            >
              Persona
            </th>

            {skills.map((skill) => (
              <th
                key={skill.skill_id}
                onMouseEnter={() => setHoveredSkillId(skill.skill_id)}
                onMouseLeave={() => setHoveredSkillId(null)}
                className={clsx(
                  "sticky top-0 z-20 text-center text-xs font-semibold text-gray-600 py-3 px-2 border-r border-slate-200 transition-colors shadow-[0_1px_0_rgba(203,213,225,1)]",
                  hoveredSkillId === skill.skill_id
                    ? "bg-slate-100"
                    : "bg-white",
                )}
                style={{ minWidth: 105, maxWidth: 135 }}
                title={skill.nombre}
              >
                <span className="block leading-tight">{skill.nombre}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {personasOrdenadas.map((persona) => (
            <tr
              key={persona.persona_id}
              className="group border-b border-slate-200 last:border-0 hover:bg-slate-100/90 transition-colors"
            >
              <td className="py-2.5 px-4 sticky left-0 z-10 bg-white border-r border-slate-300 group-hover:bg-slate-100/90 transition-colors">
                <p className="font-medium text-gray-900 text-xs">
                  {persona.nombre}
                </p>

                <p className="text-gray-400 text-xs">
                  {persona.nivel_piramide ??
                    persona.nivel_seniority ??
                    persona.rol ??
                    "—"}
                </p>
              </td>

              {skills.map((skill) => {
                const nivel =
                  nivelesPorPersonaSkill[
                    `${persona.persona_id}:${skill.skill_id}`
                  ];

                const nivelLabel = {
                  1: "Básico",
                  2: "Intermedio",
                  3: "Avanzado",
                  4: "Especialista",
                  5: "Referente",
                }[nivel];

                const nivelColor = {
                  1: "bg-slate-100 text-slate-800 border-slate-400",
                  2: "bg-blue-50 text-blue-900 border-blue-400",
                  3: "bg-blue-100 text-blue-950 border-blue-500",
                  4: "bg-teal-50 text-teal-950 border-teal-500",
                  5: "bg-slate-800 text-white border-slate-800",
                }[nivel];

                return (
                  <td
                    key={skill.skill_id}
                    onMouseEnter={() => setHoveredSkillId(skill.skill_id)}
                    onMouseLeave={() => setHoveredSkillId(null)}
                    className={clsx(
                      "py-2 px-1 text-center border-r border-slate-200 transition-colors",
                      hoveredSkillId === skill.skill_id && "bg-slate-100",
                    )}
                  >
                    {nivel ? (
                      <div
                        className={clsx(
                          "mx-auto w-8 h-8 rounded-md border-2 shadow-sm flex items-center justify-center text-xs font-bold",
                          nivelColor,
                        )}
                        title={`${persona.nombre} · ${skill.nombre} · Nivel ${nivel} (${nivelLabel})`}
                      >
                        {nivel}
                      </div>
                    ) : (
                      <div className="mx-auto w-8 h-8" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TABLA DE SKILLS HUÉRFANAS
// ═══════════════════════════════════════════════════════════════════════════════
function HuerfanasTable({ huerfanas }) {
  if (huerfanas.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        No hay capacidades huérfanas.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-amber-50/70">
          <tr className="border-b border-amber-100 text-left">
            <th className="px-4 py-3 text-xs font-semibold text-amber-900">
              Capacidad
            </th>

            <th className="px-4 py-3 text-xs font-semibold text-amber-900">
              Personas
            </th>

            <th className="px-4 py-3 text-xs font-semibold text-amber-900 text-center">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {huerfanas.map((skill) => (
            <tr
              key={skill.nombre}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="px-4 py-3 font-semibold text-gray-900">
                {skill.nombre}
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {(skill.personas ?? []).map((persona) => (
                    <span
                      key={persona.persona_id}
                      className="badge bg-slate-100 text-slate-700"
                    >
                      {persona.nombre}
                    </span>
                  ))}
                </div>
              </td>

              <td className="px-4 py-3 text-center font-bold text-amber-800">
                {skill.personas?.length ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PÁGINA
// ═══════════════════════════════════════════════════════════════════════════════
export default function SkillMatrix() {
  const navigate = useNavigate();

  const [tab, setTab] = useState(TODAS_TAB);
  const [personaSearch, setPersonaSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [ofertaFilter, setOfertaFilter] = useState("");

  const ofertasVisibles = useMemo(
    () => OFERTAS_VALOR.filter((oferta) => oferta !== "Todas"),
    [],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["skill-matrix", ofertaFilter],
    queryFn: () =>
      skillMatrixApi.get(
        ofertaFilter ? { oferta_valor: ofertaFilter } : undefined,
      ),
  });

  useEffect(() => {
    if (!data) return;

    const tabsDisponibles = [
      TODAS_TAB,
      ...(data.categorias_orden ?? []),
      HUERFANAS_TAB,
    ];

    if (!tabsDisponibles.includes(tab)) {
      setTab(TODAS_TAB);
    }
  }, [data, tab]);

  const todasLasSkills = useMemo(() => {
    if (!data) return [];

    const unicas = new Map();

    for (const categoria of data.categorias_orden ?? []) {
      for (const skill of data.data?.[categoria]?.skills ?? []) {
        unicas.set(skill.skill_id, skill);
      }
    }

    return Array.from(unicas.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [data]);

  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400 text-center">Cargando…</p>;
  }

  if (!data) {
    return <p className="p-6 text-sm text-gray-400 text-center">Sin datos.</p>;
  }

  const categorias = data.categorias_orden ?? [];
  const huerfanasCount = data.huerfanas?.length ?? 0;
  const isHuerfanas = tab === HUERFANAS_TAB;
  const filtroSkill = skillSearch.trim();

  const filtrarSkills = (skills = []) =>
    skills.filter((skill) => coincidePorTerminos(skill.nombre, filtroSkill));

  let skillsToShow = [];
  let huerfanasToShow = [];

  if (isHuerfanas) {
    huerfanasToShow = filtrarSkills(data.huerfanas ?? []).map((skill) => ({
      ...skill,
      personas: (skill.personas ?? []).filter((persona) =>
        coincidePorTerminos(persona.nombre, personaSearch),
      ),
    }));
  } else if (tab === TODAS_TAB) {
    skillsToShow = filtrarSkills(todasLasSkills);
  } else {
    skillsToShow = filtrarSkills(data.data?.[tab]?.skills ?? []);
  }

  return (
    <div className="w-full space-y-8 pb-8 pt-0">
      {/* Header */}
      <div className="relative min-h-[170px] overflow-hidden text-white">
        <img
          src="/banner-personas.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center" }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,18,40,0.90) 0%, rgba(6,18,40,0.72) 27%, rgba(6,18,40,0.32) 53%, rgba(6,18,40,0.08) 78%, rgba(6,18,40,0.02) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-[170px] items-center justify-between gap-4 px-8 py-6 flex-wrap">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
              Somos DX
            </p>

            <h2 className="text-2xl font-bold tracking-tight">Capacidades</h2>

            <p className="text-sm text-white/70 mt-1 font-medium">
              Matriz de capacidades y niveles del equipo organizada por
              categorías.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/skills")}
              className="btn-primary"
            >
              Mantenedor capacidades
            </button>

            <div className="flex flex-wrap gap-3 text-xs">
              <Stat
                label="Capacidades"
                value={data.total_skills_catalogo}
                dark
              />

              <Stat label="Personas" value={data.total_personas} dark />

              {huerfanasCount > 0 && (
                <Stat
                  label="Sin asignar"
                  value={huerfanasCount}
                  tone="warn"
                  dark
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Ofertas de valor visibles */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max gap-1">
            <OfferTab
              label="Todas las ofertas"
              active={ofertaFilter === ""}
              onClick={() => setOfertaFilter("")}
            />

            {ofertasVisibles.map((oferta) => (
              <OfferTab
                key={oferta}
                label={oferta}
                active={ofertaFilter === oferta}
                onClick={() => setOfertaFilter(oferta)}
              />
            ))}
          </div>
        </div>

        {/* Filtros de categoría y búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-5xl">
          <div>
            <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Categoría
            </label>

            <select
              value={tab}
              onChange={(event) => setTab(event.target.value)}
              className="input text-sm w-full"
            >
              <option value={TODAS_TAB}>Ver todas</option>

              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}

              {huerfanasCount > 0 && (
                <option value={HUERFANAS_TAB}>Huérfanas</option>
              )}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Buscar persona
            </label>

            <input
              value={personaSearch}
              onChange={(event) => setPersonaSearch(event.target.value)}
              placeholder="Ej: Busca por nombre o apellido"
              className="input text-sm w-full"
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Buscar capacidad
            </label>

            <input
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="Ej: AWS, Bedrock o Backend"
              className="input text-sm w-full"
            />
          </div>

          {!isHuerfanas && (
            <p className="md:col-span-3 text-xs text-gray-400">
              {skillsToShow.length}{" "}
              {skillsToShow.length === 1 ? "capacidad" : "capacidades"} en la
              tabla
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-slate-500 mr-1">Nivel:</span>

          {[
            [1, "Básico", "bg-slate-100 text-slate-700 border-slate-200"],
            [2, "Intermedio", "bg-blue-50 text-blue-800 border-blue-200"],
            [3, "Avanzado", "bg-blue-100 text-blue-900 border-blue-300"],
            [4, "Especialista", "bg-teal-50 text-teal-900 border-teal-300"],
            [5, "Referente", "bg-slate-800 text-white border-slate-800"],
          ].map(([nivel, label, style]) => (
            <span
              key={nivel}
              className={clsx(
                "rounded-md border px-2 py-1 font-semibold",
                style,
              )}
            >
              {nivel} · {label}
            </span>
          ))}

          <span className="text-slate-400 ml-1">Vacío = sin evaluar</span>
        </div>

        {/* Solo tablas */}
        {isHuerfanas ? (
          <HuerfanasTable huerfanas={huerfanasToShow} />
        ) : skillsToShow.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">
            {skillSearch.trim()
              ? "Sin resultados para la búsqueda de capacidades."
              : "Esta categoría no tiene capacidades disponibles."}
          </p>
        ) : (
          <HeatmapTable
            skills={skillsToShow.filter((skill) => skill.personas?.length > 0)}
            personaSearch={personaSearch}
          />
        )}
      </div>
    </div>
  );
}

function OfferTab({ label, active, warning = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center",
        active
          ? warning
            ? "border-amber-600 text-amber-800"
            : "border-brand-500 text-brand-700"
          : warning
            ? "border-transparent text-amber-700 hover:text-amber-900"
            : "border-transparent text-gray-500 hover:text-gray-700",
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, tone = "normal", dark = false }) {
  return (
    <div
      className={clsx(
        "rounded-lg px-3 py-1.5 border",
        tone === "warn"
          ? "bg-amber-50 border-amber-200"
          : dark
            ? "bg-white/10 border-white/15"
            : "bg-white border-gray-200",
      )}
    >
      <p
        className={clsx(
          "text-base font-bold leading-none",
          tone === "warn"
            ? "text-amber-700"
            : dark
              ? "text-white"
              : "text-gray-900",
        )}
      >
        {value}
      </p>

      <p
        className={clsx(
          "text-[10px] uppercase tracking-wider mt-0.5",
          dark && tone !== "warn" ? "text-white/60" : "text-gray-500",
        )}
      >
        {label}
      </p>
    </div>
  );
}
