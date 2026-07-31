import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { skillsApi } from "../services/api";
import clsx from "clsx";

const SIN_CATEGORIA = "— Sin categoría —";

const CATEGORIAS_ORDEN = [
  "Cloud & DevOps",
  "Data & Analytics",
  "Delivery & Producto",
  "Desarrollo",
  "IA & GenAI",
  "Idioma",
  "Marketing & Creative",
  "Spatial Computing",
  "UX / CX",
];

const NIVEL_LABEL = {
  1: "Básico",
  2: "Intermedio",
  3: "Avanzado",
  4: "Especialista",
  5: "Referente",
};

const NIVEL_STYLE = {
  1: "bg-slate-100 text-slate-700 border-slate-200",
  2: "bg-blue-50 text-blue-800 border-blue-200",
  3: "bg-blue-100 text-blue-900 border-blue-300",
  4: "bg-teal-50 text-teal-900 border-teal-300",
  5: "bg-slate-800 text-white border-slate-800",
};

function ordenarCategorias(categorias) {
  return [...categorias].sort((a, b) => {
    if (a === SIN_CATEGORIA) return 1;
    if (b === SIN_CATEGORIA) return -1;
    const ai = CATEGORIAS_ORDEN.indexOf(a);
    const bi = CATEGORIAS_ORDEN.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export default function SkillLevelSelector({ value = [], onChange }) {
  const [search, setSearch] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: skillsApi.list,
  });

  const seleccionadas = useMemo(
    () => new Map(value.map((item) => [item.skill_id, item])),
    [value],
  );

  const grupos = useMemo(() => {
    const agrupadas = {};
    for (const skill of skills.filter((item) => item.activa)) {
      const categoria = skill.categoria || SIN_CATEGORIA;
      if (!agrupadas[categoria]) agrupadas[categoria] = [];
      agrupadas[categoria].push(skill);
    }
    for (const categoria of Object.keys(agrupadas)) {
      agrupadas[categoria].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return ordenarCategorias(Object.keys(agrupadas)).map((categoria) => ({
      categoria,
      skills: agrupadas[categoria],
    }));
  }, [skills]);

  const filtro = search.trim().toLowerCase();
  const gruposFiltrados = useMemo(() => {
    if (!filtro) return grupos;
    return grupos
      .map((grupo) => ({
        ...grupo,
        skills: grupo.skills.filter((skill) =>
          skill.nombre.toLowerCase().includes(filtro),
        ),
      }))
      .filter((grupo) => grupo.skills.length > 0);
  }, [grupos, filtro]);

  const agregar = (skill) => {
    if (seleccionadas.has(skill.id)) return;
    onChange([
      ...value,
      {
        skill_id: skill.id,
        nombre: skill.nombre,
        categoria: skill.categoria,
        nivel: 1,
      },
    ]);
  };

  const eliminar = (skillId) => {
    onChange(value.filter((item) => item.skill_id !== skillId));
  };

  const cambiarNivel = (skillId, nivel) => {
    onChange(
      value.map((item) =>
        item.skill_id === skillId ? { ...item, nivel: Number(nivel) } : item,
      ),
    );
  };

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-3">Cargando catálogo…</p>;
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="space-y-2">
          {value
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((item) => (
              <div
                key={item.skill_id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {item.nombre}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.categoria || SIN_CATEGORIA}
                  </p>
                </div>

                <select
                  value={item.nivel}
                  onChange={(event) =>
                    cambiarNivel(item.skill_id, event.target.value)
                  }
                  className={clsx(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none",
                    NIVEL_STYLE[item.nivel],
                  )}
                  aria-label={`Nivel de ${item.nombre}`}
                >
                  {Object.entries(NIVEL_LABEL).map(([nivel, label]) => (
                    <option key={nivel} value={nivel}>
                      {nivel} · {label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => eliminar(item.skill_id)}
                  className="text-slate-400 hover:text-red-600 text-lg leading-none"
                  title="Quitar skill"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setMenuAbierto((actual) => !actual)}
        className={clsx(
          "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
          menuAbierto
            ? "border-slate-400 bg-slate-50"
            : "border-slate-200 bg-white hover:bg-slate-50",
        )}
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">
            + Agregar skill y evaluar
          </p>
          <p className="text-[11px] text-slate-400">
            Selecciona una skill y luego define su nivel del 1 al 5.
          </p>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {value.length}
        </span>
      </button>

      {menuAbierto && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar una skill…"
              className="input text-sm"
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {gruposFiltrados.map((grupo) => {
              const abierta = categoriaAbierta === grupo.categoria || Boolean(filtro);
              const disponibles = grupo.skills.filter(
                (skill) => !seleccionadas.has(skill.id),
              );

              return (
                <div key={grupo.categoria} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() =>
                      setCategoriaAbierta((actual) =>
                        actual === grupo.categoria ? null : grupo.categoria,
                      )
                    }
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      {grupo.categoria}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {disponibles.length} disponibles
                    </span>
                  </button>

                  {abierta && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3">
                      {grupo.skills.map((skill) => {
                        const selected = seleccionadas.has(skill.id);
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            disabled={selected}
                            onClick={() => agregar(skill)}
                            className={clsx(
                              "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                              selected
                                ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                            )}
                          >
                            {selected ? "✓ " : "+ "}{skill.nombre}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {Object.entries(NIVEL_LABEL).map(([nivel, label]) => (
          <div
            key={nivel}
            className={clsx(
              "rounded-lg border px-2 py-1.5 text-center",
              NIVEL_STYLE[nivel],
            )}
          >
            <p className="text-xs font-bold">{nivel}</p>
            <p className="text-[9px] leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
