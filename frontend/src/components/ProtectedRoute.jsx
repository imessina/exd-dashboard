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
    return <div>Cargando...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!authorizedUser || !authorizedUser.activo) {
    return <Navigate to="/login" replace />;
  }

  return children;
}