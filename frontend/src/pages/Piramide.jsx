import { useQuery } from "@tanstack/react-query";
import { personasApi } from "../services/api";
import clsx from "clsx";

function obtenerNivelPiramide(persona = {}) {
  return persona.nivel_piramide || "Sin clasificar";
}

function nombreCorto(nombre = "") {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);

  if (partes.length <= 2) return partes.join(" ");

  const primerNombre = partes[0];
  const primerApellido = partes[partes.length - 2];

  return `${primerNombre} ${primerApellido}`;
}

const NIVELES_ORDER = [
  "Director",
  "Manager",
  "Chief",
  "Evangelist",
  "Expert",
  "Leader",
  "Professional",
  "Junior",
];

const NIVEL_WIDTH = {
  Director: 100,
  Manager: 94,
  Chief: 88,
  Evangelist: 82,
  Expert: 76,
  Leader: 70,
  Professional: 61,
  Junior: 53,
};

const NIVEL_STYLES = {
  Director: {
    gradient: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(2,6,23,1))",
    dot: "bg-slate-950",
    badge: "bg-slate-900 text-white",
  },
  Manager: {
    gradient:
      "linear-gradient(135deg, rgba(51,65,85,0.96), rgba(15,23,42,0.98))",
    dot: "bg-slate-700",
    badge: "bg-slate-700 text-white",
  },
  Chief: {
    gradient:
      "linear-gradient(135deg, rgba(30,58,138,0.94), rgba(15,23,42,0.98))",
    dot: "bg-blue-900",
    badge: "bg-blue-950 text-blue-100",
  },
  Evangelist: {
    gradient:
      "linear-gradient(135deg, rgba(180,138,25,0.80), rgba(92,65,10,0.94))",
    dot: "bg-amber-700",
    badge: "bg-amber-100 text-amber-900 border border-amber-300/70",
  },
  Expert: {
    gradient:
      "linear-gradient(135deg, rgba(30,64,175,0.90), rgba(30,41,59,0.98))",
    dot: "bg-blue-800",
    badge: "bg-blue-800 text-blue-100",
  },
  Leader: {
    gradient:
      "linear-gradient(135deg, rgba(15,118,110,0.88), rgba(17,60,66,0.98))",
    dot: "bg-teal-800",
    badge: "bg-teal-800 text-teal-100",
  },
  Professional: {
    gradient:
      "linear-gradient(135deg, rgba(71,85,105,0.92), rgba(30,64,97,0.94))",
    dot: "bg-slate-600",
    badge: "bg-slate-200 text-slate-800",
  },
  Junior: {
    gradient:
      "linear-gradient(135deg, rgba(148,163,184,0.88), rgba(71,85,105,0.94))",
    dot: "bg-slate-400",
    badge: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

export default function Piramide() {
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const groups = NIVELES_ORDER.reduce((acc, nivel) => {
    acc[nivel] = personas.filter(
      (persona) => obtenerNivelPiramide(persona) === nivel,
    );

    return acc;
  }, {});

  const seniorPlus = personas.filter((persona) =>
    ["Leader", "Expert", "Evangelist", "Chief", "Manager", "Director"].includes(
      obtenerNivelPiramide(persona),
    ),
  ).length;

  const disponibles = personas.filter((p) => p.disponible_mentoria).length;

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-0 space-y-8 w-full">
      <div
        className="p-8 text-white"
        style={{
          background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
          Somos DX
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          Pirámide del Equipo
        </h2>
        <p className="text-sm text-white/60 mt-1 font-medium">
          {personas.length} personas · distribución por categoría
        </p>
      </div>

      <div className="px-3 sm:px-5 py-0 min-h-[calc(100dvh-132px)]">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 xl:gap-6 items-stretch w-full min-h-[calc(100dvh-160px)]">
            {/* ── Pirámide visual ─────────────────────────────────────────── */}
            <div className="card min-w-0 w-full h-full !p-4 sm:!p-6 xl:!p-7">
              <h3 className="text-sm font-bold text-gray-700 mb-8"></h3>
              <div className="flex flex-col items-center gap-3.5">
                {NIVELES_ORDER.map((nivel) => {
                  const count = groups[nivel].length;
                  const widthPct = NIVEL_WIDTH[nivel];
                  const styles = NIVEL_STYLES[nivel];

                  return (
                    <div
                      key={nivel}
                      className="w-full flex items-center gap-2 sm:gap-4"
                    >
                      <div className="w-20 sm:w-24 shrink-0 flex justify-end">
                        <span
                          className={clsx(
                            "badge inline-flex w-16 sm:w-20 justify-center text-center",
                            NIVEL_STYLES[nivel].badge,
                          )}
                        >
                          {nivel}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 flex justify-center overflow-x-auto">
                        <div
                          className={clsx(
                            "flex items-center justify-between px-3 sm:px-5 py-2.5 rounded-md transition-all text-white",
                            count === 0 && "opacity-30",
                          )}
                          style={{
                            width: `${widthPct}%`,
                            minWidth: nivel === "Junior" ? "200px" : "180px",
                            maxWidth: "100%",
                            background: styles.gradient,
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow:
                              count > 0
                                ? "0 4px 14px rgba(15,23,42,0.16)"
                                : "none",
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-y-1 flex-1 mr-3 text-center">
                            {count === 0 ? (
                              <span className="text-xs text-white/50 italic font-medium">
                                Sin personas
                              </span>
                            ) : (
                              groups[nivel].map((p, index) => (
                                <span
                                  key={p.id}
                                  className="text-[11px] sm:text-[13px] font-semibold text-white/95 whitespace-normal sm:whitespace-nowrap"
                                >
                                  {index > 0 && (
                                    <span className="mx-1 text-white/50">
                                      -
                                    </span>
                                  )}
                                  {nombreCorto(p.nombre)}
                                </span>
                              ))
                            )}
                          </div>
                          <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-white/25 text-white">
                            {count}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ratio bar */}
              <div className="mt-8 pt-5 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-400 mb-2 font-semibold">
                  <span>Junior / Professional</span>
                  <span>
                    Leader / Expert / Evangelist / Chief / Manager / Director
                  </span>
                </div>
                <div
                  className="h-3 rounded-sm overflow-hidden flex"
                  style={{ background: "rgba(71,85,105,0.10)" }}
                >
                  {NIVELES_ORDER.slice()
                    .reverse()
                    .map((nivel) => {
                      const pct =
                        (groups[nivel].length / Math.max(personas.length, 1)) *
                        100;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={nivel}
                          className={clsx(
                            "h-full transition-all",
                            NIVEL_STYLES[nivel].dot,
                          )}
                          style={{ width: `${pct}%` }}
                          title={`${nivel}: ${groups[nivel].length}`}
                        />
                      );
                    })}
                </div>
                <div className="flex gap-4 mt-3 flex-wrap">
                  {NIVELES_ORDER.map(
                    (nivel) =>
                      groups[nivel].length > 0 && (
                        <div key={nivel} className="flex items-center gap-1.5">
                          <div
                            className={clsx(
                              "w-2.5 h-2.5 rounded-full",
                              NIVEL_STYLES[nivel].dot,
                            )}
                          />
                          <span className="text-xs text-gray-500 font-medium">
                            {nivel} ({groups[nivel].length})
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 w-full">
              {NIVELES_ORDER.map((nivel) => {
                const count = groups[nivel].length;
                const pct =
                  personas.length > 0
                    ? Math.round((count / personas.length) * 100)
                    : 0;
                return (
                  <div
                    key={nivel}
                    className={clsx(
                      "card !p-3 sm:!p-4 border border-slate-200/80",
                      count === 0 && "opacity-40",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={clsx("badge", NIVEL_STYLES[nivel].badge)}
                      >
                        {nivel}
                      </span>
                      <span className="text-2xl font-extrabold text-gray-900 tabular-nums">
                        {count}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-sm overflow-hidden"
                      style={{ background: "rgba(71,85,105,0.10)" }}
                    >
                      <div
                        className={clsx(
                          "h-full rounded-sm transition-all",
                          NIVEL_STYLES[nivel].dot,
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">
                      {pct}% del equipo
                    </p>
                  </div>
                );
              })}

              {/* KPI gradient cards */}
              <div
                className="rounded-lg p-4 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(30,41,59,0.98), rgba(30,64,97,0.96))",
                  boxShadow: "0 4px 18px rgba(15,23,42,0.20)",
                }}
              >
                <p className="text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                  Ratio Lead+
                </p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {Math.round(
                    (seniorPlus / Math.max(personas.length, 1)) * 100,
                  )}
                  %
                </p>
                <p className="text-[11px] text-white/60 mt-1 font-medium">
                  {seniorPlus} personas · Leader, Expert, Evangelist, Chief,
                  Manager o Director
                </p>
              </div>

              <div
                className="rounded-lg p-4 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(17,60,66,0.98), rgba(15,118,110,0.88))",
                  boxShadow: "0 4px 18px rgba(15,23,42,0.18)",
                }}
              >
                <p className="text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                  Disponibles mentoría
                </p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {disponibles}
                </p>
                <p className="text-[11px] text-white/60 mt-1 font-medium">
                  {Math.round(
                    (disponibles / Math.max(personas.length, 1)) * 100,
                  )}
                  % del equipo
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
