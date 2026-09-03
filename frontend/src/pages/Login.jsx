import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    navigate("/personas", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-slate-50 xl:h-dvh xl:overflow-hidden">
      <div className="grid min-h-dvh xl:h-dvh xl:grid-cols-[1.02fr_0.98fr]">
        {/* PANEL IZQUIERDO */}
        <section
          className="
            relative
            hidden
            overflow-hidden
            bg-[#000C2E]
            xl:flex
            xl:h-dvh
            xl:flex-col
          "
        >
          <div className="absolute inset-0 bg-[#000C2E]" />

          <div
            className="
              relative
              z-10
              flex
              h-full
              flex-col
              justify-center
              px-10
              py-6
              2xl:px-14
            "
          >
            <div className="mx-auto w-full max-w-2xl">
              {/* Título */}
              <h1
                className="
                  text-4xl
                  font-bold
                  tracking-tight
                  text-white
                  2xl:text-6xl
                "
              >
                Somos{" "}
                <span className="text-sky-400">
                  DX
                </span>
              </h1>

              <div
                className="
                  mt-4
                  h-1
                  w-14
                  rounded-full
                  bg-sky-400
                  2xl:mt-6
                "
              />

              {/* Texto */}
              <p
                className="
                  mt-4
                  max-w-md
                  text-base
                  leading-7
                  text-slate-300
                  2xl:mt-6
                  2xl:text-lg
                  2xl:leading-8
                "
              >
                Plataforma interna para colaborar, compartir
                y transformar la experiencia digital.
              </p>

              {/* Imagen DX alineada hacia la izquierda */}
              <div
                className="
                  mt-3
                  flex
                  items-center
                  justify-start
                  2xl:mt-5
                "
              >
                <img
                  src="/dx-login.png"
                  alt="DX"
                  className="
                    h-auto
                    w-full
                    max-w-[520px]
                    object-contain

                    max-h-[48vh]
                    2xl:max-h-[52vh]

                    -translate-x-3
                    2xl:-translate-x-5

                    [mask-image:radial-gradient(ellipse_at_center,black_50%,black_68%,transparent_94%)]
                    [-webkit-mask-image:radial-gradient(ellipse_at_center,black_50%,black_68%,transparent_94%)]

                    [mask-repeat:no-repeat]
                    [-webkit-mask-repeat:no-repeat]

                    [mask-size:100%_100%]
                    [-webkit-mask-size:100%_100%]
                  "
                />
              </div>
            </div>
          </div>

          {/* Pie */}
          <div className="absolute bottom-6 left-8 z-20">
            <p className="text-xs text-slate-500">
              NTT DATA · DX 2026
            </p>
          </div>
        </section>

        {/* PANEL DERECHO */}
        <section
          className="
            flex
            min-h-dvh
            items-center
            justify-center
            bg-slate-50
            px-4
            py-6
            sm:px-6
            xl:h-dvh
            xl:min-h-0
            xl:px-8
            xl:py-4
          "
        >
          <div className="w-full max-w-md">
            {/* Logo móvil / tablet */}
            <div className="mb-6 flex justify-center xl:hidden">
              <img
                src="/logo-azul.png"
                alt="NTT DATA"
                className="h-auto w-[170px] object-contain"
              />
            </div>

            {/* TARJETA LOGIN */}
            <div
              className="
                rounded-3xl
                border
                border-slate-200
                bg-white
                p-6
                shadow-xl
                shadow-slate-200/60
                sm:p-8
                2xl:p-9
              "
            >
              {/* Encabezado */}
              <div className="text-center">
                <div className="flex justify-center">
                  <img
                    src="/logo-azul.png"
                    alt="NTT DATA"
                    className="
                      h-auto
                      w-[175px]
                      object-contain
                      2xl:w-[190px]
                    "
                  />
                </div>

                <div
                  className="
                    mx-auto
                    mt-5
                    h-1
                    w-10
                    rounded-full
                    bg-sky-400
                  "
                />

                <div
                  className="
                    mx-auto
                    mt-4
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-full
                    bg-sky-50
                  "
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6 text-sky-500"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                    />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>

                <p
                  className="
                    mt-4
                    text-sm
                    leading-6
                    text-slate-500
                  "
                >
                  Acceso seguro para colaboradores del equipo DX.
                </p>
              </div>

              {/* FORMULARIO */}
              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4 2xl:mt-7 2xl:space-y-5"
              >
                {/* CORREO */}
                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Correo
                  </label>

                  <div className="relative mt-2">
                    <div
                      className="
                        pointer-events-none
                        absolute
                        inset-y-0
                        left-0
                        flex
                        items-center
                        pl-4
                      "
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5 text-slate-400"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                        />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    </div>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      required
                      autoComplete="email"
                      placeholder="tu.correo@nttdata.com"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-300
                        bg-white
                        py-3
                        pl-12
                        pr-4
                        text-sm
                        text-slate-900
                        outline-none
                        transition

                        placeholder:text-slate-400

                        focus:border-sky-500
                        focus:ring-4
                        focus:ring-sky-100
                      "
                    />
                  </div>
                </div>

                {/* CONTRASEÑA */}
                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Contraseña
                  </label>

                  <div className="relative mt-2">
                    <div
                      className="
                        pointer-events-none
                        absolute
                        inset-y-0
                        left-0
                        flex
                        items-center
                        pl-4
                      "
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5 text-slate-400"
                      >
                        <rect
                          x="5"
                          y="10"
                          width="14"
                          height="10"
                          rx="2"
                        />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                    </div>

                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      required
                      autoComplete="current-password"
                      placeholder="Ingresa tu contraseña"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-300
                        bg-white
                        py-3
                        pl-12
                        pr-12
                        text-sm
                        text-slate-900
                        outline-none
                        transition

                        placeholder:text-slate-400

                        focus:border-sky-500
                        focus:ring-4
                        focus:ring-sky-100
                      "
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (prev) => !prev
                        )
                      }
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="
                        absolute
                        inset-y-0
                        right-0
                        flex
                        items-center
                        px-4
                        text-slate-400
                        transition
                        hover:text-slate-700
                      "
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                          <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a15 15 0 0 1-3 3.5" />
                          <path d="M6.6 6.6C4.4 8 3 10 3 10s3.5 5 9 5a10 10 0 0 0 4-.8" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" />
                          <circle
                            cx="12"
                            cy="12"
                            r="2"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* ERROR */}
                {error && (
                  <div
                    className="
                      rounded-xl
                      border
                      border-red-200
                      bg-red-50
                      px-4
                      py-3
                    "
                  >
                    <p className="text-sm font-medium text-red-600">
                      {error}
                    </p>
                  </div>
                )}

                {/* INGRESAR */}
                <button
                  type="submit"
                  disabled={loading}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-gradient-to-r
                    from-sky-500
                    to-blue-600
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white

                    shadow-lg
                    shadow-sky-500/20

                    transition

                    hover:from-sky-600
                    hover:to-blue-700

                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {loading
                    ? "Ingresando..."
                    : "Ingresar"}

                  {!loading && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  )}
                </button>
              </form>

              {/* PIE */}
              <div
                className="
                  mt-6
                  border-t
                  border-slate-200
                  pt-5
                  text-center
                  2xl:mt-8
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-center
                    gap-2
                    text-xs
                    font-medium
                    text-slate-500
                  "
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                  >
                    <path d="M12 3 5 6v5c0 4.8 3 8.2 7 10 4-1.8 7-5.2 7-10V6l-7-3Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>

                  Acceso restringido a usuarios autorizados.
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              NTT DATA · DX 2026
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}