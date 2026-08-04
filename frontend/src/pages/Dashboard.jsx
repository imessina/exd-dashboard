import { useQuery } from "@tanstack/react-query";
import { dashboardApi, asignacionesApi, personasApi } from "../services/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Iconos de línea sobrios (sin emoji) — coherentes con el sidebar
const Icon = {
  users: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.8c1.6.3 2.8 1.7 2.8 3.4 0 1.7-1.2 3.1-2.8 3.4M19 14c2 .5 3.5 2.3 3.5 4.5" />
    </svg>
  ),
  calendar: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  unlock: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.2-2.4" />
    </svg>
  ),
  refresh: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M20 11a8 8 0 0 0-14.6-4.4M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.4M20 20v-5h-5" />
    </svg>
  ),
  rocket: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M12 2c3 1.5 5 5 5 9 0 2-1 4-2 5l-3 3-3-3c-1-1-2-3-2-5 0-4 2-7.5 5-9z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M8.5 15.5 6 21l4-2M15.5 15.5 18 21l-4-2" />
    </svg>
  ),
  alert: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4M12 17.5h.01" />
    </svg>
  ),
};

function formatearNombre(valor = "") {
  return String(valor)
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letra) => letra.toUpperCase());
}

function StatCard({ label, value, icon: IconComp, highlight }) {
  const tone =
    highlight === "danger"
      ? "text-red-600 bg-red-50"
      : highlight === "success"
        ? "text-emerald-600 bg-emerald-50"
        : "text-navy-500 bg-navy-50";

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">
          {label}
        </p>
        <span
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
        >
          <IconComp className="w-4 h-4" />
        </span>
      </div>
      <p
        className={`text-3xl font-bold tabular-nums leading-none tracking-tight ${
          highlight === "danger"
            ? "text-red-600"
            : highlight === "success"
              ? "text-emerald-600"
              : "text-gray-900"
        }`}
      >
        {value ?? <span className="text-gray-200">—</span>}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const fechaActual = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
  });

  const { data: liberaciones } = useQuery({
    queryKey: ["liberaciones", 14],
    queryFn: () => asignacionesApi.proximasLiberaciones(14),
  });

  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const personaMap = Object.fromEntries(
    personas.map((persona) => [persona.id, persona]),
  );

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
      {/* ── Hero section — navy con acento azul corporativo ─────────────── */}
      <div
        className="p-8 text-white relative overflow-hidden flex items-center justify-between gap-6"
        style={{
          background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <div className="relative">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
            Somos DX
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Vista Ejecutiva</h2>
          <p className="text-white/60 mt-1 font-medium text-sm">
            Vista general del equipo, proyectos y operación
          </p>
        </div>

        <div className="hidden sm:block text-right shrink-0">
          <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.16em]">
            Fecha actual
          </p>
          <p className="mt-1 text-sm font-semibold text-white/80 capitalize">
            {fechaActual}
          </p>
        </div>
      </div>

      {/* ── Contenido con margen lateral responsivo ───────── */}
      <div className="px-4 sm:px-6 lg:px-8 space-y-8">
        {/* ── KPI cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            label="Personas"
            value={summary?.total_personas}
            icon={Icon.users}
          />
          <StatCard
            label="Asignaciones activas"
            value={summary?.asignaciones_activas}
            icon={Icon.calendar}
          />
          <StatCard
            label="Liberaciones en 14 días"
            value={summary?.liberaciones_proximas}
            icon={Icon.unlock}
            highlight={
              summary?.liberaciones_proximas > 0 ? "success" : undefined
            }
          />
          <StatCard
            label="Proyectos activos"
            value={summary?.proyectos_activos}
            icon={Icon.refresh}
          />
          <StatCard
            label="Oportunidades de Proyectos"
            value={summary?.oportunidades_abiertas}
            icon={Icon.rocket}
          />
          <StatCard
            label="Proyectos en riesgo"
            value={summary?.proyectos_at_risk}
            icon={Icon.alert}
            highlight={summary?.proyectos_at_risk > 0 ? "danger" : undefined}
          />
        </div>

        {/* ── Próximas liberaciones ─────────────────────────── */}
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-navy-50 text-navy-500">
              <Icon.unlock className="w-4 h-4" />
            </span>
            <span className="text-base">Liberaciones próximas</span>
            <span className="text-xs font-semibold text-gray-400 ml-1">
              · 14 días
            </span>
          </h3>

          {!liberaciones?.length ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400 font-medium">
                Sin liberaciones en las próximas 2 semanas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 pr-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Persona
                    </th>
                    <th className="pb-3 pr-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Proyecto
                    </th>
                    <th className="pb-3 pr-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Liberación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liberaciones.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-brand-50/30 transition-colors"
                    >
                      <td className="py-3.5 pr-6 font-semibold text-gray-800">
                        {personaMap[a.persona_id]?.nombre ??
                          formatearNombre(a.persona_id)}
                      </td>
                      <td className="py-3.5 pr-6 text-gray-500">
                        {formatearNombre(a.proyecto_id)}
                      </td>
                      <td className="py-3.5 pr-6 text-gray-500">{a.cliente}</td>
                      <td className="py-3.5">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full
                                       bg-emerald-100 text-emerald-700 text-xs font-bold"
                        >
                          {format(new Date(a.fecha_liberacion), "dd MMM", {
                            locale: es,
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
