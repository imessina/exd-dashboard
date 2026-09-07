import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function RecuperarPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    const redirectTo = `${window.location.origin}/restablecer-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setError(
        error.message ||
          "No fue posible enviar el correo de recuperación."
      );
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="text-center">
            <div className="flex justify-center">
              <img
                src="/logo-azul.png"
                alt="NTT DATA"
                className="h-auto w-[175px] object-contain"
              />
            </div>

            <div className="mx-auto mt-5 h-1 w-10 rounded-full bg-sky-400" />

            <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
              {success ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6 text-emerald-500"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8.5 12 2.2 2.2 4.8-5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6 text-sky-500"
                  aria-hidden="true"
                >
                  <path d="M4 7.5 12 13l8-5.5" />
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M15.5 10.5a4 4 0 1 1-1.2 5.7" />
                  <path d="M15.5 10.5v3h-3" />
                </svg>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {success ? "Revisa tu correo" : "Recuperar contraseña"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {success
                ? "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña."
                : "Ingresa tu correo corporativo y te enviaremos un enlace para restablecer tu contraseña."}
            </p>
          </div>

          {success ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">
                  Solicitud enviada correctamente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-600 hover:to-blue-700"
              >
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="recovery-email"
                  className="text-sm font-semibold text-slate-700"
                >
                  Correo
                </label>

                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5 text-slate-400"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </div>

                  <input
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="tu.correo@nttdata.com"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-center text-sm font-semibold text-slate-500 transition hover:text-slate-700"
              >
                ← Volver al login
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          NTT DATA · DX 2026
        </p>
      </div>
    </div>
  );
}
