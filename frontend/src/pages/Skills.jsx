import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skillsApi } from "../services/api";
import Panel from "../components/Panel";
import clsx from "clsx";
import {
  SIN_CATEGORIA,
  ordenarCategorias,
  skillCategoryBadge,
} from "../utils/skillCategories";

// ── Form (crear/editar) ────────────────────────────────────────────────────
function SkillForm({ initial, onClose, categoriasExistentes }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initial
      ? {
          nombre: initial.nombre ?? "",
          categoria: initial.categoria ?? "",
          descripcion: initial.descripcion ?? "",
          activa: initial.activa ?? true,
        }
      : {
          nombre: "",
          categoria: "",
          descripcion: "",
          activa: true,
        },
  );
  const [creandoCat, setCreandoCat] = useState(false);
  const [nuevaCat, setNuevaCat] = useState("");

  // Mostrar únicamente categorías que actualmente tienen skills en la BD.
  const categorias = useMemo(
    () => ordenarCategorias(categoriasExistentes ?? []),
    [categoriasExistentes],
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["skills"] });
    qc.invalidateQueries({ queryKey: ["skills-categorias"] });
    qc.invalidateQueries({ queryKey: ["personas"] }); // por si el rename propaga
    onClose();
  };

  const create = useMutation({ mutationFn: skillsApi.create, onSuccess: done });
  const update = useMutation({
    mutationFn: (d) => skillsApi.update(initial.id, d),
    onSuccess: done,
  });
  const busy = create.isPending || update.isPending;
  const err = create.error || update.error;

  const submit = (e) => {
    e.preventDefault();
    const data = { ...form, categoria: form.categoria || null };
    if (initial) update.mutate(data);
    else create.mutate(data);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Nombre *</label>
        <input
          required
          className="input"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder="ej: UX Research"
        />
      </div>

      <div>
        <label className="form-label">Categoría</label>
        {creandoCat ? (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              autoFocus
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (nuevaCat.trim()) {
                    set("categoria", nuevaCat.trim());
                    setCreandoCat(false);
                    setNuevaCat("");
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                if (nuevaCat.trim()) {
                  set("categoria", nuevaCat.trim());
                  setCreandoCat(false);
                  setNuevaCat("");
                }
              }}
            >
              OK
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                setCreandoCat(false);
                setNuevaCat("");
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
            >
              <option value="">{SIN_CATEGORIA}</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary text-xs whitespace-nowrap"
              onClick={() => setCreandoCat(true)}
            >
              + Nueva
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="form-label">Descripción</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          placeholder="Opcional. Aclara qué cubre esta skill."
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.activa}
          onChange={(e) => set("activa", e.target.checked)}
          className="w-4 h-4 accent-brand-500"
        />
        <span className="text-sm text-gray-700">Activa</span>
        <span className="text-xs text-gray-400">
          (las inactivas no aparecen en el formulario de personas)
        </span>
      </label>

      {err && (
        <p className="text-xs text-red-500">
          Error: {err.response?.data?.detail || err.message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Guardando..." : initial ? "Guardar cambios" : "Crear skill"}
        </button>
      </div>
    </form>
  );
}

// ── Gestor de categorías (renombrar / fusionar / eliminar) ───────────────────
function CategoriaManager({ skills, onClose }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(null); // categoría en edición
  const [valor, setValor] = useState("");
  const [borrando, setBorrando] = useState(null);

  // Conteo de skills por categoría (solo categorías reales, no "sin categoría")
  const cats = useMemo(() => {
    const counts = {};
    for (const s of skills) {
      if (s.categoria) counts[s.categoria] = (counts[s.categoria] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [skills]);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["skills"] });
    qc.invalidateQueries({ queryKey: ["skills-categorias"] });
  };

  const rename = useMutation({
    mutationFn: ({ actual, nuevo }) =>
      skillsApi.renameCategoria({ actual, nuevo }),
    onSuccess: () => {
      refrescar();
      setEditando(null);
      setValor("");
    },
  });
  const remove = useMutation({
    mutationFn: (nombre) => skillsApi.deleteCategoria(nombre),
    onSuccess: () => {
      refrescar();
      setBorrando(null);
    },
  });

  const nombresExistentes = cats.map(([c]) => c);
  const esFusion =
    editando &&
    valor.trim() &&
    valor.trim() !== editando &&
    nombresExistentes.includes(valor.trim());

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Renombrar propaga el cambio a todas las skills de la categoría. Si el
        nombre nuevo ya existe, las categorías se <strong>fusionan</strong>.
        Eliminar deja esas skills sin categoría.
      </p>

      {cats.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          No hay categorías asignadas todavía.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {cats.map(([cat, count]) => (
            <div key={cat} className="px-4 py-3">
              {editando === cat ? (
                <div className="space-y-2">
                  <input
                    className="input w-full"
                    autoFocus
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && valor.trim())
                        rename.mutate({ actual: cat, nuevo: valor.trim() });
                    }}
                  />
                  {esFusion && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Ya existe «{valor.trim()}» — se fusionarán.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-xs"
                      disabled={!valor.trim() || rename.isPending}
                      onClick={() =>
                        rename.mutate({ actual: cat, nuevo: valor.trim() })
                      }
                    >
                      {rename.isPending
                        ? "Guardando…"
                        : esFusion
                          ? "Fusionar"
                          : "Renombrar"}
                    </button>
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setEditando(null);
                        setValor("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : borrando === cat ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-red-600">
                    ¿Eliminar «{cat}»? Sus {count} skill{count !== 1 ? "s" : ""}{" "}
                    quedarán sin categoría.
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="text-xs text-red-600 font-semibold hover:underline"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(cat)}
                    >
                      Sí
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:underline"
                      onClick={() => setBorrando(null)}
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className={clsx("badge text-xs", skillCategoryBadge(cat))}
                  >
                    {cat}
                  </span>
                  <span className="text-xs text-gray-400 flex-1">
                    {count} skill{count !== 1 ? "s" : ""}
                  </span>
                  <button
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                    onClick={() => {
                      setEditando(cat);
                      setValor(cat);
                      setBorrando(null);
                    }}
                  >
                    ✏️ Renombrar
                  </button>
                  <button
                    className="text-xs text-red-400 hover:text-red-600"
                    onClick={() => {
                      setBorrando(cat);
                      setEditando(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(rename.error || remove.error) && (
        <p className="text-xs text-red-500">
          Error:{" "}
          {(rename.error || remove.error).response?.data?.detail ||
            (rename.error || remove.error).message}
        </p>
      )}

      <div className="flex justify-end pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
export default function Skills() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managingCats, setManagingCats] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState([]);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: skillsApi.list,
  });
  const { data: categoriasExistentes = [] } = useQuery({
    queryKey: ["skills-categorias"],
    queryFn: skillsApi.categorias,
  });

  const del = useMutation({
    mutationFn: (id) => skillsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      setConfirmingDelete(null);
    },
  });

  // Filtrado
  const filtered = skills.filter((s) => {
    if (search && !s.nombre.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filtroCat === "__sin__" && s.categoria) return false;
    if (filtroCat && filtroCat !== "__sin__" && s.categoria !== filtroCat)
      return false;
    return true;
  });

  // Agrupar por categoría
  const byCategoria = useMemo(() => {
    const grupos = {};
    for (const s of filtered) {
      const cat = s.categoria ?? SIN_CATEGORIA;
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(s);
    }
    // Orden definido para el nuevo catálogo; solo se consideran grupos existentes.
    const sortedKeys = ordenarCategorias(Object.keys(grupos));
    return sortedKeys.map((k) => [k, grupos[k]]);
  }, [filtered]);

  const totalSinCat = skills.filter((s) => !s.categoria).length;

  const toggleCategoria = (categoria) => {
    setCategoriasAbiertas((actual) =>
      actual.includes(categoria)
        ? actual.filter((item) => item !== categoria)
        : [...actual, categoria],
    );
  };

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
      {/* Header */}
      <div
        className="p-8 text-white flex items-center justify-between gap-4"
        style={{
          background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <div>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
            Somos DX
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            Catálogo de Skills
          </h2>
          <p className="text-sm text-white/60 mt-1 font-medium">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
            {totalSinCat > 0 && ` · ${totalSinCat} sin categoría`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManagingCats(true)}
            className="btn-secondary"
          >
            ⚙️ Gestionar categorías
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            + Nueva skill
          </button>
        </div>
      </div>

      <div className="px-8">
        {/* Filtros */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skill…"
            className="input text-sm max-w-64"
          />
          <select
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
            className="input text-sm max-w-56"
          >
            <option value="">Todas las categorías</option>
            {ordenarCategorias(categoriasExistentes).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {totalSinCat > 0 && (
              <option value="__sin__">{SIN_CATEGORIA}</option>
            )}
          </select>
        </div>

        {/* Categorías en cards desplegables */}
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando…</p>
        ) : skills.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-500 mb-3">
              El catálogo está vacío.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="btn-primary text-sm"
            >
              + Crear primera skill
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Sin resultados con esos filtros.
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {byCategoria.map(([cat, items]) => {
              const abierta =
                filtroCat !== "" ||
                search.trim() !== "" ||
                categoriasAbiertas.includes(cat);

              const activas = items.filter((skill) => skill.activa).length;
              const asignaciones = items.reduce(
                (total, skill) => total + (skill.personas_count ?? 0),
                0,
              );

              return (
                <div
                  key={cat}
                  className={clsx(
                    "bg-white rounded-2xl border overflow-hidden transition-shadow",
                    abierta
                      ? "border-slate-300 shadow-sm"
                      : "border-gray-200 hover:shadow-md",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
                    aria-expanded={abierta}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className={clsx(
                          "w-4 h-4 text-gray-400 shrink-0 transition-transform",
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

                      <div className="min-w-0">
                        <span
                          className={clsx(
                            "badge text-xs",
                            skillCategoryBadge(cat),
                          )}
                        >
                          {cat}
                        </span>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {activas} activas · {asignaciones} asignación
                          {asignaciones !== 1 ? "es" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {items.length}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">
                        skills
                      </p>
                    </div>
                  </button>

                  {abierta && (
                    <div className="border-t border-slate-200 bg-slate-50/40 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {items.map((s) => (
                          <div
                            key={s.id}
                            className={clsx(
                              "rounded-xl border bg-white px-3.5 py-3 flex items-center gap-3 min-w-0",
                              "border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all",
                              !s.activa && "opacity-60",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <p
                                  className={clsx(
                                    "text-sm font-semibold truncate",
                                    s.activa
                                      ? "text-slate-900"
                                      : "text-slate-400",
                                  )}
                                  title={s.nombre}
                                >
                                  {s.nombre}
                                </p>

                                {!s.activa && (
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Inactiva
                                  </span>
                                )}
                              </div>

                              {s.descripcion && (
                                <p
                                  className="mt-1 text-xs text-slate-500 truncate"
                                  title={s.descripcion}
                                >
                                  {s.descripcion}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={clsx(
                                  "text-xs font-semibold whitespace-nowrap",
                                  s.personas_count > 0
                                    ? "text-slate-500"
                                    : "text-amber-700",
                                )}
                              >
                                {s.personas_count}
                              </span>

                              {confirmingDelete === s.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => del.mutate(s.id)}
                                    className="text-xs font-semibold text-red-600 hover:underline"
                                  >
                                    Sí
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(null)}
                                    className="text-xs text-slate-500 hover:underline"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditing(s)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                    aria-label={`Editar ${s.nombre}`}
                                    title="Editar skill"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(s.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Eliminar ${s.nombre}`}
                                    title="Eliminar skill"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error de borrado */}
        {del.error && (
          <div className="fixed bottom-6 right-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-md shadow-lg">
            <p className="text-sm text-red-700 font-semibold">
              No se pudo borrar
            </p>
            <p className="text-xs text-red-600 mt-1">
              {del.error.response?.data?.detail || del.error.message}
            </p>
          </div>
        )}

        {creating && (
          <Panel title="Nueva skill" onClose={() => setCreating(false)}>
            <SkillForm
              onClose={() => setCreating(false)}
              categoriasExistentes={categoriasExistentes}
            />
          </Panel>
        )}
        {editing && (
          <Panel
            title={`Editar — ${editing.nombre}`}
            onClose={() => setEditing(null)}
          >
            <SkillForm
              initial={editing}
              onClose={() => setEditing(null)}
              categoriasExistentes={categoriasExistentes}
            />
          </Panel>
        )}
        {managingCats && (
          <Panel
            title="Gestionar categorías"
            onClose={() => setManagingCats(false)}
          >
            <CategoriaManager
              skills={skills}
              onClose={() => setManagingCats(false)}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
