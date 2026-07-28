import { useQuery } from "@tanstack/react-query";
import { personasApi } from "../services/api";
import { NIVEL_COLOR } from "../utils/constants";
import clsx from "clsx";

const NIVELES_ORDER = [
  "Chief Designer",
  "Expert Designer",
  "Lead Designer",
  "Designer",
  "Junior Designer",
];

const NIVEL_STYLES = {
  "Chief Designer": {
    bar: "from-pink-400 to-rose-500",
    dot: "bg-pink-400",
    text: "text-pink-700",
  },
  "Expert Designer": {
    bar: "from-purple-400 to-violet-500",
    dot: "bg-purple-400",
    text: "text-purple-700",
  },
  "Lead Designer": {
    bar: "from-indigo-400 to-blue-500",
    dot: "bg-indigo-400",
    text: "text-indigo-700",
  },
  Designer: {
    bar: "from-blue-400 to-cyan-500",
    dot: "bg-blue-400",
    text: "text-blue-700",
  },
  "Junior Designer": {
    bar: "from-gray-300 to-gray-400",
    dot: "bg-gray-400",
    text: "text-gray-600",
  },
};

export default function Piramide() {
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const groups = NIVELES_ORDER.reduce((acc, n) => {
    acc[n] = personas.filter((p) => p.nivel_seniority === n);
    return acc;
  }, {});

  const maxCount = Math.max(...NIVELES_ORDER.map((n) => groups[n].length), 1);

  const seniorPlus = personas.filter((p) =>
    ["Lead Designer", "Expert Designer", "Chief Designer"].includes(
      p.nivel_seniority,
    ),
  ).length;

  const disponibles = personas.filter((p) => p.disponible_mentoria).length;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Pirámide del Equipo
        </h2>
        <p className="text-sm text-gray-400 mt-1 font-medium">
          {personas.length} personas · distribución por categoría
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
      ) : (
        <div className="flex flex-col xl:flex-row gap-8 items-start">
          {/* ── Pirámide visual ─────────────────────────────────────────── */}
          <div className="card flex-1 max-w-2xl !p-8">
            <h3 className="text-sm font-bold text-gray-700 mb-8">
              Estructura del equipo
            </h3>
            <div className="flex flex-col items-center gap-3">
              {NIVELES_ORDER.map((nivel) => {
                const count = groups[nivel].length;
                const invertedIdx =
                  NIVELES_ORDER.length - 1 - NIVELES_ORDER.indexOf(nivel);
                const basePct =
                  20 + (invertedIdx / (NIVELES_ORDER.length - 1)) * 80;
                const weightedPct =
                  count === 0
                    ? basePct * 0.4
                    : basePct * 0.5 + (count / maxCount) * basePct * 0.5;

                const styles = NIVEL_STYLES[nivel];

                return (
                  <div key={nivel} className="w-full flex items-center gap-4">
                    <div className="w-16 text-right shrink-0">
                      <span className={clsx("text-xs font-bold", styles.text)}>
                        {nivel}
                      </span>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div
                        className={clsx(
                          "flex items-center justify-between px-4 py-3 rounded-xl transition-all",
                          "bg-gradient-to-r text-white",
                          styles.bar,
                          count === 0 && "opacity-30",
                        )}
                        style={{
                          width: `${weightedPct}%`,
                          minWidth: "120px",
                          boxShadow:
                            count > 0 ? "0 3px 12px rgba(0,0,0,0.1)" : "none",
                        }}
                      >
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 flex-1 mr-2">
                          {count === 0 ? (
                            <span className="text-xs text-white/50 italic font-medium">
                              Sin personas
                            </span>
                          ) : (
                            groups[nivel].map((p) => (
                              <span
                                key={p.id}
                                className="text-xs font-semibold text-white/90"
                              >
                                {p.nombre.split(" ")[0]}
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
                <span>Junior / Designer</span>
                <span>Lead / Expert / Chief</span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden flex"
                style={{ background: "rgba(28,159,228,0.08)" }}
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
          <div className="space-y-4 w-full xl:w-60">
            {NIVELES_ORDER.map((nivel) => {
              const count = groups[nivel].length;
              const pct =
                personas.length > 0
                  ? Math.round((count / personas.length) * 100)
                  : 0;
              return (
                <div
                  key={nivel}
                  className={clsx("card", count === 0 && "opacity-40")}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={clsx("badge", NIVEL_COLOR[nivel])}>
                      {nivel}
                    </span>
                    <span className="text-2xl font-extrabold text-gray-900 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(28,159,228,0.08)" }}
                  >
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all",
                        NIVEL_STYLES[nivel].dot,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 font-medium">
                    {pct}% del equipo
                  </p>
                </div>
              );
            })}

            {/* KPI gradient cards */}
            <div
              className="rounded-2xl p-5 text-white"
              style={{
                background: "linear-gradient(135deg, #0f6690 0%, #1c9fe4 100%)",
                boxShadow: "0 4px 20px rgba(28,159,228,0.3)",
              }}
            >
              <p className="text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                Ratio Lead+
              </p>
              <p className="text-4xl font-extrabold tracking-tight">
                {Math.round((seniorPlus / Math.max(personas.length, 1)) * 100)}%
              </p>
              <p className="text-xs text-white/60 mt-1 font-medium">
                {seniorPlus} personas · Lead, Expert o Chief Designer
              </p>
            </div>

            <div
              className="rounded-2xl p-5 text-white"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
              }}
            >
              <p className="text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                Disponibles mentoría
              </p>
              <p className="text-4xl font-extrabold tracking-tight">
                {disponibles}
              </p>
              <p className="text-xs text-white/60 mt-1 font-medium">
                {Math.round((disponibles / Math.max(personas.length, 1)) * 100)}
                % del equipo
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
