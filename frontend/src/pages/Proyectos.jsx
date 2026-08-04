import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proyectosApi, asignacionesApi, personasApi } from "../services/api";
import {
  FASES_PROYECTO,
  FASES_LABEL,
  HEALTH_COLOR,
  HEALTH_LABEL,
  NIVEL_COLOR,
  TIPO_PROYECTO,
  TIPO_LABEL,
  TIPO_COLOR,
  ESTADOS_PROYECTO,
  ESTADO_LABEL,
  ESTADO_COLOR,
} from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const EMPTY = {
  nombre: "",
  cliente: "",
  descripcion: "",
  tipo: "fixed_scope",
  estado: "active",
  fase: "discovery",
  health: "on_track",
  porcentaje_completado: 0,
  stakeholder: "",
  next_milestone: "",
  fecha_inicio: "",
  fecha_launch: "",
};

const FASE_HEADER_STYLE = {
  discovery: {
    background:
      "linear-gradient(135deg, rgba(71,85,105,0.96), rgba(30,41,59,0.98))",
  },
  design: {
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.92), rgba(15,23,42,0.98))",
  },
  testing: {
    background:
      "linear-gradient(135deg, rgba(180,138,25,0.82), rgba(120,86,12,0.92))",
  },
  launch: {
    background:
      "linear-gradient(135deg, rgba(15,118,110,0.88), rgba(17,60,66,0.98))",
  },
  evolution: {
    background:
      "linear-gradient(135deg, rgba(51,65,85,0.94), rgba(14,116,144,0.88))",
  },
};

// ── Formulario ────────────────────────────────────────────────────────────────
function ProyectoForm({ initial, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initial
      ? {
          nombre: initial.nombre ?? "",
          cliente: initial.cliente ?? "",
          descripcion: initial.descripcion ?? "",
          tipo: initial.tipo ?? "fixed_scope",
          estado: initial.estado ?? "active",
          fase: initial.fase ?? "discovery",
          health: initial.health ?? "on_track",
          porcentaje_completado: initial.porcentaje_completado ?? 0,
          stakeholder: initial.stakeholder ?? "",
          next_milestone: initial.next_milestone ?? "",
          fecha_inicio: initial.fecha_inicio ?? "",
          fecha_launch: initial.fecha_launch ?? "",
        }
      : { ...EMPTY },
  );

  const isTM = form.tipo === "time_materials";

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["proyectos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
  };

  const create = useMutation({
    mutationFn: proyectosApi.create,
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: (d) => proyectosApi.update(initial.id, d),
    onSuccess: done,
  });
  const busy = create.isPending || update.isPending;
  const err = create.error || update.error;

  const submit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      // T&M no tiene fase, %, ni fecha_launch — se ignoran y se mandan null
      fase: isTM ? null : form.fase,
      porcentaje_completado: isTM ? null : Number(form.porcentaje_completado),
      fecha_launch: isTM ? null : form.fecha_launch || null,
      fecha_inicio: form.fecha_inicio || null,
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
          <label className="form-label">Cliente *</label>
          <input
            required
            className="input"
            value={form.cliente}
            onChange={(e) => set("cliente", e.target.value)}
          />
        </div>
      </div>

      {/* Tipo: radio toggle */}
      <div>
        <label className="form-label">Tipo</label>
        <div className="flex gap-2">
          {TIPO_PROYECTO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("tipo", t)}
              className={clsx(
                "flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
                form.tipo === t
                  ? `${TIPO_COLOR[t]} border-transparent ring-2 ring-offset-1 ring-brand-300`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
              )}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        {isTM && (
          <p className="text-xs text-gray-400 mt-1.5">
            T&M = venta de capacidad (sin fase ni % de avance).
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {!isTM && (
          <div>
            <label className="form-label">Fase</label>
            <select
              className="input"
              value={form.fase}
              onChange={(e) => set("fase", e.target.value)}
            >
              {FASES_PROYECTO.map((f) => (
                <option key={f} value={f}>
                  {FASES_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="form-label">Estado</label>
          <select
            className="input"
            value={form.estado}
            onChange={(e) => set("estado", e.target.value)}
          >
            {ESTADOS_PROYECTO.map((s) => (
              <option key={s} value={s}>
                {ESTADO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Health</label>
          <select
            className="input"
            value={form.health}
            onChange={(e) => set("health", e.target.value)}
          >
            {Object.entries(HEALTH_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isTM && (
        <div>
          <label className="form-label">
            Progreso: {form.porcentaje_completado}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="w-full accent-brand-500 h-2 rounded-full"
            value={form.porcentaje_completado}
            onChange={(e) => set("porcentaje_completado", e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Fecha inicio</label>
          <input
            type="date"
            className="input"
            value={form.fecha_inicio}
            onChange={(e) => set("fecha_inicio", e.target.value)}
          />
        </div>
        {!isTM && (
          <div>
            <label className="form-label">Fecha lanzamiento</label>
            <input
              type="date"
              className="input"
              value={form.fecha_launch}
              onChange={(e) => set("fecha_launch", e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Stakeholder</label>
          <input
            className="input"
            value={form.stakeholder}
            onChange={(e) => set("stakeholder", e.target.value)}
            placeholder="ej: María González"
          />
        </div>
        <div>
          <label className="form-label">Próximo hito</label>
          <input
            className="input"
            value={form.next_milestone}
            onChange={(e) => set("next_milestone", e.target.value)}
            placeholder="ej: Entrega wireframes"
          />
        </div>
      </div>
      <div>
        <label className="form-label">Descripción</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
        />
      </div>
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
              : "Crear proyecto"}
        </button>
      </div>
    </form>
  );
}

// ── Historial de hitos ──────────────────────────────────────────────────────
function HitoHistorial({ proyectoId }) {
  const qc = useQueryClient();
  const { data: hitos = [], isLoading } = useQuery({
    queryKey: ["hitos", proyectoId],
    queryFn: () => proyectosApi.hitos(proyectoId),
  });
  const toggle = useMutation({
    mutationFn: ({ hitoId, estado }) =>
      proyectosApi.updateHito(proyectoId, hitoId, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hitos", proyectoId] }),
  });

  if (isLoading)
    return <p className="text-xs text-gray-400 mt-2">Cargando historial…</p>;
  if (hitos.length === 0)
    return (
      <p className="text-xs text-gray-400 mt-2">Sin hitos registrados aún.</p>
    );

  return (
    <ul className="mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
      {hitos.map((h) => {
        const cumplido = h.estado === "cumplido";
        return (
          <li key={h.id} className="text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={clsx(
                  "badge text-[10px]",
                  cumplido
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {cumplido ? "✓ Cumplido" : "⏳ Pendiente"}
              </span>
              {h.tipo === "accion" && (
                <span className="badge text-[10px] bg-blue-100 text-blue-700">
                  Acción
                </span>
              )}
              <span className="text-gray-300">
                {(h.created_at || "").slice(0, 10)}
              </span>
            </div>
            <p
              className={clsx(
                "mt-0.5",
                cumplido ? "line-through text-gray-400" : "text-gray-600",
              )}
            >
              {h.descripcion}
            </p>
            <button
              onClick={() =>
                toggle.mutate({
                  hitoId: h.id,
                  estado: cumplido ? "pendiente" : "cumplido",
                })
              }
              disabled={toggle.isPending}
              className="text-brand-500 hover:text-brand-700 mt-0.5 font-medium"
            >
              {cumplido ? "↩ Marcar pendiente" : "✓ Marcar cumplido"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ProyectoCard({ proyecto, asignados, onEdit }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [showHist, setShowHist] = useState(false);

  const del = useMutation({
    mutationFn: () => proyectosApi.delete(proyecto.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const activos = asignados.filter((a) => a.estado === "active");
  const isTM = proyecto.tipo === "time_materials";

  return (
    <div className="card hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">
            {proyecto.nombre}
          </p>
          <p className="text-xs text-gray-400 truncate">{proyecto.cliente}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx("badge", HEALTH_COLOR[proyecto.health])}>
            {HEALTH_LABEL[proyecto.health]}
          </span>
          {proyecto.estado && proyecto.estado !== "active" && (
            <span className={clsx("badge", ESTADO_COLOR[proyecto.estado])}>
              {ESTADO_LABEL[proyecto.estado]}
            </span>
          )}
        </div>
      </div>

      {(proyecto.fecha_inicio || (!isTM && proyecto.fecha_launch)) && (
        <p className="text-xs text-gray-400 mb-2 font-medium">
          📅 {proyecto.fecha_inicio ?? "—"}
          {!isTM && <> → {proyecto.fecha_launch ?? "—"}</>}
        </p>
      )}

      {proyecto.stakeholder && (
        <p className="text-xs text-gray-500 mb-2">👤 {proyecto.stakeholder}</p>
      )}

      {!isTM && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium">
            <span>Progreso</span>
            <span className="font-bold text-gray-600">
              {proyecto.porcentaje_completado ?? 0}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(28,159,228,0.10)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${proyecto.porcentaje_completado ?? 0}%`,
                background: "linear-gradient(90deg, #127cba, #1c9fe4)",
              }}
            />
          </div>
        </div>
      )}

      {activos.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1.5 font-medium">
            👥 Equipo activo ({activos.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {activos.slice(0, 4).map((a) => (
              <span
                key={a.id}
                className={clsx(
                  "badge",
                  NIVEL_COLOR[a.nivel_seniority] ?? "bg-gray-100 text-gray-600",
                )}
              >
                {a.persona_nombre}
              </span>
            ))}
            {activos.length > 4 && (
              <span className="text-xs text-gray-400">
                +{activos.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {proyecto.next_milestone && (
        <p className="mt-2.5 text-xs text-brand-600 font-semibold">
          → {proyecto.next_milestone}
        </p>
      )}

      <button
        onClick={() => setShowHist((v) => !v)}
        className="mt-1.5 text-xs text-gray-400 hover:text-brand-600 font-medium"
      >
        🕑 {showHist ? "Ocultar historial" : "Historial de hitos"}
      </button>
      {showHist && <HitoHistorial proyectoId={proyecto.id} />}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100/50">
        {confirming ? (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-red-600">¿Eliminar?</span>
            <button
              onClick={() => del.mutate()}
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
            className="text-xs text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
        >
          ✏️ Editar
        </button>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Proyectos() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ["proyectos"],
    queryFn: () => proyectosApi.list(),
  });
  const { data: asignaciones = [] } = useQuery({
    queryKey: ["asignaciones"],
    queryFn: () => asignacionesApi.list(),
  });
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  // enrich asignaciones with persona data
  const personaMap = Object.fromEntries(personas.map((p) => [p.id, p]));
  const enrichedAsignaciones = asignaciones.map((a) => ({
    ...a,
    persona_nombre: personaMap[a.persona_id]?.nombre ?? a.persona_id,
    nivel_seniority: personaMap[a.persona_id]?.nivel_seniority,
  }));

  // Separar por tipo: kanban solo con proyectos fixed_scope, T&M aparte
  const fixedScope = proyectos.filter(
    (p) => (p.tipo ?? "fixed_scope") === "fixed_scope",
  );
  const timeMaterials = proyectos.filter((p) => p.tipo === "time_materials");

  const byFase = FASES_PROYECTO.reduce((acc, fase) => {
    acc[fase] = fixedScope.filter((p) => p.fase === fase);
    return acc;
  }, {});

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
            Proyectos activos
          </h2>
          <p className="text-sm text-white/60 mt-1 font-medium">
            {fixedScope.length} proyecto{fixedScope.length !== 1 ? "s" : ""}
            {timeMaterials.length > 0 && ` · ${timeMaterials.length} T&M`}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn-primary shrink-0"
        >
          + Nuevo proyecto
        </button>
      </div>

      <div className="px-8">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : (
          <>
            {/* Kanban por fase — solo proyectos fixed_scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 w-full">
              {FASES_PROYECTO.map((fase) => (
                <div key={fase} className="min-w-0 w-full">
                  <div
                    className={clsx(
                      "mb-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-w-0",
                      "text-white",
                    )}
                    style={{
                      ...FASE_HEADER_STYLE[fase],
                      boxShadow: "0 4px 14px rgba(15,23,42,0.16)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap truncate">
                      {FASES_LABEL[fase]}
                    </h3>
                    <span className="text-xs font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center">
                      {byFase[fase].length}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {byFase[fase].map((p) => (
                      <ProyectoCard
                        key={p.id}
                        proyecto={p}
                        asignados={enrichedAsignaciones.filter(
                          (a) => a.proyecto_id === p.id,
                        )}
                        onEdit={() => setEditing(p)}
                      />
                    ))}
                    {byFase[fase].length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl h-24 flex items-center justify-center">
                        <span className="text-xs text-gray-400">
                          Sin proyectos
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sección Time & Materials */}
            {timeMaterials.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={clsx(
                      "rounded-xl px-4 py-2.5 inline-flex items-center gap-2",
                      "text-white",
                    )}
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(30,64,175,0.90), rgba(15,23,42,0.98))",
                      boxShadow: "0 4px 14px rgba(15,23,42,0.16)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap truncate">
                      Time &amp; Materials
                    </h3>
                    <span className="text-xs font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center">
                      {timeMaterials.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Asignaciones de capacidad sin alcance cerrado
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {timeMaterials.map((p) => (
                    <ProyectoCard
                      key={p.id}
                      proyecto={p}
                      asignados={enrichedAsignaciones.filter(
                        (a) => a.proyecto_id === p.id,
                      )}
                      onEdit={() => setEditing(p)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {creating && (
        <Panel title="Nuevo proyecto" onClose={() => setCreating(false)}>
          <ProyectoForm onClose={() => setCreating(false)} />
        </Panel>
      )}
      {editing && (
        <Panel
          title={`Editar — ${editing.nombre}`}
          onClose={() => setEditing(null)}
        >
          <ProyectoForm initial={editing} onClose={() => setEditing(null)} />
        </Panel>
      )}
    </div>
  );
}
