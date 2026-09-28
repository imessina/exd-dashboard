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

    const validarAccesoInicial = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !session) {
          setSession(null);
          setAuthorizedUser(null);
          return;
        }

        setSession(session);

        const usuario = await getAuthorizedUser();

        if (!mounted) return;

        setAuthorizedUser(usuario);
      } catch (error) {
        console.error("Error validando acceso inicial:", error);

        if (!mounted) return;

        setSession(null);
        setAuthorizedUser(null);
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    };

    validarAccesoInicial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, nuevaSession) => {
        if (!mounted) return;

        console.log("AUTH STATE CHANGE:", event);

        if (!nuevaSession) {
          setSession(null);
          setAuthorizedUser(null);
          return;
        }

        setSession(nuevaSession);

        /*
          Importante:
          No volvemos a activar el loader global.

          Eventos como TOKEN_REFRESHED, SIGNED_IN o INITIAL_SESSION
          pueden ocurrir mientras el usuario ya está trabajando.

          Si activáramos el loader aquí, desmontaríamos toda la app
          innecesariamente.
        */
        try {
          const usuario = await getAuthorizedUser();

          if (!mounted) return;

          setAuthorizedUser(usuario);
        } catch (error) {
          console.error(
            "Error actualizando usuario autorizado:",
            error
          );
        }
      }
    );

    return () => {
      mounted = false;
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

  if (!authorizedUser || !authorizedUser.activo) {
    return <Navigate to="/login" replace />;
  }

  return children;
}