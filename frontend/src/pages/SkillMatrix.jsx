import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { skillMatrixApi } from "../services/api";
import clsx from "clsx";

const TODAS_TAB = "__todas__";
const HUERFANAS_TAB = "__huerfanas__";

// ═══════════════════════════════════════════════════════════════════════════════
//  TABLA HEATMAP — personas × skills
// ═══════════════════════════════════════════════════════════════════════════════
function HeatmapTable({ skills }) {
  const personaIdToData = {};

  for (const skill of skills) {
    for (const persona of skill.personas ?? []) {
      personaIdToData[persona.persona_id] = persona;
    }
  }

  const personasOrdenadas = Object.values(personaIdToData).sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );

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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
      <table className="text-sm min-w-max w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-white">
            <th
              className="text-left text-xs font-semibold text-gray-500 py-3 px-4 sticky left-0 z-20 bg-white border-r border-gray-100"
              style={{ minWidth: 210 }}
            >
              Persona
            </th>

            {skills.map((skill) => (
              <th
                key={skill.skill_id}
                className="text-center text-xs font-semibold text-gray-500 py-3 px-2"
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
              className="border-b border-gray-50 last:border-0 hover:bg-slate-50/70"
            >
              <td className="py-2.5 px-4 sticky left-0 z-10 bg-white border-r border-gray-100">
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
                  1: "bg-slate-100 text-slate-700 border-slate-200",
                  2: "bg-blue-50 text-blue-800 border-blue-200",
                  3: "bg-blue-100 text-blue-900 border-blue-300",
                  4: "bg-teal-50 text-teal-900 border-teal-300",
                  5: "bg-slate-800 text-white border-slate-800",
                }[nivel];

                return (
                  <td key={skill.skill_id} className="py-2 px-1 text-center">
                    {nivel ? (
                      <div
                        className={clsx(
                          "mx-auto w-8 h-8 rounded-md border flex items-center justify-center text-xs font-bold",
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
        No hay skills huérfanas.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-amber-50/70">
          <tr className="border-b border-amber-100 text-left">
            <th className="px-4 py-3 text-xs font-semibold text-amber-900">
              Skill
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
  const [tab, setTab] = useState(TODAS_TAB);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["skill-matrix"],
    queryFn: () => skillMatrixApi.get(),
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
    return (
      <p className="p-6 text-sm text-gray-400 text-center">
        Cargando…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="p-6 text-sm text-gray-400 text-center">
        Sin datos.
      </p>
    );
  }

  const categorias = data.categorias_orden ?? [];
  const huerfanasCount = data.huerfanas?.length ?? 0;
  const isHuerfanas = tab === HUERFANAS_TAB;
  const filtroTexto = search.trim().toLowerCase();

  const matchesSearch = (skill) => {
    if (!filtroTexto) return true;

    if (skill.nombre.toLowerCase().includes(filtroTexto)) {
      return true;
    }

    return (skill.personas ?? []).some((persona) =>
      persona.nombre.toLowerCase().includes(filtroTexto),
    );
  };

  let skillsToShow = [];
  let huerfanasToShow = [];

  if (isHuerfanas) {
    huerfanasToShow = (data.huerfanas ?? []).filter(matchesSearch);
  } else if (tab === TODAS_TAB) {
    skillsToShow = todasLasSkills.filter(matchesSearch);
  } else {
    skillsToShow = (data.data?.[tab]?.skills ?? []).filter(matchesSearch);
  }

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
      {/* Header */}
      <div
        className="p-8 text-white flex items-start justify-between gap-4 flex-wrap"
        style={{
          background:
            "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
            Somos DX
          </p>

          <h2 className="text-2xl font-bold tracking-tight">
            Skill Matrix
          </h2>

          <p className="text-sm text-white/60 mt-1 font-medium">
            Inventario de habilidades del equipo organizado por categorías.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <Stat
            label="Skills"
            value={data.total_skills_catalogo}
            dark
          />
          <Stat
            label="Personas"
            value={data.total_personas}
            dark
          />
          <Stat
            label="Sin nadie"
            value={data.skills_sin_personas}
            tone={data.skills_sin_personas > 0 ? "warn" : "normal"}
            dark
          />
          {huerfanasCount > 0 && (
            <Stat
              label="Huérfanas"
              value={huerfanasCount}
              tone="warn"
              dark
            />
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Tabs por categoría */}
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          <CategoryTab
            label="Ver todas"
            count={todasLasSkills.length}
            active={tab === TODAS_TAB}
            onClick={() => setTab(TODAS_TAB)}
          />

          {categorias.map((categoria) => {
            const skillCount =
              data.data?.[categoria]?.skills?.length ?? 0;

            return (
              <CategoryTab
                key={categoria}
                label={categoria}
                count={skillCount}
                active={tab === categoria}
                onClick={() => setTab(categoria)}
              />
            );
          })}

          {huerfanasCount > 0 && (
            <CategoryTab
              label="Huérfanas"
              count={huerfanasCount}
              active={isHuerfanas}
              warning
              onClick={() => setTab(HUERFANAS_TAB)}
            />
          )}
        </div>

        {/* Búsqueda */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar skill o persona…"
            className="input text-sm max-w-72"
          />

          {!isHuerfanas && (
            <p className="text-xs text-gray-400">
              {skillsToShow.length} skill
              {skillsToShow.length !== 1 ? "s" : ""} en la tabla
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
            <span key={nivel} className={clsx("rounded-md border px-2 py-1 font-semibold", style)}>
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
            {filtroTexto
              ? "Sin resultados para esta búsqueda."
              : "Esta categoría no tiene skills disponibles."}
          </p>
        ) : (
          <HeatmapTable
            skills={skillsToShow.filter(
              (skill) => skill.personas?.length > 0,
            )}
          />
        )}
      </div>
    </div>
  );
}

function CategoryTab({
  label,
  count,
  active,
  warning = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-2",
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

      <span
        className={clsx(
          "text-xs px-1.5 py-0.5 rounded-full",
          active
            ? warning
              ? "bg-amber-100 text-amber-800"
              : "bg-brand-100 text-brand-700"
            : "bg-gray-100 text-gray-500",
        )}
      >
        {count}
      </span>
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
          dark && tone !== "warn"
            ? "text-white/60"
            : "text-gray-500",
        )}
      >
        {label}
      </p>
    </div>
  );
}
