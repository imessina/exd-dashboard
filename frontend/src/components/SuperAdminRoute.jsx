import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthorizedUser } from "../lib/authUser";

export default function SuperAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorizedUser, setAuthorizedUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const user = await getAuthorizedUser();

        if (!mounted) return;

        setAuthorizedUser(user);
      } catch (error) {
        console.error(
          "Error validando permisos de administración:",
          error
        );

        if (!mounted) return;

        setAuthorizedUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-slate-50 px-4 lg:min-h-dvh">
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

  const puedeGestionarUsuarios =
    authorizedUser?.activo &&
    (
      authorizedUser.rol === "superadmin" ||
      authorizedUser.rol === "admin"
    );

  if (!puedeGestionarUsuarios) {
    return <Navigate to="/personas" replace />;
  }

  return children;
}