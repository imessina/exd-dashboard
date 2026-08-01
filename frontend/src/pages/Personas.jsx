import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personasApi, asignacionesApi } from "../services/api";
import { NIVELES_PIRAMIDE, NIVEL_COLOR } from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";
import TagInput from "../components/TagInput";
import SkillLevelSelector from "../components/SkillLevelSelector";

const CATEGORIAS_NIVEL = NIVELES_PIRAMIDE;

const ESTADOS_LABORALES = ["Disponible", "Staffing", "Inactivo"];
const ESTADOS_VISIBLES = ["Disponible", "En proyecto", "Staffing", "Inactivo"];

const ESTADO_LABORAL_COLOR = {
  Disponible: "bg-teal-50 text-teal-800 border border-teal-200",
  "En proyecto": "bg-slate-800 text-white border border-slate-800",
  Staffing: "bg-amber-50 text-amber-900 border border-amber-200",
  Inactivo: "bg-gray-100 text-gray-600 border border-gray-300",
};

function normalizarTexto(valor = "") {
  return String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function fechaLocalISO() {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset() * 60 * 1000;
  return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);
}

function esAsignacionVigente(asignacion) {
  if (asignacion.estado !== "active") return false;

  const hoy = fechaLocalISO();
  const inicio = asignacion.fecha_inicio;
  const liberacion = asignacion.fecha_liberacion;

  return (!inicio || inicio <= hoy) && (!liberacion || liberacion >= hoy);
}

function obtenerEstadoVisible(persona, personasEnProyecto) {
  if (personasEnProyecto.has(persona.id)) return "En proyecto";

  if (persona.estado_laboral === "Staffing") return "Staffing";
  if (persona.estado_laboral === "Inactivo") return "Inactivo";

  return "Disponible";
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [year, month, day] = String(fecha).split("-");
  return year && month && day ? `${day}/${month}/${year}` : fecha;
}

const EMPTY = {
  nombre: "",
  rol: "",
  numero_empleado: "",
  fecha_ingreso_compania: "",
  fecha_nacimiento: "",
  nivel_piramide: "Professional",
  estado_laboral: "Disponible",
  anos_experiencia: "",
  habilidades: [],
  skillLevels: [],
  certificaciones: [],
  intereses: [],
  disponible_mentoria: false,
  portfolio_link: "",
};

// Gradient avatar colors based on name hash
const AVATAR_GRADIENTS = [
  "from-slate-700 to-slate-950",
  "from-blue-800 to-slate-950",
  "from-slate-600 to-blue-900",
  "from-teal-700 to-slate-900",
  "from-amber-700 to-slate-900",
  "from-cyan-800 to-slate-950",
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
          numero_empleado: initial.numero_empleado ?? "",
          fecha_ingreso_compania: initial.fecha_ingreso_compania ?? "",
          fecha_nacimiento: initial.fecha_nacimiento ?? "",
          nivel_piramide: initial.nivel_piramide ?? "Professional",
          estado_laboral: initial.estado_laboral ?? "Disponible",
          anos_experiencia: initial.anos_experiencia ?? "",
          habilidades: initial.habilidades ?? [],
          skillLevels: [],
          certificaciones: initial.certificaciones ?? [],
          intereses: initial.intereses ?? [],
          disponible_mentoria: initial.disponible_mentoria ?? false,
          portfolio_link: initial.portfolio_link ?? "",
        }
      : { ...EMPTY },
  );

  const { data: nivelesIniciales = [], isLoading: cargandoNiveles } = useQuery({
    queryKey: ["persona-skills", initial?.id],
    queryFn: () => personasApi.skills(initial.id),
    enabled: Boolean(initial?.id),
  });

  useEffect(() => {
    if (initial?.id) {
      setForm((actual) => ({ ...actual, skillLevels: nivelesIniciales }));
    }
  }, [initial?.id, nivelesIniciales]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["personas"] });
    qc.invalidateQueries({ queryKey: ["skill-matrix"] });
    qc.invalidateQueries({ queryKey: ["skill-gaps"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: async () => {
      const { skillLevels, ...personFields } = form;
      const data = {
        ...personFields,
        habilidades: skillLevels.map((item) => item.nombre),
        anos_experiencia:
          form.anos_experiencia !== "" ? Number(form.anos_experiencia) : null,
      };

      const numeroEmpleado = String(form.numero_empleado ?? "").trim();

      if (!initial && !numeroEmpleado) {
        throw new Error("El número de empleado es obligatorio.");
      }

      const persona = initial
        ? await personasApi.update(initial.id, data)
        : await personasApi.create({
            ...data,
            id: `emp-${numeroEmpleado}`,
          });

      await personasApi.replaceSkills(
        persona.id,
        skillLevels.map((item) => ({
          skill_id: item.skill_id,
          nivel: Number(item.nivel),
        })),
      );

      return persona;
    },
    onSuccess: done,
  });

  const busy = save.isPending;
  const err = save.error;

  const submit = (event) => {
    event.preventDefault();
    save.mutate();
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="form-label">N° de empleado {!initial && "*"}</label>
          <input
            required={!initial}
            inputMode="numeric"
            pattern="[0-9]+"
            className="input"
            value={form.numero_empleado}
            onChange={(e) =>
              set("numero_empleado", e.target.value.replace(/\D/g, ""))
            }
            placeholder="ej: 284356"
          />
        </div>
        <div>
          <label className="form-label">Fecha de ingreso</label>
          <input
            type="date"
            className="input"
            value={form.fecha_ingreso_compania}
            onChange={(e) => set("fecha_ingreso_compania", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Fecha de nacimiento</label>
          <input
            type="date"
            className="input"
            value={form.fecha_nacimiento}
            onChange={(e) => set("fecha_nacimiento", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="form-label">Nivel de pirámide</label>
          <select
            className="input"
            value={form.nivel_piramide}
            onChange={(e) => set("nivel_piramide", e.target.value)}
          >
            {NIVELES_PIRAMIDE.map((n) => (
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
        <div>
          <label className="form-label">Disponibilidad manual</label>
          <select
            className="input"
            value={form.estado_laboral}
            onChange={(e) => set("estado_laboral", e.target.value)}
          >
            {ESTADOS_LABORALES.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-400">
            “En proyecto” se calcula automáticamente según las asignaciones
            activas.
          </p>
        </div>
      </div>
      <div>
        <label className="form-label">Habilidades</label>
        {cargandoNiveles ? (
          <p className="text-xs text-gray-400 py-3">Cargando evaluaciones…</p>
        ) : (
          <SkillLevelSelector
            value={form.skillLevels}
            onChange={(value) => set("skillLevels", value)}
          />
        )}
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
function PersonaPanel({ persona, estadoVisible, onClose, onEdit }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const { data: skillsEvaluadas = [] } = useQuery({
    queryKey: ["persona-skills", persona.id],
    queryFn: () => personasApi.skills(persona.id),
  });

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
            style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.20)" }}
          >
            {persona.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={clsx("badge", NIVEL_COLOR[persona.nivel_piramide])}
              >
                {persona.nivel_piramide ?? "Sin clasificar"}
              </span>
              <span
                className={clsx(
                  "badge",
                  ESTADO_LABORAL_COLOR[estadoVisible] ??
                    "bg-slate-100 text-slate-700 border border-slate-200",
                )}
              >
                {estadoVisible}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              N° empleado
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {persona.numero_empleado || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Ingreso
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {formatearFecha(persona.fecha_ingreso_compania)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Nacimiento
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {formatearFecha(persona.fecha_nacimiento)}
            </p>
          </div>
        </div>

        {skillsEvaluadas.length > 0 && (
          <div>
            <p className="section-label mb-2">Skills evaluadas</p>
            <div className="space-y-1.5">
              {skillsEvaluadas.map((skill) => (
                <div
                  key={skill.skill_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {skill.nombre}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {skill.categoria || "Sin categoría"}
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                    {skill.nivel}
                  </span>
                </div>
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
      className="card text-left cursor-pointer w-full h-full flex flex-col border border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md group"
      onClick={onClick}
    >
      {/* Identidad: avatar + nombre + rol (nombre con espacio propio, sin competir con la categoría) */}
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-base font-bold shrink-0",
            avatarGradient(persona.nombre),
          )}
          style={{ boxShadow: "0 3px 10px rgba(15,23,42,0.18)" }}
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
            NIVEL_COLOR[persona.nivel_piramide] ?? "bg-gray-100 text-gray-600",
          )}
        >
          {persona.nivel_piramide ?? "Sin clasificar"}
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
  const [estadoFilter, setEstadoFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [vista, setVista] = useState("list");

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const { data: asignaciones = [], isLoading: isLoadingAsignaciones } =
    useQuery({
      queryKey: ["asignaciones"],
      queryFn: () => asignacionesApi.list(),
    });

  const personasEnProyecto = new Set(
    asignaciones
      .filter(esAsignacionVigente)
      .map((asignacion) => asignacion.persona_id),
  );

  const estadoVisiblePorPersona = Object.fromEntries(
    personas.map((persona) => [
      persona.id,
      obtenerEstadoVisible(persona, personasEnProyecto),
    ]),
  );

  const filtered = personas.filter((p) => {
    const terminosBusqueda = normalizarTexto(search)
      .split(/\s+/)
      .filter(Boolean);

    const contenidoPersona = normalizarTexto(
      [p.nombre, p.rol, p.nivel_piramide, p.numero_empleado]
        .filter(Boolean)
        .join(" "),
    );

    const coincideBusqueda =
      terminosBusqueda.length === 0 ||
      terminosBusqueda.every((termino) => contenidoPersona.includes(termino));

    const coincideCategoria = !nivelFilter || p.nivel_piramide === nivelFilter;

    const coincideEstado =
      !estadoFilter || estadoVisiblePorPersona[p.id] === estadoFilter;

    return coincideBusqueda && coincideCategoria && coincideEstado;
  });

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
          <h2 className="text-2xl font-bold tracking-tight">Equipo DX</h2>
          <p className="text-sm text-white/60 mt-1 font-medium">
            {personas.length} personas
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn-primary shrink-0"
        >
          + Nueva persona
        </button>
      </div>

      <div className="px-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
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

            {CATEGORIAS_NIVEL.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="input w-44"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_LABORALES.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>

          <p className="basis-full text-[11px] text-gray-400">
            “En proyecto” se determina automáticamente por asignaciones activas
            y vigentes.
          </p>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setVista("list")}
              className={clsx(
                "px-3 py-2 text-xs font-semibold transition-colors",
                vista === "list"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-gray-50",
              )}
            >
              Lista
            </button>

            <button
              type="button"
              onClick={() => setVista("cards")}
              className={clsx(
                "px-3 py-2 text-xs font-semibold transition-colors",
                vista === "cards"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-gray-50",
              )}
            >
              Tarjetas
            </button>
          </div>
        </div>

        {/* Vista de tarjetas o lista */}
        {isLoading || isLoadingAsignaciones ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : vista === "cards" ? (
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
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">N° empleado</th>
                  <th className="px-4 py-3">Fecha de ingreso</th>
                  <th className="px-4 py-3">Años de experiencia</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="border-t border-gray-100 hover:bg-brand-50/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {p.nombre}
                    </td>

                    <td className="px-4 py-3 text-gray-500">{p.rol || "—"}</td>

                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "badge",
                          NIVEL_COLOR[p.nivel_piramide] ??
                            "bg-gray-100 text-gray-600",
                        )}
                      >
                        {p.nivel_piramide ?? "Sin clasificar"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {p.numero_empleado || "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatearFecha(p.fecha_ingreso_compania)}
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {p.anos_experiencia ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "badge",
                          ESTADO_LABORAL_COLOR[estadoVisiblePorPersona[p.id]] ??
                            "bg-slate-100 text-slate-700 border border-slate-200",
                        )}
                      >
                        {estadoVisiblePorPersona[p.id]}
                      </span>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {selected && !editing && (
          <PersonaPanel
            persona={selected}
            estadoVisible={estadoVisiblePorPersona[selected.id] ?? "Disponible"}
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
    </div>
  );
}
