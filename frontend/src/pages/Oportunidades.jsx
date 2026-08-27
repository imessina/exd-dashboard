import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { oportunidadesApi } from "../services/api";
import {
  OPORTUNIDAD_STATUS,
  OPORTUNIDAD_STATUS_LABEL,
  NIVEL_COLOR,
  NIVELES,
} from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";
import TagInput from "../components/TagInput";

const STATUS_COLORS = {
  opportunity: "bg-slate-100 text-slate-700",
  approved: "bg-blue-100 text-blue-800",
  bidding: "bg-amber-100 text-amber-800",
  signed: "bg-teal-100 text-teal-800",
  executing: "bg-cyan-100 text-cyan-800",
};

const STATUS_HEADER_STYLE = {
  opportunity: {
    background: "linear-gradient(135deg, rgba(71,85,105,0.96), rgba(30,41,59,0.98))",
  },
  approved: {
    background: "linear-gradient(135deg, rgba(30,64,175,0.92), rgba(15,23,42,0.98))",
  },
  bidding: {
    background: "linear-gradient(135deg, rgba(180,138,25,0.82), rgba(120,86,12,0.92))",
  },
  signed: {
    background: "linear-gradient(135deg, rgba(15,118,110,0.88), rgba(17,60,66,0.98))",
  },
  executing: {
    background: "linear-gradient(135deg, rgba(14,116,144,0.88), rgba(15,23,42,0.98))",
  },
};

// ── Match panel ───────────────────────────────────────────────────────────────
function MatchPanel({ oportunidad, onClose }) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ["match", oportunidad.id],
    queryFn: () => oportunidadesApi.match(oportunidad.id),
    enabled: !!oportunidad,
  });

  return (
    <Panel title={`Sugerencias · ${oportunidad.nombre}`} onClose={onClose}>
      {isLoading ? (
        <p className="text-sm text-gray-400">Calculando...</p>
      ) : matches?.length === 0 ? (
        <p className="text-sm text-gray-400">
          No hay personas disponibles con el perfil requerido.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div
              key={m.persona_id}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "rgba(28,159,228,0.05)" }}
            >
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {m.nombre}
                </p>
                <p className="text-xs text-gray-500">{m.nivel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-brand-600">
                  {m.match_score}/{m.max_score} capacidades
                </p>
                <div className="flex gap-1 mt-1 justify-end flex-wrap">
                  {m.habilidades?.slice(0, 2).map((h) => (
                    <span key={h} className="badge bg-brand-50 text-brand-600">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Formulario ────────────────────────────────────────────────────────────────
const EMPTY = {
  nombre: "",
  cliente: "",
  alcance: "",
  vacantes: 1,
  nivel_requerido: "",
  competencias_requeridas: [],
  status: "opportunity",
  timeline_start: "",
  timeline_end: "",
  owner: "",
};

function OportunidadForm({ initial, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initial
      ? {
          nombre: initial.nombre ?? "",
          cliente: initial.cliente ?? "",
          alcance: initial.alcance ?? "",
          vacantes: initial.vacantes ?? 1,
          nivel_requerido: initial.nivel_requerido ?? "",
          competencias_requeridas: initial.competencias_requeridas ?? [],
          status: initial.status ?? "opportunity",
          timeline_start: initial.timeline_start ?? "",
          timeline_end: initial.timeline_end ?? "",
          owner: initial.owner ?? "",
        }
      : { ...EMPTY },
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["oportunidades"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
  };

  const create = useMutation({
    mutationFn: oportunidadesApi.create,
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: (d) => oportunidadesApi.update(initial.id, d),
    onSuccess: done,
  });
  const busy = create.isPending || update.isPending;
  const err = create.error || update.error;

  const submit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      vacantes: Number(form.vacantes),
      nivel_requerido: form.nivel_requerido || null,
      timeline_start: form.timeline_start || null,
      timeline_end: form.timeline_end || null,
    };
    if (initial) update.mutate(data);
    else create.mutate(data);
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
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="form-label">Vacantes</label>
          <input
            type="number"
            min="1"
            className="input"
            value={form.vacantes}
            onChange={(e) => set("vacantes", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Nivel requerido</label>
          <select
            className="input"
            value={form.nivel_requerido}
            onChange={(e) => set("nivel_requerido", e.target.value)}
          >
            <option value="">Cualquier nivel</option>
            {NIVELES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Estado</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {OPORTUNIDAD_STATUS.map((s) => (
              <option key={s} value={s}>
                {OPORTUNIDAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="form-label">Competencias requeridas</label>
        <TagInput
          value={form.competencias_requeridas}
          onChange={(v) => set("competencias_requeridas", v)}
          placeholder="ej: UX Research"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Inicio estimado</label>
          <input
            type="date"
            className="input"
            value={form.timeline_start}
            onChange={(e) => set("timeline_start", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Fin estimado</label>
          <input
            type="date"
            className="input"
            value={form.timeline_end}
            onChange={(e) => set("timeline_end", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Owner</label>
          <input
            className="input"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="ej: Crescente"
          />
        </div>
        <div>
          <label className="form-label">Alcance</label>
          <input
            className="input"
            value={form.alcance}
            onChange={(e) => set("alcance", e.target.value)}
            placeholder="ej: Discovery + Design"
          />
        </div>
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
              : "Crear oportunidad"}
        </button>
      </div>
    </form>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function OportunidadCard({ op, onMatch, onEdit }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const del = useMutation({
    mutationFn: () => oportunidadesApi.delete(op.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="card hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-bold text-gray-900 text-sm">{op.nombre}</p>
          <p className="text-xs text-gray-400">{op.cliente}</p>
        </div>
        <span className={clsx("badge", STATUS_COLORS[op.status])}>
          {OPORTUNIDAD_STATUS_LABEL[op.status]}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">
          👥 {op.vacantes} vacante{op.vacantes !== 1 ? "s" : ""}
        </span>
        {op.nivel_requerido && (
          <span className={clsx("badge", NIVEL_COLOR[op.nivel_requerido])}>
            {op.nivel_requerido}
          </span>
        )}
      </div>

      {op.competencias_requeridas?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {op.competencias_requeridas.map((c) => (
            <span key={c} className="badge bg-brand-50 text-brand-600">
              {c}
            </span>
          ))}
        </div>
      )}

      {(op.timeline_start || op.timeline_end) && (
        <p className="text-xs text-gray-400 mt-2.5 font-medium">
          📅 {op.timeline_start} → {op.timeline_end}
        </p>
      )}

      <div className="mt-3 pt-2.5 border-t border-gray-100/50 flex items-center justify-between">
        <button
          onClick={() => onMatch(op)}
          className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
        >
          ✦ Sugerencias
        </button>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            ✏️
          </button>
          {confirming ? (
            <>
              <button
                onClick={() => del.mutate()}
                className="text-xs text-red-600 font-semibold"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-gray-400"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Oportunidades() {
  const [matchFor, setMatchFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ["oportunidades"],
    queryFn: () => oportunidadesApi.list(),
  });

  const byStatus = OPORTUNIDAD_STATUS.reduce((acc, s) => {
    acc[s] = opps.filter((o) => o.status === s);
    return acc;
  }, {});

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
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
            Pipeline de Oportunidades
          </h2>
          <p className="text-sm text-white/60 mt-1 font-medium">
            {opps.length} oportunidades
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary shrink-0">
          + Nueva oportunidad
        </button>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 overflow-x-hidden">

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 w-full">
          {OPORTUNIDAD_STATUS.map((status) => (
            <div key={status} className="min-w-0 w-full">
              {/* Gradient status header */}
              <div
                className={clsx(
                  "mb-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-w-0",
                  "text-white",
                )}
                style={{
                  ...STATUS_HEADER_STYLE[status],
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.16)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap truncate">
                  {OPORTUNIDAD_STATUS_LABEL[status]}
                </h3>
                <span className="text-xs font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center">
                  {byStatus[status].length}
                </span>
              </div>
              <div className="space-y-4">
                {byStatus[status].map((o) => (
                  <OportunidadCard
                    key={o.id}
                    op={o}
                    onMatch={setMatchFor}
                    onEdit={() => setEditing(o)}
                  />
                ))}
                {byStatus[status].length === 0 && (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl h-24 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Sin items</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {matchFor && (
        <MatchPanel oportunidad={matchFor} onClose={() => setMatchFor(null)} />
      )}

      {creating && (
        <Panel title="Nueva oportunidad" onClose={() => setCreating(false)}>
          <OportunidadForm onClose={() => setCreating(false)} />
        </Panel>
      )}
      {editing && (
        <Panel
          title={`Editar · ${editing.nombre}`}
          onClose={() => setEditing(null)}
        >
          <OportunidadForm initial={editing} onClose={() => setEditing(null)} />
        </Panel>
      )}
      </div>
    </div>
  );
}
