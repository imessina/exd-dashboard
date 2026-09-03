import { useEffect, useState } from "react";
import { getAuthorizedUser } from "./lib/authUser";
import SuperAdminRoute from "./components/SuperAdminRoute";
import EstablecerPassword from "./pages/EstablecerPassword";

import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";

import IdleSessionTimeout from "./components/IdleSessionTimeout";
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Personas from "./pages/Personas";
import Asignaciones from "./pages/Asignaciones";
import Proyectos from "./pages/Proyectos";
import Oportunidades from "./pages/Oportunidades";
import SkillMatrix from "./pages/SkillMatrix";
import Piramide from "./pages/Piramide";
import Usuarios from "./pages/Usuarios";
import Skills from "./pages/Skills";
import Curriculums from "./pages/Curriculums";
import Login from "./pages/Login";

import { supabase } from "./lib/supabase";
import DxAiChat from "./components/DxAiChat";

const AUTHORIZED_USER_CACHE_KEY =
  "somosdx_authorized_user";

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
};

const NAV = [
  {
    to: "/personas",
    label: "Equipo",
    icon: Icon.users,
  },
  {
    to: "/piramide",
    label: "Pirámide",
    icon: Icon.pyramid,
  },
  {
    to: "/skill-matrix",
    label: "Capacidades",
    icon: Icon.grid,
  },
  {
    to: "/curriculums",
    label: "Currículums",
    icon: Icon.document,
  },
];

function leerUsuarioCacheado() {
  try {
    const cached = sessionStorage.getItem(
      AUTHORIZED_USER_CACHE_KEY
    );

    if (!cached) return null;

    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function Sidebar({
  mobile = false,
  onNavigate,
}) {
  /*
    CLAVE:
    Primero intentamos cargar el usuario desde sessionStorage.

    Así, al hacer F5, el menú ya conoce el rol inmediatamente
    y "Usuarios" no aparece dos segundos después.
  */
  const [authorizedUser, setAuthorizedUser] =
    useState(() => leerUsuarioCacheado());

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const user =
          await getAuthorizedUser();

        if (!mounted) return;

        setAuthorizedUser(user);

        if (user) {
          sessionStorage.setItem(
            AUTHORIZED_USER_CACHE_KEY,
            JSON.stringify(user)
          );
        } else {
          sessionStorage.removeItem(
            AUTHORIZED_USER_CACHE_KEY
          );
        }
      } catch {
        /*
          No destruimos inmediatamente el cache visual.
          ProtectedRoute sigue siendo quien protege el acceso real.
        */
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const puedeGestionarUsuarios =
    authorizedUser?.rol === "superadmin" ||
    authorizedUser?.rol === "admin";

  const navItems = puedeGestionarUsuarios
    ? [
        ...NAV,
        {
          to: "/usuarios",
          label: "Usuarios",
          icon: Icon.users,
        },
      ]
    : NAV;

  const logout = async () => {
    sessionStorage.removeItem(
      AUTHORIZED_USER_CACHE_KEY
    );

    await supabase.auth.signOut();

    window.location.href =
      "/login";
  };

  return (
    <aside
      className={`
        relative
        flex
        h-dvh
        shrink-0
        flex-col
        overflow-hidden
        bg-[#051128]

        ${
          mobile
            ? "w-[250px] max-w-[84vw]"
            : "sticky top-0 z-20 w-[220px] 2xl:w-60"
        }
      `}
    >
      <style>{`
        @keyframes dxBotFloat {
          0% {
            transform: translateY(0px) rotate(-1deg);
          }

          50% {
            transform: translateY(-6px) rotate(1deg);
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

      {/* LOGO */}
      <div
        className={
          mobile
            ? "shrink-0 px-4 pb-4 pt-4"
            : "shrink-0 px-4 pb-4 pt-5 2xl:px-5"
        }
      >
        <img
          src="/logo.png"
          alt="NTT DATA"
          className={
            mobile
              ? `
                  mb-3
                  h-9
                  w-auto
                  max-w-[175px]
                  object-contain
                  object-left
                `
              : `
                  mb-3
                  h-10
                  w-auto
                  max-w-[185px]
                  object-contain
                  object-left
                  2xl:h-11
                `
          }
        />

        <h1
          className={
            mobile
              ? "text-base font-semibold text-white"
              : "text-base font-semibold text-white 2xl:text-lg"
          }
        >
          Somos DX
        </h1>
      </div>

      <div className="mx-4 shrink-0 border-t border-white/10" />

      {/* NAVEGACIÓN */}
      <nav className="shrink-0 space-y-1 px-3 py-4">
        {navItems.map(
          ({
            to,
            label,
            icon: IconComp,
          }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({
                isActive,
              }) =>
                isActive
                  ? `
                      flex
                      h-10
                      items-center
                      gap-3
                      rounded-lg
                      bg-brand-500
                      px-3
                      text-sm
                      font-semibold
                      text-white
                      transition
                    `
                  : `
                      flex
                      h-10
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      text-sm
                      font-medium
                      text-slate-300
                      transition
                      hover:bg-white/5
                      hover:text-white
                    `
              }
            >
              <IconComp className="h-[18px] w-[18px] shrink-0" />

              <span className="truncate">
                {label}
              </span>
            </NavLink>
          )
        )}
      </nav>

      {/* ROBOT */}
      <div
        className="
          flex
          min-h-0
          flex-1
          items-center
          justify-center
          overflow-hidden
          px-3
          py-3
        "
      >
        <img
          src="/robot-dx.png"
          alt="Robot DX NTT DATA"
          className={
            mobile
              ? `
                  h-auto
                  max-h-full
                  w-[90px]
                  max-w-full
                  select-none
                  object-contain
                  pointer-events-none
                `
              : `
                  h-auto
                  max-h-full
                  w-[115px]
                  max-w-full
                  select-none
                  object-contain
                  pointer-events-none

                  xl:w-[135px]
                  2xl:w-[175px]
                `
          }
          style={{
            animation:
              "dxBotFloat 4.6s ease-in-out infinite, dxBotGlow 4.6s ease-in-out infinite",
            transformOrigin:
              "center center",
          }}
        />
      </div>

      {/* USUARIO */}
      <div className="mx-4 shrink-0 border-t border-white/10" />

      <div className="shrink-0 px-4 py-3">
        <p className="text-[10px] font-medium text-slate-400">
          Bienvenido
        </p>

        <p className="mt-1 truncate text-[13px] font-semibold text-white">
          {authorizedUser
            ? `${authorizedUser.nombre} ${
                authorizedUser.apellido ?? ""
              }`.trim()
            : "Usuario"}
        </p>

        {authorizedUser?.rol && (
          <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-slate-500">
            {authorizedUser.rol}
          </p>
        )}
      </div>

      {/* CERRAR SESIÓN */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={logout}
          className="
            w-full
            rounded-lg
            border
            border-white/10
            px-3
            py-2
            text-left
            text-[13px]
            font-medium
            text-slate-300
            transition
            hover:bg-white/5
            hover:text-white
          "
        >
          Cerrar sesión
        </button>
      </div>

      {/* FOOTER */}
      {!mobile && (
        <div className="shrink-0 px-4 pb-3">
          <p className="text-[10px] text-slate-500">
            NTT DATA · DX 2026
          </p>
        </div>
      )}
    </aside>
  );
}

function MainLayout() {
  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  return (
    <>
      <IdleSessionTimeout />

      <div className="flex min-h-dvh w-full bg-surface">
        {/* SIDEBAR NOTEBOOK / ESCRITORIO */}
        <div className="hidden shrink-0 lg:block">
          <Sidebar />
        </div>

        {/* DRAWER CELULAR / TABLET */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[70] flex lg:hidden">
            <button
              type="button"
              className="
                absolute
                inset-0
                bg-slate-950/60
                backdrop-blur-[1px]
              "
              onClick={() =>
                setMobileMenuOpen(false)
              }
              aria-label="Cerrar menú"
            />

            <div className="relative z-10 h-full shadow-2xl">
              <Sidebar
                mobile
                onNavigate={() =>
                  setMobileMenuOpen(false)
                }
              />
            </div>
          </div>
        )}

        {/* CONTENIDO */}
        <main
          className="
            min-w-0
            w-full
            flex-1
            overflow-x-hidden
          "
        >
          {/* HEADER MÓVIL */}
          <div
            className="
              sticky
              top-0
              z-40
              flex
              h-16
              items-center
              justify-between
              border-b
              border-white/10
              bg-[linear-gradient(135deg,#051128_0%,#08274d_100%)]
              px-4
              shadow-[0_8px_24px_rgba(5,17,40,0.18)]
              sm:px-5
              lg:hidden
            "
          >
            <img
              src="/logo.png"
              alt="NTT DATA"
              className="
                h-9
                w-auto
                max-w-[170px]
                object-contain
                object-left
              "
            />

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(true)
              }
              className="
                inline-flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-white/15
                bg-white/10
                text-white
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
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          {/* RUTAS */}
          <Routes>
            <Route
              path="/"
              element={
                <Navigate
                  to="/personas"
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/usuarios"
              element={
                <SuperAdminRoute>
                  <Usuarios />
                </SuperAdminRoute>
              }
            />

            <Route
              path="/asignaciones"
              element={<Asignaciones />}
            />

            <Route
              path="/personas"
              element={<Personas />}
            />

            <Route
              path="/skill-matrix"
              element={<SkillMatrix />}
            />

            <Route
              path="/proyectos"
              element={<Proyectos />}
            />

            <Route
              path="/oportunidades"
              element={<Oportunidades />}
            />

            <Route
              path="/piramide"
              element={<Piramide />}
            />

            <Route
              path="/skills"
              element={<Skills />}
            />

            <Route
              path="/curriculums"
              element={<Curriculums />}
            />
          </Routes>
        </main>
      </div>

      <DxAiChat />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/establecer-password"
          element={<EstablecerPassword />}
        />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}