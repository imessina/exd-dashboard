import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";

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

import DxAiChat from "./components/DxAiChat";

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
  { to: "/personas", label: "Equipo", icon: Icon.users },
  { to: "/piramide", label: "Pirámide", icon: Icon.pyramid },
  { to: "/skill-matrix", label: "Capacidades", icon: Icon.grid },
  { to: "/curriculums", label: "Currículums", icon: Icon.document },
];

function Sidebar({ mobile = false, onNavigate }) {
  return (
    <aside
      className={`w-60 shrink-0 flex flex-col h-screen relative overflow-hidden ${
        mobile ? "w-[280px] max-w-[86vw]" : "sticky top-0 z-20"
      }`}
      style={{
        background: "#051128",
      }}
    >
      <style>{`
        @keyframes dxBotFloat {
          0% {
            transform: translateY(0px) rotate(-1deg);
          }

          50% {
            transform: translateY(-8px) rotate(1deg);
          }

          100% {
            transform: translateY(0px) rotate(-1deg);
          }
        }

        @keyframes dxBotGlow {
          0% {
            filter: drop-shadow(
              0 6px 16px rgba(14, 165, 233, 0.12)
            );
          }

          50% {
            filter: drop-shadow(
              0 10px 24px rgba(14, 165, 233, 0.24)
            );
          }

          100% {
            filter: drop-shadow(
              0 6px 16px rgba(14, 165, 233, 0.12)
            );
          }
        }
      `}</style>

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

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: IconComp }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
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

      {/* Robot DX */}
      <div className="px-3 pb-3">
        <div className="mx-1 rounded-2xl bg-transparent">
          <div className="flex min-h-[250px] items-end justify-center px-2 py-2">
            <img
              src="/robot-dx.png"
              alt="Robot DX NTT DATA"
              className="w-full max-w-[190px] h-auto object-contain select-none pointer-events-none"
              style={{
                animation:
                  "dxBotFloat 4.6s ease-in-out infinite, dxBotGlow 4.6s ease-in-out infinite",
                transformOrigin: "center bottom",
              }}
            />
          </div>
        </div>
      </div>

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="flex min-h-screen w-full bg-surface">
        {/* Sidebar escritorio */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Drawer móvil */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[70] flex md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
            />

            <div className="relative z-10 h-full shadow-2xl">
              <Sidebar
                mobile
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto min-w-0 w-full md:-ml-px">
          {/* Header exclusivo para móvil */}
          <div
            className="
              sticky top-0 z-40
              flex h-16 items-center justify-between
              border-b border-white/10
              bg-[linear-gradient(135deg,#051128_0%,#08274d_100%)]
              px-4
              shadow-[0_8px_24px_rgba(5,17,40,0.18)]
              md:hidden
            "
          >
            <div className="flex min-w-0 items-center">
              <img
                src="/logo.png"
                alt="NTT DATA"
                className="h-9 w-auto max-w-[170px] object-contain object-left"
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="
                inline-flex h-10 w-10 items-center justify-center
                rounded-xl
                border border-white/15
                bg-white/10
                text-white
                shadow-sm
                backdrop-blur
                transition
                hover:bg-white/15
                active:scale-95
              "
              aria-label="Abrir menú"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          <Routes>
            <Route path="/" element={<Navigate to="/personas" replace />} />

            <Route path="/dashboard" element={<Dashboard />} />

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

      <DxAiChat />
    </BrowserRouter>
  );
}