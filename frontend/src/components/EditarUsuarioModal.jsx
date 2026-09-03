import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function EditarUsuarioModal({
  usuario,
  esUsuarioActual,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    rol: "viewer",
    activo: true,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;

    setForm({
      nombre: usuario.nombre ?? "",
      apellido: usuario.apellido ?? "",
      email: usuario.email ?? "",
      rol: usuario.rol ?? "viewer",
      activo: usuario.activo ?? true,
    });
  }, [usuario]);

  if (!usuario) return null;

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const obtenerToken = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(
        "Tu sesión no es válida. Vuelve a iniciar sesión."
      );
    }

    return session.access_token;
  };

  const guardarCambios = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const nombre = form.nombre.trim();
      const apellido = form.apellido.trim();
      const email = form.email.trim().toLowerCase();

      if (!nombre || !apellido || !email) {
        throw new Error(
          "Nombre, apellido y correo son obligatorios."
        );
      }

      if (esUsuarioActual && !form.activo) {
        throw new Error(
          "No puedes desactivar tu propia cuenta."
        );
      }

      if (
        esUsuarioActual &&
        form.rol !== "superadmin"
      ) {
        throw new Error(
          "No puedes quitarte el rol de Superadministrador."
        );
      }

      const accessToken = await obtenerToken();

      const response = await fetch(
        `${API_URL.replace(
          /\/$/,
          ""
        )}/api/usuarios/${usuario.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            nombre,
            apellido,
            email,
            rol: form.rol,
            activo: form.activo,
          }),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Tu sesión expiró. Vuelve a iniciar sesión."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "No tienes permisos para editar usuarios."
          );
        }

        if (response.status === 409) {
          throw new Error(
            "El correo ingresado ya está registrado."
          );
        }

        throw new Error(
          result?.detail ||
            "No fue posible actualizar el usuario."
        );
      }

      await onUpdated(result?.usuario);
    } catch (err) {
      setError(
        err?.message ||
          "No fue posible actualizar el usuario."
      );
    } finally {
      setSaving(false);
    }
  };

  const eliminarUsuario = async () => {
    if (esUsuarioActual) {
      setError(
        "No puedes eliminar tu propia cuenta."
      );
      return;
    }

    const nombreCompleto =
      `${usuario.nombre ?? ""} ${
        usuario.apellido ?? ""
      }`.trim();

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar a ${
        nombreCompleto || usuario.email
      }?\n\nEsta acción es permanente y eliminará también su cuenta de Supabase Auth.`
    );

    if (!confirmado) return;

    setDeleting(true);
    setError("");

    try {
      const accessToken = await obtenerToken();

      const response = await fetch(
        `${API_URL.replace(
          /\/$/,
          ""
        )}/api/usuarios/${usuario.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "No fue posible eliminar el usuario."
        );
      }

      await onDeleted(usuario);
    } catch (err) {
      setError(
        err?.message ||
          "No fue posible eliminar el usuario."
      );
    } finally {
      setDeleting(false);
    }
  };

  const bloqueado = saving || deleting;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Editar usuario
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Modifica los datos, rol y estado del usuario.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            className="text-xl text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardarCambios}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Nombre */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Nombre
                </label>

                <input
                  name="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={handleChange}
                  disabled={bloqueado}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Apellido
                </label>

                <input
                  name="apellido"
                  type="text"
                  value={form.apellido}
                  onChange={handleChange}
                  disabled={bloqueado}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* Correo */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Correo
                </label>

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={bloqueado}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Rol
                </label>

                <select
                  name="rol"
                  value={form.rol}
                  onChange={handleChange}
                  disabled={
                    bloqueado || esUsuarioActual
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                >
                  <option value="viewer">
                    Lector
                  </option>

                  <option value="editor">
                    Usuario
                  </option>

                  <option value="admin">
                    Administrador
                  </option>

                  <option value="superadmin">
                    Superadministrador
                  </option>
                </select>

                {esUsuarioActual && (
                  <p className="mt-1 text-xs text-slate-400">
                    No puedes modificar tu propio rol.
                  </p>
                )}
              </div>

              {/* Estado */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Estado
                </label>

                <select
                  name="activo"
                  value={
                    form.activo ? "true" : "false"
                  }
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      activo:
                        event.target.value === "true",
                    }))
                  }
                  disabled={
                    bloqueado || esUsuarioActual
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                >
                  <option value="true">
                    Activo
                  </option>

                  <option value="false">
                    Inactivo
                  </option>
                </select>

                {esUsuarioActual && (
                  <p className="mt-1 text-xs text-slate-400">
                    No puedes desactivar tu propia cuenta.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* Zona de peligro */}
            {!esUsuarioActual && (
              <div className="mt-8 border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold text-slate-900">
                  Zona de peligro
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Eliminar un usuario borra también su
                  cuenta de autenticación.
                </p>

                <button
                  type="button"
                  onClick={eliminarUsuario}
                  disabled={bloqueado}
                  className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting
                    ? "Eliminando..."
                    : "Eliminar usuario"}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={bloqueado}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={bloqueado}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}