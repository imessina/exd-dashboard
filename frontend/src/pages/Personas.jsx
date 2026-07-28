import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personasApi } from "../services/api";
import { NIVELES, NIVEL_COLOR } from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";
import TagInput from "../components/TagInput";
import SkillCheckboxes from "../components/SkillCheckboxes";

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const EMPTY = {
  nombre: "",
  rol: "",
  nivel_seniority: "Designer",
  anos_experiencia: "",
  habilidades: [],
  certificaciones: [],
  intereses: [],
  disponible_mentoria: false,
  portfolio_link: "",
};

// Gradient avatar colors based on name hash
const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
];
function avatarGradient(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

// ── Formulario ───────────────────────────────────────────────────────────────
function PersonaForm({ initial, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initial
      ? {
          nombre: initial.nombre ?? "",
          rol: initial.rol ?? "",
          nivel_seniority: initial.nivel_seniority ?? "Designer",
          anos_experiencia: initial.anos_experiencia ?? "",
          habilidades: initial.habilidades ?? [],
          certificaciones: initial.certificaciones ?? [],
          intereses: initial.intereses ?? [],
          disponible_mentoria: initial.disponible_mentoria ?? false,
          portfolio_link: initial.portfolio_link ?? "",
        }
      : { ...EMPTY },
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["personas"] });
    qc.invalidateQueries({ queryKey: ["skill-matrix"] });
    qc.invalidateQueries({ queryKey: ["skill-gaps"] });
    onClose();
  };

  const create = useMutation({
    mutationFn: personasApi.create,
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: (d) => personasApi.update(initial.id, d),
    onSuccess: done,
  });
  const busy = create.isPending || update.isPending;
  const err = create.error || update.error;

  const submit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      anos_experiencia:
        form.anos_experiencia !== "" ? Number(form.anos_experiencia) : null,
    };
    if (initial) update.mutate(data);
    else create.mutate({ ...data, id: slugify(form.nombre) });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Nombre *</label>
          <input
            required
            className="input"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Rol *</label>
          <input
            required
            className="input"
            value={form.rol}
            onChange={(e) => set("rol", e.target.value)}
            placeholder="ej: UX Designer"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Categoría</label>
          <select
            className="input"
            value={form.nivel_seniority}
            onChange={(e) => set("nivel_seniority", e.target.value)}
          >
            {NIVELES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Años de experiencia</label>
          <input
            type="number"
            min="0"
            className="input"
            value={form.anos_experiencia}
            onChange={(e) => set("anos_experiencia", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="form-label">Habilidades</label>
        <SkillCheckboxes
          value={form.habilidades}
          onChange={(v) => set("habilidades", v)}
        />
      </div>
      <div>
        <label className="form-label">Certificaciones</label>
        <TagInput
          value={form.certificaciones}
          onChange={(v) => set("certificaciones", v)}
          placeholder="ej: Google UX Certificate"
        />
      </div>
      <div>
        <label className="form-label">Intereses</label>
        <TagInput
          value={form.intereses}
          onChange={(v) => set("intereses", v)}
          placeholder="ej: Motion Design"
        />
      </div>
      <div>
        <label className="form-label">Portfolio</label>
        <input
          type="url"
          className="input"
          value={form.portfolio_link}
          onChange={(e) => set("portfolio_link", e.target.value)}
          placeholder="https://..."
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.disponible_mentoria}
          onChange={(e) => set("disponible_mentoria", e.target.checked)}
          className="rounded"
        />
        Disponible para mentoría
      </label>
      {err && <p className="text-xs text-red-500">Error: {err.message}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy
            ? "Guardando..."
            : initial
              ? "Guardar cambios"
              : "Crear persona"}
        </button>
      </div>
    </form>
  );
}

// ── Perfil completo ──────────────────────────────────────────────────────────
function PersonaPanel({ persona, onClose, onEdit }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const del = useMutation({
    mutationFn: () => personasApi.delete(persona.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["skill-matrix"] });
      onClose();
    },
  });

  return (
    <Panel title={persona.nombre} onClose={onClose}>
      <div className="space-y-5">
        {/* Header con avatar */}
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-lg font-bold shrink-0",
              avatarGradient(persona.nombre),
            )}
            style={{ boxShadow: "0 4px 14px rgba(28,159,228,0.30)" }}
          >
            {persona.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={clsx("badge", NIVEL_COLOR[persona.nivel_seniority])}
              >
                {persona.nivel_seniority}
              </span>
              {persona.anos_experiencia && (
                <span className="text-xs text-gray-400 font-medium">
                  {persona.anos_experiencia} años exp.
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{persona.rol}</p>
          </div>
        </div>

        {persona.habilidades?.length > 0 && (
          <div>
            <p className="form-label">Habilidades</p>
            <div className="flex flex-wrap gap-1.5">
              {persona.habilidades.map((h) => (
                <span key={h} className="badge bg-brand-50 text-brand-600">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.certificaciones?.length > 0 && (
          <div>
            <p className="form-label">Certificaciones</p>
            <div className="flex flex-wrap gap-1.5">
              {persona.certificaciones.map((c) => (
                <span key={c} className="badge bg-amber-50 text-amber-700">
                  🏆 {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.intereses?.length > 0 && (
          <div>
            <p className="form-label">Intereses</p>
            <div className="flex flex-wrap gap-1.5">
              {persona.intereses.map((i) => (
                <span key={i} className="badge bg-purple-50 text-purple-700">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.portfolio_link && (
          <a
            href={persona.portfolio_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-brand-600 hover:text-brand-800 hover:underline block font-medium"
          >
            🔗 Ver portfolio
          </a>
        )}

        {persona.disponible_mentoria && (
          <p className="text-xs text-emerald-600 font-semibold">
            ✓ Disponible para mentoría
          </p>
        )}

        {persona.evaluacion_ultima &&
          typeof persona.evaluacion_ultima === "object" && (
            <div>
              <p className="form-label">Última evaluación</p>
              <div
                className="rounded-xl overflow-hidden text-xs"
                style={{ border: "1px solid rgba(28,159,228,0.12)" }}
              >
                {Object.entries(persona.evaluacion_ultima).map(
                  ([k, v], idx) => {
                    const isNull = v === null || v === undefined;
                    const isScoreMap = !isNull && typeof v === "object";

                    return (
                      <div
                        key={k}
                        className={idx % 2 === 0 ? "bg-white" : undefined}
                        style={
                          idx % 2 !== 0
                            ? { background: "rgba(28,159,228,0.04)" }
                            : {}
                        }
                      >
                        {/* Fila principal */}
                        <div className="flex items-start justify-between gap-3 px-3.5 py-2">
                          <span className="text-gray-400 capitalize shrink-0 w-28">
                            {k}
                          </span>
                          {isNull ? (
                            <span className="text-gray-300 font-medium">—</span>
                          ) : isScoreMap ? (
                            <span className="text-brand-500 font-semibold text-right">
                              {Object.keys(v).length} scores →
                            </span>
                          ) : (
                            <span className="font-semibold text-gray-700 text-right">
                              {String(v)}
                            </span>
                          )}
                        </div>

                        {/* Sub-tabla de scores si el valor es un mapa de habilidades */}
                        {isScoreMap && (
                          <div
                            className="mx-3 mb-2 rounded-lg overflow-hidden"
                            style={{
                              border: "1px solid rgba(28,159,228,0.10)",
                            }}
                          >
                            {Object.entries(v).map(([skill, score], si) => {
                              const numScore =
                                typeof score === "number"
                                  ? score
                                  : parseFloat(score);
                              const maxScore = 5;
                              const pct = isNaN(numScore)
                                ? 0
                                : Math.round((numScore / maxScore) * 100);
                              return (
                                <div
                                  key={skill}
                                  className="flex items-center gap-3 px-3 py-1.5"
                                  style={
                                    si % 2 === 0
                                      ? { background: "rgba(28,159,228,0.03)" }
                                      : {}
                                  }
                                >
                                  <span
                                    className="text-gray-500 flex-1 truncate"
                                    title={skill}
                                  >
                                    {skill}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-16 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          background:
                                            "linear-gradient(90deg, #127cba, #1c9fe4)",
                                        }}
                                      />
                                    </div>
                                    <span className="font-bold text-gray-700 w-8 text-right tabular-nums">
                                      {isNaN(numScore)
                                        ? String(score)
                                        : numScore}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">
                ¿Eliminar permanentemente?
              </span>
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-xs text-red-600 font-semibold hover:underline"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-600 font-medium"
            >
              Eliminar persona
            </button>
          )}
          <button onClick={onEdit} className="btn-primary !text-xs !py-1.5">
            ✏️ Editar
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function PersonaCard({ persona, onClick }) {
  const skills = persona.habilidades ?? [];
  return (
    <button
      className="card text-left cursor-pointer w-full h-full flex flex-col hover:-translate-y-1 hover:shadow-lg group"
      onClick={onClick}
    >
      {/* Identidad: avatar + nombre + rol (nombre con espacio propio, sin competir con la categoría) */}
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-base font-bold shrink-0",
            avatarGradient(persona.nombre),
          )}
          style={{ boxShadow: "0 3px 10px rgba(28,159,228,0.25)" }}
        >
          {persona.nombre.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-[15px] leading-snug break-words">
            {persona.nombre}
          </p>
          {persona.rol && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {persona.rol}
            </p>
          )}
        </div>
      </div>

      {/* Categoría: fila propia, claramente legible */}
      <div className="mt-3">
        <span
          className={clsx(
            "badge",
            NIVEL_COLOR[persona.nivel_seniority] ?? "bg-gray-100 text-gray-600",
          )}
        >
          {persona.nivel_seniority}
        </span>
      </div>

      {/* Skills: con etiqueta para escanear rápido */}
      {skills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((h) => (
              <span key={h} className="badge bg-brand-50 text-brand-500">
                {h}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="badge bg-gray-100 text-gray-500">
                +{skills.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pie: mentoría, anclado abajo para alinear las cards de una fila */}
      {persona.disponible_mentoria && (
        <p className="text-xs text-emerald-600 font-semibold mt-auto pt-3 flex items-center gap-1">
          <span aria-hidden>✓</span> Disponible para mentoría
        </p>
      )}
    </button>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Personas() {
  const [search, setSearch] = useState("");
  const [nivelFilter, setNivelFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const filtered = personas.filter((p) => {
    const q = search.toLowerCase();
    return (
      (!search ||
        p.nombre.toLowerCase().includes(q) ||
        p.rol.toLowerCase().includes(q)) &&
      (!nivelFilter || p.nivel_seniority === nivelFilter)
    );
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Equipo ExD
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">
            {personas.length} personas
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          + Nueva persona
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o rol..."
          className="input max-w-xs"
        />
        <select
          value={nivelFilter}
          onChange={(e) => setNivelFilter(e.target.value)}
          className="input w-44"
        >
          <option value="">Todas las categorías</option>
          {NIVELES.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              onClick={() => setSelected(p)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 col-span-full py-8 text-center">
              Sin resultados.
            </p>
          )}
        </div>
      )}

      {selected && !editing && (
        <PersonaPanel
          persona={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
      )}

      {(creating || editing) && (
        <Panel
          title={editing ? `Editar — ${editing.nombre}` : "Nueva persona"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <PersonaForm
            initial={editing ?? null}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </Panel>
      )}
    </div>
  );
}
