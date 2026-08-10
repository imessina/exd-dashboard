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
  "Executive",
  "Top manager",
  "Top Leader",
  "Top Expert Leader",
  "Expert Lead",
  "Lead",
  "Key Contributor",
  "Contributor",
];

const NIVEL_WIDTH = {
  Executive: 100,
  "Top manager": 94,
  "Top Leader": 88,
  "Top Expert Leader": 82,
  "Expert Lead": 76,
  Lead: 70,
  "Key Contributor": 61,
  Contributor: 53,
};

const NIVEL_STYLES = {
  Executive: {
    gradient: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(2,6,23,1))",
    dot: "bg-slate-950",
    badge: "bg-slate-900 text-white",
  },
  "Top manager": {
    gradient:
      "linear-gradient(135deg, rgba(51,65,85,0.96), rgba(15,23,42,0.98))",
    dot: "bg-slate-700",
    badge: "bg-slate-700 text-white",
  },
  "Top Leader": {
    gradient:
      "linear-gradient(135deg, rgba(30,58,138,0.94), rgba(15,23,42,0.98))",
    dot: "bg-blue-900",
    badge: "bg-blue-950 text-blue-100",
  },
  "Top Expert Leader": {
    gradient:
      "linear-gradient(135deg, rgba(180,138,25,0.80), rgba(92,65,10,0.94))",
    dot: "bg-amber-700",
    badge: "bg-amber-100 text-amber-900 border border-amber-300/70",
  },
  "Expert Lead": {
    gradient:
      "linear-gradient(135deg, rgba(30,64,175,0.90), rgba(30,41,59,0.98))",
    dot: "bg-blue-800",
    badge: "bg-blue-800 text-blue-100",
  },
  Lead: {
    gradient:
      "linear-gradient(135deg, rgba(15,118,110,0.88), rgba(17,60,66,0.98))",
    dot: "bg-teal-800",
    badge: "bg-teal-800 text-teal-100",
  },
  "Key Contributor": {
    gradient:
      "linear-gradient(135deg, rgba(71,85,105,0.92), rgba(30,64,97,0.94))",
    dot: "bg-slate-600",
    badge: "bg-slate-200 text-slate-800",
  },
  Contributor: {
    gradient:
      "linear-gradient(135deg, rgba(148,163,184,0.88), rgba(71,85,105,0.94))",
    dot: "bg-slate-400",
    badge: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

function normalizarCategoria(valor = "") {
  return String(valor).trim().toLowerCase();
}

function porcentaje(cantidad, total) {
  return total > 0 ? Math.round((cantidad / total) * 100) : 0;
}

function calcularAntiguedadPromedio(personas = []) {
  const hoy = new Date();
  const antiguedades = personas
    .map((persona) => {
      if (!persona.fecha_ingreso_compania) return null;
      const ingreso = new Date(`${persona.fecha_ingreso_compania}T00:00:00`);
      if (Number.isNaN(ingreso.getTime()) || ingreso > hoy) return null;
      return (hoy - ingreso) / (365.2425 * 24 * 60 * 60 * 1000);
    })
    .filter((valor) => valor !== null);

  if (antiguedades.length === 0) return null;
  return (
    antiguedades.reduce((suma, valor) => suma + valor, 0) / antiguedades.length
  );
}

function formatearDecimal(valor) {
  return valor == null ? "—" : valor.toFixed(1).replace(".", ",");
}

function obtenerCumpleanosDelMes(personas = []) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const diaActual = hoy.getDate();

  return personas
    .map((persona) => {
      if (!persona.fecha_nacimiento) return null;

      const partes = String(persona.fecha_nacimiento).slice(0, 10).split("-");
      if (partes.length !== 3) return null;

      const mes = Number(partes[1]) - 1;
      const dia = Number(partes[2]);

      if (
        !Number.isInteger(mes) ||
        !Number.isInteger(dia) ||
        mes !== mesActual ||
        dia < 1 ||
        dia > 31
      ) {
        return null;
      }

      return {
        id: persona.id,
        nombre: persona.nombre,
        dia,
        esHoy: dia === diaActual,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre));
}

function nombreMesActual() {
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
  }).format(new Date());
}

function KpiCard({ titulo, valor, detalle, children, tone = "slate" }) {
  const tones = {
    slate: "from-slate-800 to-slate-700",
    teal: "from-teal-900 to-teal-700",
    blue: "from-blue-950 to-blue-800",
    amber: "from-amber-800 to-amber-600",
  };

  return (
    <div
      className={clsx(
        "rounded-xl p-4 text-white bg-gradient-to-br min-h-[150px] h-full",
        "border border-white/10 shadow-[0_4px_18px_rgba(15,23,42,0.18)]",
        tones[tone],
      )}
    >
      <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
        {titulo}
      </p>
      {valor != null && (
        <p className="text-3xl font-extrabold tracking-tight mt-2">{valor}</p>
      )}
      {detalle && (
        <p className="text-[11px] leading-4 text-white/65 mt-1 font-medium">
          {detalle}
        </p>
      )}
      {children}
    </div>
  );
}

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

  const sexos = personas.reduce(
    (acc, persona) => {
      const sexo = normalizarCategoria(persona.sexo);
      if (["f", "femenino", "mujer", "female"].includes(sexo))
        acc.femenino += 1;
      else if (["m", "masculino", "hombre", "male"].includes(sexo))
        acc.masculino += 1;
      else acc.sinInformar += 1;
      return acc;
    },
    { femenino: 0, masculino: 0, sinInformar: 0 },
  );

  const nacionalidades = personas.reduce((acc, persona) => {
    const nacionalidad = String(persona.nacionalidad || "").trim();
    if (!nacionalidad) return acc;
    acc[nacionalidad] = (acc[nacionalidad] || 0) + 1;
    return acc;
  }, {});

  const nacionalidadesOrdenadas = Object.entries(nacionalidades).sort(
    (a, b) => b[1] - a[1],
  );
  const totalConNacionalidad = nacionalidadesOrdenadas.reduce(
    (suma, [, cantidad]) => suma + cantidad,
    0,
  );
  const antiguedadPromedio = calcularAntiguedadPromedio(personas);
  const cumpleanosDelMes = obtenerCumpleanosDelMes(personas);
  const mesActual = nombreMesActual();

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-0 space-y-8 w-full">
      <div className="relative min-h-[170px] overflow-hidden text-white">
        <img
          src="/banner-personas.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,18,40,0.90) 0%, rgba(6,18,40,0.72) 27%, rgba(6,18,40,0.32) 53%, rgba(6,18,40,0.08) 78%, rgba(6,18,40,0.02) 100%)",
          }}
        />
        <div className="relative z-10 flex min-h-[170px] items-center px-8 py-6">
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
              Somos DX
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              Pirámide del Equipo
            </h2>
            <p className="text-sm text-white/70 mt-1 font-medium">
              {personas.length} personas · distribución por segmento
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-5 py-0 min-h-[calc(100dvh-132px)]">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 xl:gap-6 items-start w-full">
            {/* ── Pirámide visual ─────────────────────────────────────────── */}
            <div className="card min-w-0 w-full h-full !p-4 sm:!p-6 xl:!p-7">
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
                            minWidth:
                              nivel === "Contributor" ? "200px" : "180px",
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
                  <span>Contributor / Key Contributor</span>
                  <span>
                    Lead / Expert Lead / Top Leader / Top Expert Leader / Top
                    manager / Executive
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 w-full auto-rows-max content-start self-start">
              {/* KPI ejecutivos */}
              <KpiCard titulo="Distribución por sexo" tone="blue">
                <div className="mt-3 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                      {porcentaje(sexos.femenino, personas.length)}%
                    </span>
                    <span className="text-3xl font-black text-cyan-200">F</span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                      {porcentaje(sexos.masculino, personas.length)}%
                    </span>
                    <span className="text-3xl font-black text-white/85">M</span>
                  </div>
                </div>

                <div className="mt-4 h-2 rounded-full overflow-hidden flex bg-white/15">
                  <div
                    className="h-full bg-cyan-300/90"
                    style={{
                      width: `${porcentaje(sexos.femenino, personas.length)}%`,
                    }}
                  />
                  <div
                    className="h-full bg-white/70"
                    style={{
                      width: `${porcentaje(sexos.masculino, personas.length)}%`,
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-white/55">
                  <span>Femenino</span>
                  <span>Masculino</span>
                </div>

                {sexos.sinInformar > 0 && (
                  <p className="text-[10px] text-white/55 mt-2">
                    {sexos.sinInformar} sin informar
                  </p>
                )}
              </KpiCard>

              <KpiCard
                titulo="Nacionalidades"
                tone="slate"
                valor={nacionalidadesOrdenadas.length || "—"}
              >
                {nacionalidadesOrdenadas.length === 0 ? (
                  <p className="mt-3 text-[11px] font-medium text-white/60">
                    Sin información registrada
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {nacionalidadesOrdenadas.map(([nombre, cantidad]) => (
                      <div
                        key={nombre}
                        className="flex items-center justify-between gap-3 text-[10px] text-white/75"
                      >
                        <span className="min-w-0 break-words">{nombre}</span>
                        <span className="shrink-0 font-bold tabular-nums text-white/90">
                          {porcentaje(cantidad, totalConNacionalidad)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </KpiCard>

              <KpiCard
                titulo="Antigüedad promedio"
                tone="amber"
                valor={`${formatearDecimal(antiguedadPromedio)} años`}
                detalle={
                  antiguedadPromedio == null
                    ? "Sin fechas de ingreso registradas"
                    : "Promedio calculado desde la fecha de ingreso a la compañía"
                }
              />
              <div className="w-full" style={{ gridColumn: "1 / -1" }}>
                <KpiCard titulo={`Cumpleaños de ${mesActual}`} tone="slate">
                  <div className="mt-3">
                    {cumpleanosDelMes.length === 0 ? (
                      <p className="text-sm font-semibold text-white/65">
                        Sin cumpleaños durante este mes
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <p className="text-3xl font-extrabold tracking-tight leading-none">
                            {cumpleanosDelMes.length}
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55 leading-3">
                            {cumpleanosDelMes.length === 1
                              ? "persona este mes"
                              : "personas este mes"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {cumpleanosDelMes.map((persona) => (
                            <div
                              key={persona.id}
                              className={clsx(
                                "flex items-center gap-2 rounded-lg px-3 py-2 min-w-0",
                                persona.esHoy
                                  ? "bg-cyan-300/15 border border-cyan-200/30"
                                  : "bg-white/7 border border-white/10",
                              )}
                            >
                              <span
                                className={clsx(
                                  "shrink-0 text-[11px] font-extrabold tabular-nums",
                                  persona.esHoy
                                    ? "text-cyan-200"
                                    : "text-white",
                                )}
                              >
                                {String(persona.dia).padStart(2, "0")} de{" "}
                                {mesActual.slice(0, 3)}
                              </span>

                              <span className="text-white/35">·</span>

                              <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/85">
                                {persona.nombre}
                              </p>

                              {persona.esHoy && (
                                <span className="shrink-0 rounded-full bg-cyan-200 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-slate-950">
                                  Hoy
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </KpiCard>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
