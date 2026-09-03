import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthorizedUser } from "../lib/authUser";


export default function SuperAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorizedUser, setAuthorizedUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getAuthorizedUser();

      setAuthorizedUser(user);
      setLoading(false);
    };

    loadUser();
  }, []);

  if (loading) {
    return <div>Cargando...</div>;
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