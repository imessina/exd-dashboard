import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { asignacionesApi, personasApi, proyectosApi } from "../services/api";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  differenceInDays,
  format,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  NIVEL_COLOR,
  FASES_LABEL,
  HEALTH_COLOR,
  HEALTH_LABEL,
} from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";

// ═══════════════════════════════════════════════════════════════════════════════
//  VENTANA TEMPORAL: 3 meses pasado · mes actual · 6 meses futuro (= 10 meses)
// ═══════════════════════════════════════════════════════════════════════════════
const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

const WIN_START = startOfMonth(subMonths(TODAY, 3));
const WIN_END = endOfMonth(addMonths(TODAY, 6));
const WIN_MS = WIN_END.getTime() - WIN_START.getTime();

function buildMonths() {
  const arr = [];
  let cur = new Date(WIN_START);
  while (cur <= WIN_END) {
    arr.push(new Date(cur));
    cur = addMonths(cur, 1);
  }
  return arr;
}
const WIN_MONTHS = buildMonths(); // ≥10 Date objects
const N_MONTHS = WIN_MONTHS.length;
const TODAY_PCT = ((TODAY.getTime() - WIN_START.getTime()) / WIN_MS) * 100;

function toPct(dateStr) {
  if (!dateStr) return null;
  return (
    ((new Date(dateStr + "T00:00:00").getTime() - WIN_START.getTime()) /
      WIN_MS) *
    100
  );
}

function monthLabel(m) {
  const name = format(m, "MMM", { locale: es });
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  // Show year suffix when crossing Jan (year rollover)
  return m.getMonth() === 0 ? `${cap} '${format(m, "yy")}` : cap;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PALETA — color estable por proyecto_id (hash)
// ═══════════════════════════════════════════════════════════════════════════════
const PALETTE = [
  { bg: "bg-blue-500", label: "bg-blue-100 text-blue-700" },
  { bg: "bg-violet-500", label: "bg-violet-100 text-violet-700" },
  { bg: "bg-emerald-500", label: "bg-emerald-100 text-emerald-700" },
  { bg: "bg-amber-500", label: "bg-amber-100 text-amber-700" },
  { bg: "bg-pink-500", label: "bg-pink-100 text-pink-700" },
  { bg: "bg-teal-500", label: "bg-teal-100 text-teal-700" },
  { bg: "bg-orange-500", label: "bg-orange-100 text-orange-700" },
  { bg: "bg-cyan-500", label: "bg-cyan-100 text-cyan-700" },
  { bg: "bg-lime-600", label: "bg-lime-100 text-lime-700" },
  { bg: "bg-rose-500", label: "bg-rose-100 text-rose-700" },
];
const _cc = {};
function colorFor(id) {
  if (_cc[id] !== undefined) return _cc[id];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return (_cc[id] = PALETTE[h % PALETTE.length]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LANE LAYOUT — evita superposición de barras en la misma fila
// ═══════════════════════════════════════════════════════════════════════════════
function assignLanes(bars) {
  const lanes = []; // lanes[i] = array of {left, right} ocupados
  return bars.map((b) => {
    let lane = 0;
    for (; ; lane++) {
      if (!lanes[lane]) {
        lanes[lane] = [];
        break;
      }
      const free = lanes[lane].every(
        (s) => b.right <= s.left + 0.3 || b.left >= s.right - 0.3,
      );
      if (free) break;
    }
    lanes[lane].push({ left: b.left, right: b.right });
    return { ...b, lane };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BARRA — construye objeto de posición + metadatos a partir de una asignación
// ═══════════════════════════════════════════════════════════════════════════════
function toBar(a, proyectoMap) {
  const rawL = toPct(a.fecha_inicio);
  const rawR = a.fecha_liberacion ? toPct(a.fecha_liberacion) : 103; // sin fin → cuelga
  if (rawL === null) return null;

  const left = Math.max(0, rawL);
  const right = Math.min(100, rawR);
  if (right <= left) return null; // fuera de ventana

  const daysLeft = a.fecha_liberacion
    ? differenceInDays(new Date(a.fecha_liberacion + "T00:00:00"), TODAY)
    : Infinity;

  return {
    ...a,
    left,
    right,
    width: right - left,
    overflowLeft: rawL < 0,
    overflowRight: !a.fecha_liberacion || rawR > 100,
    daysLeft,
    proy: proyectoMap[a.proyecto_id],
    color: colorFor(a.proyecto_id),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GANTT ROW — una fila por persona
// ═══════════════════════════════════════════════════════════════════════════════
const BAR_H = 22; // px altura de cada barra
const LANE_GAP = 5; // px entre lanes

function GanttRow({ persona, asignaciones, proyectoMap, onEdit, onAdd }) {
  const [hoverId, setHoverId] = useState(null);

  const bars = useMemo(() => {
    const raw = asignaciones.map((a) => toBar(a, proyectoMap)).filter(Boolean);
    return assignLanes(raw);
  }, [asignaciones, proyectoMap]);

  const numLanes =
    bars.length > 0 ? Math.max(...bars.map((b) => b.lane)) + 1 : 1;
  const rowH = Math.max(44, numLanes * (BAR_H + LANE_GAP) + LANE_GAP * 2);
  const hasActive = asignaciones.some((a) => a.estado === "active");

  function barTop(lane) {
    return LANE_GAP + lane * (BAR_H + LANE_GAP);
  }

  return (
    <div
      className={clsx(
        "flex border-b border-gray-100 last:border-0 group",
        !hasActive && "opacity-60 hover:opacity-100 transition-opacity",
      )}
      style={{ minHeight: rowH }}
    >
      {/* ── Persona ── */}
      <div className="w-52 shrink-0 flex items-center gap-2 px-3 py-2 border-r border-gray-100 bg-white">
        <div
          className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none",
            hasActive
              ? "bg-brand-100 text-brand-700"
              : "bg-gray-100 text-gray-400",
          )}
        >
          {persona.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 truncate leading-snug">
            {persona.nombre}
          </p>
          <p className="text-xs text-gray-400 truncate leading-snug">
            {persona.rol}
          </p>
        </div>
        {!hasActive && (
          <span className="shrink-0 text-xs text-emerald-500 font-medium">
            Libre
          </span>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="flex-1 relative" style={{ minHeight: rowH }}>
        {/* Fondo del mes actual */}
        {WIN_MONTHS.map((m, i) =>
          isSameMonth(m, TODAY) ? (
            <div
              key={`bg-${i}`}
              className="absolute inset-y-0 bg-blue-50/50 pointer-events-none"
              style={{
                left: `${(i / N_MONTHS) * 100}%`,
                width: `${(1 / N_MONTHS) * 100}%`,
              }}
            />
          ) : null,
        )}

        {/* Líneas verticales de meses */}
        {WIN_MONTHS.map((_, i) => (
          <div
            key={`line-${i}`}
            className="absolute inset-y-0 border-l border-gray-100 pointer-events-none"
            style={{ left: `${(i / N_MONTHS) * 100}%` }}
          />
        ))}

        {/* Línea de hoy */}
        <div
          className="absolute inset-y-0 w-px bg-red-400 z-10 pointer-events-none"
          style={{ left: `${TODAY_PCT}%` }}
        />

        {/* Sin asignación */}
        {bars.length === 0 && (
          <span
            className="absolute left-3 text-xs text-gray-300 italic"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            sin asignación
          </span>
        )}

        {/* Barras */}
        {bars.map((bar) => {
          const isHov = hoverId === bar.id;
          const isCritical = bar.daysLeft >= 0 && bar.daysLeft <= 7;
          const isWarning = bar.daysLeft > 7 && bar.daysLeft <= 14;
          const isPast = bar.daysLeft < 0 && !bar.overflowRight;
          const isPaused = bar.estado === "paused";

          return (
            <div
              key={bar.id}
              className="absolute cursor-pointer"
              style={{
                left: `calc(${bar.left}% + 2px)`,
                width: `calc(${bar.width}% - 4px)`,
                top: barTop(bar.lane),
                height: BAR_H,
                zIndex: isHov ? 20 : 5,
              }}
              onMouseEnter={() => setHoverId(bar.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onEdit(bar)}
            >
              {/* Cuerpo de la barra */}
              <div
                className={clsx(
                  "w-full h-full flex items-center overflow-hidden relative",
                  bar.color.bg,
                  !bar.overflowLeft && "rounded-l-md",
                  !bar.overflowRight && "rounded-r-md",
                  isPast && "opacity-35",
                  isPaused && "opacity-50",
                  !isPast && !isPaused && "opacity-90",
                  isHov && "ring-2 ring-white/80 ring-inset",
                )}
              >
                {/* Indicador overflow izquierdo */}
                {bar.overflowLeft && (
                  <span className="shrink-0 text-white/70 text-xs font-bold px-0.5 select-none">
                    ‹
                  </span>
                )}

                {/* Etiqueta */}
                <span className="text-white text-xs font-medium truncate px-1.5 leading-none select-none flex-1">
                  {bar.proy?.nombre ?? bar.proyecto_id}
                  {bar.dedicacion < 100 ? ` · ${bar.dedicacion}%` : ""}
                </span>

                {/* Indicador overflow derecho */}
                {bar.overflowRight && (
                  <span className="shrink-0 text-white/70 text-xs font-bold px-0.5 select-none">
                    ›
                  </span>
                )}

                {/* Cap de urgencia */}
                {!bar.overflowRight && !isPast && (isCritical || isWarning) && (
                  <div
                    className={clsx(
                      "absolute right-0 top-0 bottom-0 w-1.5 rounded-r-md",
                      isCritical ? "bg-red-200" : "bg-yellow-200",
                    )}
                  />
                )}
              </div>

              {/* Tooltip */}
              {isHov && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{ bottom: "100%", left: 0, marginBottom: 6 }}
                >
                  <div className="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2 text-xs whitespace-nowrap">
                    <p className="font-semibold">
                      {bar.proy?.nombre ?? bar.proyecto_id}
                    </p>
                    <p className="text-gray-400">{bar.cliente}</p>
                    <p className="text-gray-300 mt-1">
                      {bar.fecha_inicio} → {bar.fecha_liberacion ?? "∞"}
                    </p>
                    {bar.dedicacion < 100 && (
                      <p className="text-amber-300">
                        {bar.dedicacion}% dedicación
                      </p>
                    )}
                    {bar.daysLeft >= 0 && bar.daysLeft <= 14 && (
                      <p
                        className={clsx(
                          "font-medium mt-0.5",
                          bar.daysLeft <= 7
                            ? "text-red-400"
                            : "text-yellow-400",
                        )}
                      >
                        Se libera en {bar.daysLeft}d
                      </p>
                    )}
                    {isPaused && <p className="text-gray-400">Pausada</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botón agregar (aparece en hover de la fila) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(persona);
          }}
          title="Nueva asignación"
          className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-400 hover:text-brand-600 flex items-center justify-center text-xs z-20 shadow-sm"
          style={{ top: "50%", transform: "translateY(-50%)" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GANTT CHART
// ═══════════════════════════════════════════════════════════════════════════════
function GanttChart({
  personas,
  asignaciones,
  proyectoMap,
  filter,
  search,
  onEdit,
  onAdd,
}) {
  const asigByPersona = useMemo(() => {
    const map = {};
    for (const a of asignaciones) {
      if (!map[a.persona_id]) map[a.persona_id] = [];
      map[a.persona_id].push(a);
    }
    return map;
  }, [asignaciones]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    let list = personas.filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.rol.toLowerCase().includes(q),
    );

    const hasActive = (p) =>
      (asigByPersona[p.id] ?? []).some((a) => a.estado === "active");
    if (filter === "asignados") list = list.filter(hasActive);
    if (filter === "disponibles") list = list.filter((p) => !hasActive(p));

    // Ordenar: primero asignados por fecha de liberación más próxima, luego libres
    const asignados = list.filter(hasActive);
    const disponibles = list.filter((p) => !hasActive(p));

    asignados.sort((a, b) => {
      const aMin = Math.min(
        ...(asigByPersona[a.id] ?? [])
          .filter((x) => x.estado === "active")
          .map((x) =>
            x.fecha_liberacion
              ? new Date(x.fecha_liberacion).getTime()
              : Infinity,
          ),
      );
      const bMin = Math.min(
        ...(asigByPersona[b.id] ?? [])
          .filter((x) => x.estado === "active")
          .map((x) =>
            x.fecha_liberacion
              ? new Date(x.fecha_liberacion).getTime()
              : Infinity,
          ),
      );
      return aMin - bMin;
    });
    disponibles.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return [...asignados, ...disponibles];
  }, [personas, asigByPersona, filter, search]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(28,159,228,0.08)",
      }}
    >
      {/* Cabecera de meses */}
      <div
        className="flex border-b border-gray-200/60 sticky top-0 z-30"
        style={{
          background: "rgba(248,246,254,0.9)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="w-52 shrink-0 border-r border-gray-200/60 px-3 py-3 flex items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Persona
          </span>
        </div>
        <div className="flex-1 flex">
          {WIN_MONTHS.map((m, i) => (
            <div
              key={i}
              className={clsx(
                "flex-1 text-center py-3 text-xs font-bold border-r last:border-0 border-gray-200/60 select-none",
                isSameMonth(m, TODAY)
                  ? "text-brand-700 bg-brand-50/60"
                  : "text-gray-400",
              )}
            >
              {monthLabel(m)}
            </div>
          ))}
        </div>
      </div>

      {/* Filas */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">
          Sin resultados.
        </p>
      ) : (
        rows.map((persona) => (
          <GanttRow
            key={persona.id}
            persona={persona}
            asignaciones={asigByPersona[persona.id] ?? []}
            proyectoMap={proyectoMap}
            onEdit={onEdit}
            onAdd={onAdd}
          />
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRÓXIMAS LIBERACIONES
// ═══════════════════════════════════════════════════════════════════════════════
function ProximasLiberaciones({ asignaciones, personaMap, proyectoMap }) {
  const proximas = useMemo(() => {
    return asignaciones
      .filter((a) => {
        if (a.estado !== "active" || !a.fecha_liberacion) return false;
        const d = differenceInDays(
          new Date(a.fecha_liberacion + "T00:00:00"),
          TODAY,
        );
        return d >= 0 && d <= 14;
      })
      .map((a) => ({
        ...a,
        dias: differenceInDays(
          new Date(a.fecha_liberacion + "T00:00:00"),
          TODAY,
        ),
        persona: personaMap[a.persona_id],
        proy: proyectoMap[a.proyecto_id],
      }))
      .sort((a, b) => a.dias - b.dias);
  }, [asignaciones, personaMap, proyectoMap]);

  if (proximas.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(251,191,36,0.12) 100%)",
        border: "1px solid rgba(245,158,11,0.15)",
      }}
    >
      <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
        ⚡ Próximas liberaciones · {proximas.length} en los próximos 14 días
      </h3>
      <div className="space-y-2">
        {proximas.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-4 bg-white rounded-lg px-3 py-2 border border-amber-100"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={clsx(
                  "text-sm",
                  a.dias <= 3 ? "🔴" : a.dias <= 7 ? "🟡" : "🟢",
                )}
              >
                {a.dias <= 3 ? "🔴" : a.dias <= 7 ? "🟡" : "🟢"}
              </span>
              <p className="text-sm font-medium text-gray-900 truncate">
                {a.persona?.nombre ?? a.persona_id}
              </p>
              <span className="text-xs text-gray-400">·</span>
              <p className="text-xs text-gray-500 truncate">
                {a.proy?.nombre ?? a.proyecto_id}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={clsx(
                  "text-xs font-semibold",
                  a.dias <= 3
                    ? "text-red-600"
                    : a.dias <= 7
                      ? "text-orange-600"
                      : "text-yellow-600",
                )}
              >
                {a.dias === 0 ? "hoy" : `en ${a.dias}d`}
              </p>
              <p className="text-xs text-gray-400">
                {format(new Date(a.fecha_liberacion + "T00:00:00"), "d MMM", {
                  locale: es,
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FORMULARIO
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_ASIG = {
  persona_id: "",
  proyecto_id: "",
  cliente: "",
  dedicacion: 100,
  fecha_inicio: "",
  fecha_liberacion: "",
  estado: "active",
};

function AsignacionForm({
  initial,
  defaultPersonaId,
  personas,
  proyectos,
  onClose,
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initial
      ? {
          persona_id: initial.persona_id,
          proyecto_id: initial.proyecto_id,
          cliente: initial.cliente,
          dedicacion: initial.dedicacion ?? 100,
          fecha_inicio: initial.fecha_inicio ?? "",
          fecha_liberacion: initial.fecha_liberacion ?? "",
          estado: initial.estado ?? "active",
        }
      : { ...EMPTY_ASIG, persona_id: defaultPersonaId ?? "" },
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleProyectoChange = (proyId) => {
    set("proyecto_id", proyId);
    const p = proyectos.find((x) => x.id === proyId);
    if (p) {
      set("cliente", p.cliente);
      if (!form.fecha_inicio && p.fecha_inicio)
        set("fecha_inicio", p.fecha_inicio);
      if (!form.fecha_liberacion && p.fecha_launch)
        set("fecha_liberacion", p.fecha_launch);
    }
  };

  const done = () => {
    qc.invalidateQueries({ queryKey: ["asignaciones"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
  };

  const create = useMutation({
    mutationFn: asignacionesApi.create,
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: (d) => asignacionesApi.update(initial?.id, d),
    onSuccess: done,
  });
  const del = useMutation({
    mutationFn: () => asignacionesApi.delete(initial?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asignaciones"] });
      onClose();
    },
  });
  const busy = create.isPending || update.isPending;
  const err = create.error || update.error;

  const [confirming, setConfirming] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      dedicacion: Number(form.dedicacion),
      fecha_liberacion: form.fecha_liberacion || null,
    };
    initial ? update.mutate(data) : create.mutate(data);
  };

  const proyectoSel = proyectos.find((p) => p.id === form.proyecto_id);

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Proyecto */}
      <div>
        <label className="form-label">Proyecto *</label>
        <select
          required
          className="input"
          value={form.proyecto_id}
          onChange={(e) => handleProyectoChange(e.target.value)}
        >
          <option value="">Seleccionar proyecto…</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {p.cliente}
            </option>
          ))}
        </select>
        {proyectoSel && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
            <span className={clsx("badge", HEALTH_COLOR[proyectoSel.health])}>
              {HEALTH_LABEL[proyectoSel.health]}
            </span>
            <span>{FASES_LABEL[proyectoSel.fase]}</span>
            {proyectoSel.fecha_inicio && (
              <span>
                📅 {proyectoSel.fecha_inicio}
                {proyectoSel.fecha_launch && ` → ${proyectoSel.fecha_launch}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Persona */}
      <div>
        <label className="form-label">Persona *</label>
        <select
          required
          className="input"
          value={form.persona_id}
          onChange={(e) => set("persona_id", e.target.value)}
        >
          <option value="">Seleccionar persona…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {p.nivel_seniority}
            </option>
          ))}
        </select>
      </div>

      {/* Cliente */}
      <div>
        <label className="form-label">Cliente</label>
        <input
          className="input"
          value={form.cliente}
          onChange={(e) => set("cliente", e.target.value)}
          placeholder="Se completa desde el proyecto"
        />
      </div>

      {/* Fechas + dedicación */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="form-label">Dedicación %</label>
          <input
            type="number"
            min="0"
            max="100"
            className="input"
            value={form.dedicacion}
            onChange={(e) => set("dedicacion", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Inicio *</label>
          <input
            required
            type="date"
            className="input"
            value={form.fecha_inicio}
            onChange={(e) => set("fecha_inicio", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Liberación</label>
          <input
            type="date"
            className="input"
            value={form.fecha_liberacion}
            onChange={(e) => set("fecha_liberacion", e.target.value)}
          />
        </div>
      </div>

      {/* Estado */}
      <div>
        <label className="form-label">Estado</label>
        <select
          className="input"
          value={form.estado}
          onChange={(e) => set("estado", e.target.value)}
        >
          <option value="active">Activa</option>
          <option value="paused">Pausada</option>
          <option value="completed">Completada</option>
        </select>
      </div>

      {err && <p className="text-xs text-red-500">Error: {err.message}</p>}

      <div
        className={clsx(
          "flex gap-2 pt-2 border-t border-gray-100",
          initial ? "justify-between" : "justify-end",
        )}
      >
        {initial &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">¿Eliminar?</span>
              <button
                type="button"
                onClick={() => del.mutate()}
                className="text-xs text-red-600 font-semibold hover:underline"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-gray-400 hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Eliminar
            </button>
          ))}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Guardando…" : initial ? "Guardar" : "Crear asignación"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LEYENDA DE PROYECTOS
// ═══════════════════════════════════════════════════════════════════════════════
function Leyenda({ asignaciones, proyectoMap }) {
  const proyIds = [...new Set(asignaciones.map((a) => a.proyecto_id))];
  if (proyIds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {proyIds.map((id) => {
        const col = colorFor(id);
        const proy = proyectoMap[id];
        return (
          <div key={id} className="flex items-center gap-1.5">
            <div className={clsx("w-2.5 h-2.5 rounded-sm", col.bg)} />
            <span className="text-xs text-gray-500">{proy?.nombre ?? id}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="w-px h-3 bg-red-400" />
        <span className="text-xs text-gray-400">Hoy</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PÁGINA
// ═══════════════════════════════════════════════════════════════════════════════
export default function Asignaciones() {
  const [filter, setFilter] = useState("todos"); // 'todos' | 'asignados' | 'disponibles'
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState(null); // null | { mode: 'create', personaId? } | { mode: 'edit', asig }
  const qc = useQueryClient();

  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ["asignaciones"],
    queryFn: () => asignacionesApi.list(),
  });
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });
  const { data: proyectos = [] } = useQuery({
    queryKey: ["proyectos"],
    queryFn: () => proyectosApi.list(),
  });

  const personaMap = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );
  const proyectoMap = useMemo(
    () => Object.fromEntries(proyectos.map((p) => [p.id, p])),
    [proyectos],
  );

  const activeAsigs = asignaciones.filter((a) => a.estado === "active");
  const assignedIds = new Set(activeAsigs.map((a) => a.persona_id));
  const libresCount = personas.filter((p) => !assignedIds.has(p.id)).length;

  // Panel helpers
  const openEdit = (asig) => setPanel({ mode: "edit", asig });
  const openCreate = (persona) =>
    setPanel({ mode: "create", personaId: persona?.id });
  const closePanel = () => setPanel(null);

  const FILTERS = [
    { key: "todos", label: "Todos" },
    { key: "asignados", label: "Asignados" },
    { key: "disponibles", label: "Disponibles" },
  ];

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
      {/* ── Header ── */}
      <div
        className="p-8 text-white flex items-start justify-between gap-4"
        style={{
          background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <div>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
            Somos DX
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Asignaciones</h2>
          <p className="text-sm text-white/60 mt-1 font-medium">
            {personas.length} personas · {proyectos.length} proyectos ·{" "}
            {libresCount} disponibles
          </p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="btn-primary shrink-0"
        >
          + Nueva asignación
        </button>
      </div>

      <div className="px-8 space-y-6">

      {/* ── Alertas de próximas liberaciones ── */}
      {!isLoading && (
        <ProximasLiberaciones
          asignaciones={asignaciones}
          personaMap={personaMap}
          proyectoMap={proyectoMap}
        />
      )}

      {/* ── Controles del Gantt ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filtro */}
        <div
          className="flex rounded-full overflow-hidden p-0.5"
          style={{ background: "rgba(28,159,228,0.10)" }}
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150",
                filter === f.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
              style={
                filter === f.key
                  ? { boxShadow: "0 2px 8px rgba(28,159,228,0.35)" }
                  : {}
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar persona o rol…"
          className="input max-w-xs text-sm"
        />

        {/* Leyenda */}
        <div className="ml-auto">
          <Leyenda asignaciones={asignaciones} proyectoMap={proyectoMap} />
        </div>
      </div>

      {/* ── Gantt ── */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando…</p>
      ) : (
        <GanttChart
          personas={personas}
          asignaciones={asignaciones}
          proyectoMap={proyectoMap}
          filter={filter}
          search={search}
          onEdit={openEdit}
          onAdd={openCreate}
        />
      )}

      {/* ── Panels ── */}
      {panel?.mode === "create" && (
        <Panel title="Nueva asignación" onClose={closePanel}>
          <AsignacionForm
            defaultPersonaId={panel.personaId}
            personas={personas}
            proyectos={proyectos}
            onClose={closePanel}
          />
        </Panel>
      )}
      {panel?.mode === "edit" && (
        <Panel
          title={`Editar · ${personaMap[panel.asig.persona_id]?.nombre ?? "—"}`}
          onClose={closePanel}
        >
          <AsignacionForm
            initial={panel.asig}
            personas={personas}
            proyectos={proyectos}
            onClose={closePanel}
          />
        </Panel>
      )}
      </div>
    </div>
  );
}
