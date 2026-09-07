import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getAuthorizedUser } from "../lib/authUser";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const validarAcceso = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error || !session) {
        setSession(null);
        setAuthorizedUser(null);
        setLoading(false);
        return;
      }

      setSession(session);

      const usuario = await getAuthorizedUser();

      if (!mounted) return;

      setAuthorizedUser(usuario);
      setLoading(false);
    };

    validarAcceso();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, nuevaSession) => {
        if (!mounted) return;

        setLoading(true);

        if (!nuevaSession) {
          setSession(null);
          setAuthorizedUser(null);
          setLoading(false);
          return;
        }

        setSession(nuevaSession);

        const usuario = await getAuthorizedUser();

        if (!mounted) return;

        setAuthorizedUser(usuario);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
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
