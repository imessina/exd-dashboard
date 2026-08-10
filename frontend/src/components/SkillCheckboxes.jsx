import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { skillsApi } from "../services/api";
import clsx from "clsx";

const SIN_CATEGORIA = "— Sin categoría —";

const CAT_COLOR = {
  "Cloud & DevOps": "text-blue-700",
  "Data & Analytics": "text-cyan-700",
  "Delivery & Producto": "text-amber-700",
  Desarrollo: "text-emerald-700",
  "IA & GenAI": "text-fuchsia-700",
  "Marketing & Creative": "text-rose-900",
  "Spatial Computing": "text-violet-900",
  "UX / CX": "text-violet-700",
};

const CAT_BG = {
  "Cloud & DevOps": "bg-blue-50",
  "Data & Analytics": "bg-cyan-50",
  "Delivery & Producto": "bg-amber-50",
  Desarrollo: "bg-emerald-50",
  "IA & GenAI": "bg-fuchsia-50",
  "Marketing & Creative": "bg-rose-50",
  "Spatial Computing": "bg-violet-50",
  "UX / CX": "bg-violet-50",
};

const CATEGORIAS_ORDEN = [
  "Cloud & DevOps",
  "Data & Analytics",
  "Delivery & Producto",
  "Desarrollo",
  "IA & GenAI",
  "Marketing & Creative",
  "UX / CX",
];

function ordenarCategorias(categorias) {
  return [...categorias].sort((a, b) => {
    if (a === SIN_CATEGORIA) return 1;
    if (b === SIN_CATEGORIA) return -1;

    const aIndex = CATEGORIAS_ORDEN.indexOf(a);
    const bIndex = CATEGORIAS_ORDEN.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    return a.localeCompare(b);
  });
}

export default function SkillCheckboxes({ value = [], onChange }) {
  const [search, setSearch] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: skillsApi.list,
  });

  const seleccionadas = useMemo(() => new Set(value), [value]);

  const skillsActivas = useMemo(
    () => skills.filter((skill) => skill.activa),
    [skills],
  );

  const grupos = useMemo(() => {
    const agrupadas = {};

    for (const skill of skillsActivas) {
      const categoria = skill.categoria || SIN_CATEGORIA;

      if (!agrupadas[categoria]) agrupadas[categoria] = [];
      agrupadas[categoria].push(skill);
    }

    for (const categoria of Object.keys(agrupadas)) {
      agrupadas[categoria].sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      );
    }

    return ordenarCategorias(Object.keys(agrupadas)).map((categoria) => ({
      categoria,
      skills: agrupadas[categoria],
    }));
  }, [skillsActivas]);

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

  const toggleSkill = (nombre) => {
    if (seleccionadas.has(nombre)) {
      onChange(value.filter((skill) => skill !== nombre));
    } else {
      onChange([...value, nombre]);
    }
  };

  const toggleCategoria = (categoria) => {
    setCategoriaAbierta((actual) =>
      actual === categoria ? null : categoria,
    );
  };

  if (isLoading) {
    return (
      <p className="text-xs text-gray-400 py-3">
        Cargando catálogo de capacidades...
      </p>
    );
  }

  if (skillsActivas.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500">
          No hay capacidades activas en el catálogo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Botón principal único */}
      <button
        type="button"
        onClick={() => {
          setMenuAbierto((actual) => !actual);
          if (menuAbierto) setCategoriaAbierta(null);
        }}
        className={clsx(
          "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
          menuAbierto
            ? "border-brand-200 bg-brand-50"
            : "border-gray-200 bg-white hover:bg-gray-50",
        )}
        aria-expanded={menuAbierto}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={clsx(
              "w-4 h-4 text-gray-400 transition-transform shrink-0",
              menuAbierto && "rotate-90",
            )}
            aria-hidden="true"
          >
            <path
              d="m7.5 5 5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              Categorías de capacidades
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {value.length} seleccionada{value.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {value.length > 0 && (
          <span className="inline-flex min-w-7 h-7 px-2 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold shrink-0">
            {value.length}
          </span>
        )}
      </button>

      {/* Contenido desplegable principal */}
      {menuAbierto && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar una capacidad..."
              className="input text-sm flex-1 min-w-48"
            />

            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold text-gray-400 hover:text-red-600"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {gruposFiltrados.map(({ categoria, skills: skillsCategoria }) => {
              const abierta =
                filtro.length > 0 || categoriaAbierta === categoria;

              const cantidadSeleccionadas = skillsCategoria.filter((skill) =>
                seleccionadas.has(skill.nombre),
              ).length;

              return (
                <div
                  key={categoria}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategoria(categoria)}
                    className={clsx(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                      abierta
                        ? CAT_BG[categoria] || "bg-gray-50"
                        : "bg-white hover:bg-gray-50",
                    )}
                    aria-expanded={abierta}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className={clsx(
                          "w-4 h-4 shrink-0 text-gray-400 transition-transform",
                          abierta && "rotate-90",
                        )}
                        aria-hidden="true"
                      >
                        <path
                          d="m7.5 5 5 5-5 5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <span
                        className={clsx(
                          "text-xs font-bold uppercase tracking-wider truncate",
                          CAT_COLOR[categoria] || "text-gray-700",
                        )}
                      >
                        {categoria}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">
                        {cantidadSeleccionadas}/{skillsCategoria.length}
                      </span>

                      {cantidadSeleccionadas > 0 && (
                        <span className="inline-flex min-w-6 h-6 px-1.5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                          {cantidadSeleccionadas}
                        </span>
                      )}
                    </div>
                  </button>

                  {abierta && (
                    <div className="px-4 py-3 bg-white border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {skillsCategoria.map((skill) => {
                          const checked = seleccionadas.has(skill.nombre);

                          return (
                            <label
                              key={skill.id}
                              className={clsx(
                                "flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
                                checked
                                  ? "bg-brand-50"
                                  : "hover:bg-gray-50",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSkill(skill.nombre)}
                                className="w-4 h-4 accent-brand-500 shrink-0"
                              />

                              <span
                                className={clsx(
                                  "text-xs",
                                  checked
                                    ? "font-semibold text-brand-700"
                                    : "text-gray-700",
                                )}
                              >
                                {skill.nombre}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {gruposFiltrados.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                No hay capacidades que coincidan con la búsqueda.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
