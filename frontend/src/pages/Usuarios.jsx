import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import EditarUsuarioModal from "../components/EditarUsuarioModal";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const FORM_INICIAL = {
  nombre: "",
  apellido: "",
  email: "",
  rol: "viewer",
};

const ROLE_LABELS = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  editor: "Usuario",
  viewer: "Lector",
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  const [currentAuthUserId, setCurrentAuthUserId] =
    useState(null);

  const [usuarioEditando, setUsuarioEditando] =
    useState(null);

  const cargarUsuarioActual = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentAuthUserId(user?.id ?? null);
  }, []);

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("usuarios_autorizados")
      .select(`
        id,
        auth_user_id,
        email,
        nombre,
        apellido,
        rol,
        activo
      `)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setUsuarios([]);
    } else {
      setUsuarios(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    cargarUsuarioActual();
    cargarUsuarios();
  }, [cargarUsuarioActual, cargarUsuarios]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const cerrarFormulario = () => {
    if (creating) return;

    setShowForm(false);
    setForm(FORM_INICIAL);
    setFormError("");
  };

  const crearUsuario = async (event) => {
    event.preventDefault();

    setCreating(true);
    setFormError("");
    setSuccess("");
    setActionError("");

    try {
      const nombre = form.nombre.trim();
      const apellido = form.apellido.trim();
      const email = form.email.trim().toLowerCase();

      if (!nombre || !apellido || !email) {
        setFormError(
          "Nombre, apellido y correo son obligatorios."
        );
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setFormError(
          "Tu sesión no es válida. Vuelve a iniciar sesión."
        );
        return;
      }

      const response = await fetch(
        `${API_URL.replace(/\/$/, "")}/api/usuarios/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nombre,
            apellido,
            email,
            rol: form.rol,
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
            "No tienes permisos para crear usuarios."
          );
        }

        if (response.status === 409) {
          throw new Error(
            "El usuario ya está registrado."
          );
        }

        throw new Error(
          result?.detail ||
            "No fue posible crear el usuario."
        );
      }

      setSuccess(
        `Usuario ${nombre} ${apellido} creado correctamente. Se envió una invitación a ${email}.`
      );

      setForm(FORM_INICIAL);
      setShowForm(false);

      await cargarUsuarios();
    } catch (err) {
      setFormError(
        err?.message || "No fue posible crear el usuario."
      );
    } finally {
      setCreating(false);
    }
  };

  const usuarioActualizado = async () => {
    setUsuarioEditando(null);
    setActionError("");
    setSuccess("Usuario actualizado correctamente.");

    await cargarUsuarios();
  };

  const usuarioEliminado = async (usuario) => {
    setUsuarioEditando(null);
    setActionError("");

    const nombreCompleto =
      `${usuario?.nombre ?? ""} ${
        usuario?.apellido ?? ""
      }`.trim();

    setSuccess(
      `Usuario ${
        nombreCompleto || usuario?.email || ""
      } eliminado correctamente.`
    );

    await cargarUsuarios();
  };

  return (
    <div className="w-full space-y-6 pb-8 pt-0 sm:space-y-8">
      {/* =====================================================
          BANNER
      ===================================================== */}
      <div className="relative min-h-[190px] overflow-hidden text-white sm:min-h-[170px]">
        {/* Misma imagen utilizada en Equipo */}
        <img
          src="/banner-personas.jpg"
          alt=""
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-0
            h-full
            w-full
            object-cover
          "
          style={{
            objectPosition: "center",
          }}
        />

        {/* Overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,18,40,0.88) 0%, rgba(6,18,40,0.72) 24%, rgba(6,18,40,0.34) 50%, rgba(6,18,40,0.10) 72%, rgba(6,18,40,0.03) 100%)",
          }}
        />

        {/* Profundidad inferior */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            boxShadow:
              "inset 0 -1px 0 rgba(125,211,252,0.10), inset 0 -26px 42px rgba(6,18,40,0.08)",
          }}
        />

        {/* Contenido banner */}
        <div
          className="
            relative
            z-10
            flex
            min-h-[190px]
            flex-col
            items-start
            justify-center
            gap-5
            px-4
            py-6

            sm:min-h-[170px]
            sm:flex-row
            sm:items-center
            sm:justify-between
            sm:px-6

            lg:px-8
          "
        >
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">
              Somos DX
            </p>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Administración de usuarios
            </h1>

            <p className="mt-1 text-sm font-medium text-white/70">
              Gestión de accesos y roles de Somos DX.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setFormError("");
              setSuccess("");
              setActionError("");
            }}
            className="
              w-full
              rounded-lg
              bg-sky-500
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-[0_8px_24px_rgba(14,165,233,0.22)]
              transition
              hover:bg-sky-600

              sm:w-auto
              sm:shrink-0
            "
          >
            + Agregar usuario
          </button>
        </div>
      </div>

      {/* =====================================================
          CONTENIDO
      ===================================================== */}
      <div className="space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Mensaje éxito */}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-700">
              {success}
            </p>
          </div>
        )}

        {/* Error general */}
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-600">
              {actionError}
            </p>
          </div>
        )}

        {/* =================================================
            CREAR USUARIO
        ================================================= */}
        {showForm && (
          <form
            onSubmit={crearUsuario}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Nuevo usuario
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  El usuario recibirá una invitación en su correo.
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarFormulario}
                disabled={creating}
                className="
                  self-start
                  text-sm
                  font-medium
                  text-slate-500
                  hover:text-slate-900
                  disabled:opacity-50

                  sm:self-auto
                "
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="nombre"
                  className="text-sm font-medium text-slate-700"
                >
                  Nombre
                </label>

                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={handleChange}
                  disabled={creating}
                  required
                  autoComplete="given-name"
                  className="
                    mt-1
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    px-3
                    py-2
                    text-sm
                    outline-none
                    transition
                    focus:border-sky-500
                    focus:ring-2
                    focus:ring-sky-100
                    disabled:bg-slate-100
                  "
                />
              </div>

              <div>
                <label
                  htmlFor="apellido"
                  className="text-sm font-medium text-slate-700"
                >
                  Apellido
                </label>

                <input
                  id="apellido"
                  name="apellido"
                  type="text"
                  value={form.apellido}
                  onChange={handleChange}
                  disabled={creating}
                  required
                  autoComplete="family-name"
                  className="
                    mt-1
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    px-3
                    py-2
                    text-sm
                    outline-none
                    transition
                    focus:border-sky-500
                    focus:ring-2
                    focus:ring-sky-100
                    disabled:bg-slate-100
                  "
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700"
                >
                  Correo
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={creating}
                  required
                  autoComplete="email"
                  className="
                    mt-1
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    px-3
                    py-2
                    text-sm
                    outline-none
                    transition
                    focus:border-sky-500
                    focus:ring-2
                    focus:ring-sky-100
                    disabled:bg-slate-100
                  "
                />
              </div>

              <div>
                <label
                  htmlFor="rol"
                  className="text-sm font-medium text-slate-700"
                >
                  Rol
                </label>

                <select
                  id="rol"
                  name="rol"
                  value={form.rol}
                  onChange={handleChange}
                  disabled={creating}
                  className="
                    mt-1
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2
                    text-sm
                    outline-none
                    transition
                    focus:border-sky-500
                    focus:ring-2
                    focus:ring-sky-100
                    disabled:bg-slate-100
                  "
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
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cerrarFormulario}
                disabled={creating}
                className="
                  rounded-lg
                  border
                  border-slate-300
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  disabled:opacity-50
                "
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={creating}
                className="
                  rounded-lg
                  bg-sky-500
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-sky-600
                  disabled:opacity-50
                "
              >
                {creating
                  ? "Creando..."
                  : "Crear usuario"}
              </button>
            </div>
          </form>
        )}

        {/* Cargando */}
        {loading && (
          <p className="text-sm text-slate-500">
            Cargando usuarios...
          </p>
        )}

        {/* Error listado */}
        {error && (
          <p className="text-sm text-red-600">
            Error: {error}
          </p>
        )}

        {/* =================================================
            USUARIOS
        ================================================= */}
        {!loading && !error && (
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Usuarios encontrados: {usuarios.length}
            </p>

            <div className="mt-4 space-y-2">
              {usuarios.map((usuario) => {
                const esUsuarioActual =
                  usuario.auth_user_id === currentAuthUserId;

                return (
                  <div
                    key={usuario.id}
                    className="
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      p-4
                      shadow-sm
                    "
                  >
                    <div
                      className="
                        flex
                        flex-col
                        gap-4

                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                      "
                    >
                      {/* Datos */}
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900">
                          {usuario.nombre}{" "}
                          {usuario.apellido ?? ""}
                        </p>

                        <p className="mt-1 break-all text-sm text-slate-600">
                          {usuario.email}
                        </p>

                        {esUsuarioActual && (
                          <p className="mt-1 text-xs font-medium text-sky-600">
                            Tu cuenta
                          </p>
                        )}
                      </div>

                      {/* Rol + Editar */}
                      <div
                        className="
                          flex
                          flex-col
                          gap-3

                          sm:flex-row
                          sm:items-center
                          sm:gap-5
                        "
                      >
                        <div className="sm:text-right">
                          <p className="text-xs font-semibold text-slate-600">
                            {ROLE_LABELS[usuario.rol] ??
                              usuario.rol}
                          </p>

                          <p
                            className={`mt-1 text-xs font-medium ${
                              usuario.activo
                                ? "text-emerald-600"
                                : "text-red-500"
                            }`}
                          >
                            {usuario.activo
                              ? "Activo"
                              : "Inactivo"}
                          </p>
                        </div>

                        {/* IMPORTANTE:
                            SE CONSERVA EDITAR
                        */}
                        <button
                          type="button"
                          onClick={() => {
                            setSuccess("");
                            setActionError("");
                            setUsuarioEditando(usuario);
                          }}
                          className="
                            rounded-lg
                            border
                            border-slate-300
                            px-4
                            py-2
                            text-xs
                            font-semibold
                            text-slate-700
                            transition
                            hover:bg-slate-50
                          "
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {usuarios.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
                  <p className="text-sm text-slate-400">
                    No hay usuarios para mostrar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          MODAL EDICIÓN
      ===================================================== */}
      {usuarioEditando && (
        <EditarUsuarioModal
          usuario={usuarioEditando}
          esUsuarioActual={
            usuarioEditando.auth_user_id ===
            currentAuthUserId
          }
          onClose={() =>
            setUsuarioEditando(null)
          }
          onUpdated={usuarioActualizado}
          onDeleted={usuarioEliminado}
        />
      )}
    </div>
  );
}