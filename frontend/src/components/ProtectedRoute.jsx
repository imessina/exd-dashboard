/** Valida la sesión y el perfil sin ejecutar consultas dentro del callback bloqueante de Supabase. */
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getAuthorizedUser } from "../lib/authUser";

export default function ProtectedRoute({ children }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    let refreshTimer;
    let revision = 0;

    const validarAccesoInicial = async () => {
      const currentRevision = ++revision;
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted || currentRevision !== revision) return;

        if (error || !session) {
          setSession(null);
          setAuthorizedUser(null);
          return;
        }

        setSession(session);

        const usuario = await getAuthorizedUser();

        if (!mounted || currentRevision !== revision) return;

        setAuthorizedUser(usuario);
      } catch (error) {
        console.error("Error validando acceso inicial:", error);

        if (!mounted || currentRevision !== revision) return;

        setSession(null);
        setAuthorizedUser(null);
      } finally {
        if (mounted && currentRevision === revision) {
          setInitialLoading(false);
        }
      }
    };

    validarAccesoInicial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, nuevaSession) => {
        if (!mounted) return;

        if (!nuevaSession) {
          revision += 1;
          clearTimeout(refreshTimer);
          setSession(null);
          setAuthorizedUser(null);
          setInitialLoading(false);
          return;
        }

        // Una respuesta de la sesión anterior no debe sobrescribir este evento.
        revision += 1;
        setSession(nuevaSession);

        // Supabase libera su bloqueo al retornar el callback. Revalida después,
        // conservando la pantalla visible y agrupando eventos consecutivos.
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(validarAccesoInicial, 0);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(refreshTimer);
      subscription.unsubscribe();
    };
  }, []);

  if (initialLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo-azul.png"
            alt="NTT DATA"
            className="h-auto w-[170px] object-contain"
          />

          <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />

          <p className="mt-5 text-sm font-medium text-slate-500">
            Cargando tu espacio de trabajo...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.user?.app_metadata?.must_change_password || authorizedUser?.must_change_password) {
    return <Navigate to="/cambiar-password-inicial" replace />;
  }

  if (!authorizedUser || !authorizedUser.activo) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
