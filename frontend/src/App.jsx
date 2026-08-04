import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Personas from "./pages/Personas";
import Asignaciones from "./pages/Asignaciones";
import Proyectos from "./pages/Proyectos";
import Oportunidades from "./pages/Oportunidades";
import SkillMatrix from "./pages/SkillMatrix";
import Piramide from "./pages/Piramide";
//import Carrera from "./pages/Carrera";
import Skills from "./pages/Skills";
import Curriculums from "./pages/Curriculums";

// Iconos de línea minimalistas (stroke, sin relleno) — look ejecutivo/corporativo
const Icon = {
  dashboard: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
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
  pyramid: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M12 3l9 17H3l9-17z" />
      <path d="M7.5 13.5h9M9.2 10.2h5.6" />
    </svg>
  ),
  chart: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M21 4v6h-6" />
    </svg>
  ),
  grid: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </svg>
  ),
  tag: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M20.6 12.3 12 20.9a2 2 0 0 1-2.8 0L3.1 14.8a2 2 0 0 1 0-2.8L11.7 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.1a2 2 0 0 1-.4 1.4z" />
      <circle cx="16.5" cy="7.5" r="1.3" />
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
  document: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
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
};

const NAV = [
  { to: "/", label: "Vista Ejecutiva", icon: Icon.dashboard },
  { to: "/asignaciones", label: "Asignaciones", icon: Icon.calendar },
  { to: "/personas", label: "Equipo", icon: Icon.users },
  { to: "/piramide", label: "Pirámide", icon: Icon.pyramid },
  //{ to: "/carrera", label: "Carrera", icon: Icon.chart },
  { to: "/skill-matrix", label: "Skill Matrix", icon: Icon.grid },
  { to: "/skills", label: "Skills", icon: Icon.tag },
  { to: "/curriculums", label: "Currículums", icon: Icon.document },
  { to: "/proyectos", label: "Proyectos", icon: Icon.refresh },
  { to: "/oportunidades", label: "Oportunidades", icon: Icon.rocket },
];

function Sidebar() {
  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-screen sticky top-0 z-20 relative"
      style={{
        background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        boxShadow: "1px 0 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-6 pb-5">
        <img
          src="/logo.png"
          alt="NTT DATA"
          className="h-14 w-auto max-w-[250px] object-contain object-left mb-4 -ml-4"
        />

        <h1 className="text-lg font-semibold text-white leading-none truncate">
          Somos DX
        </h1>
      </div>

      <div className="mx-5 h-px bg-white/10" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: IconComp }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              isActive
                ? "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand-500 text-white transition-colors duration-150"
                : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150"
            }
          >
            <IconComp className="w-[18px] h-[18px] shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mx-5 h-px bg-white/10" />

      {/* Footer */}
      <div className="px-5 py-4">
        <p className="text-[11px] text-slate-400 font-medium">NTT DATA · DX</p>
        <p className="text-[10px] text-slate-500 mt-0.5">2026</p>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <div className="flex min-h-screen w-full bg-surface">
        <Sidebar />
        <main className="flex-1 overflow-auto min-w-0 w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/asignaciones" element={<Asignaciones />} />
            <Route path="/personas" element={<Personas />} />
            <Route path="/skill-matrix" element={<SkillMatrix />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/oportunidades" element={<Oportunidades />} />
            <Route path="/piramide" element={<Piramide />} />
            {/* <Route path="/carrera" element={<Carrera />} /> */}
            <Route path="/skills" element={<Skills />} />
            <Route path="/curriculums" element={<Curriculums />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
