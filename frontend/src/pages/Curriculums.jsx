import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import Panel from "../components/Panel";
import { curriculumsApi, personasApi } from "../services/api";
import { OFERTAS_VALOR, OFERTA_SIN_ASIGNAR } from "../utils/constants";

function normalizar(valor = "") {
  return String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function tieneContenidoCurriculum(curriculum) {
  return Boolean(
    String(curriculum?.resumen_profesional ?? "").trim() ||
    (curriculum?.areas_especializacion ?? []).length ||
    (curriculum?.herramientas_tecnologias ?? []).length ||
    (curriculum?.clientes_asesorados ?? []).length ||
    (curriculum?.estudios_posgrados ?? []).length ||
    (curriculum?.idiomas ?? []).length ||
    (curriculum?.certificaciones ?? []).length ||
    (curriculum?.experiencias ?? []).length ||
    curriculum?.archivo_origen,
  );
}

function iniciales(nombre = "") {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

function fechaLegible(fecha) {
  if (!fecha) return "—";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(fecha));
  } catch {
    return "—";
  }
}

function valoresUnicos(valores = []) {
  const vistos = new Set();

  return valores.filter((valor) => {
    const limpio = String(valor ?? "").trim();
    const clave = normalizar(limpio);

    if (!limpio || vistos.has(clave)) return false;

    vistos.add(clave);
    return true;
  });
}

function ListaEtiquetas({ valores, vacio = "Sin información registrada" }) {
  const items = valoresUnicos(valores);

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{vacio}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SeccionDetalle({ titulo, children }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function listaATexto(valores = []) {
  return valoresUnicos(valores).join("\n");
}

function textoALista(texto = "") {
  return valoresUnicos(
    String(texto)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function experienciaVacia(orden) {
  return {
    titulo: "",
    cliente: "",
    proyecto: "",
    rol: "",
    descripcion: "",
    periodo: "",
    orden,
  };
}

function crearFormulario(curriculum) {
  const experiencias = [...(curriculum.experiencias ?? [])]
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
    .map((item, indice) => ({
      titulo: item.titulo ?? "",
      cliente: item.cliente ?? "",
      proyecto: item.proyecto ?? "",
      rol: item.rol ?? "",
      descripcion: item.descripcion ?? "",
      periodo: item.periodo ?? "",
      orden: indice + 1,
    }));

  if (experiencias.length === 0) {
    experiencias.push(experienciaVacia(1));
  }

  return {
    resumen_profesional: curriculum.resumen_profesional ?? "",
    areas_especializacion: listaATexto(curriculum.areas_especializacion),
    herramientas_tecnologias: listaATexto(curriculum.herramientas_tecnologias),
    clientes_asesorados: listaATexto(curriculum.clientes_asesorados),
    estudios_posgrados: listaATexto(curriculum.estudios_posgrados),
    idiomas: listaATexto(curriculum.idiomas),
    certificaciones: listaATexto(curriculum.certificaciones),
    requiere_revision: Boolean(curriculum.requiere_revision),
    activo: curriculum.activo !== false,
    experiencias,
  };
}

function CampoTexto({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder = "",
}) {
  const common =
    "input mt-1 w-full disabled:cursor-not-allowed disabled:bg-slate-100";

  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={common}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={common}
        />
      )}
    </label>
  );
}

export function EditorCurriculum({
  curriculum,
  onClose,
  onSaved,
  centered = false,
}) {
  const [form, setForm] = useState(() => crearFormulario(curriculum));
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    setForm(crearFormulario(curriculum));
    setMensaje("");
  }, [curriculum]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      curriculumsApi.updateByPersona(curriculum.persona_id, payload),
    onSuccess: (actualizado) => {
      setMensaje("Datos actualizados correctamente.");
      onSaved(actualizado);
    },
  });

  useEffect(() => {
    if (!centered) return undefined;

    const cerrarConEscape = (event) => {
      if (event.key === "Escape" && !mutation.isPending) onClose();
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [centered, mutation.isPending, onClose]);

  const actualizarCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setMensaje("");
  };

  const actualizarExperiencia = (indice, campo, valor) => {
    setForm((actual) => ({
      ...actual,
      experiencias: actual.experiencias.map((item, posicion) =>
        posicion === indice ? { ...item, [campo]: valor } : item,
      ),
    }));
    setMensaje("");
  };

  const agregarExperiencia = () => {
    setForm((actual) => ({
      ...actual,
      experiencias: [
        ...actual.experiencias,
        experienciaVacia(actual.experiencias.length + 1),
      ],
    }));
    setMensaje("");
  };

  const eliminarExperiencia = (indice) => {
    setForm((actual) => {
      const restantes = actual.experiencias
        .filter((_, posicion) => posicion !== indice)
        .map((item, posicion) => ({ ...item, orden: posicion + 1 }));

      return {
        ...actual,
        experiencias: restantes.length > 0 ? restantes : [experienciaVacia(1)],
      };
    });
    setMensaje("");
  };

  const guardar = (event) => {
    event.preventDefault();

    const experiencias = form.experiencias
      .filter((item) =>
        [
          item.titulo,
          item.cliente,
          item.proyecto,
          item.rol,
          item.descripcion,
          item.periodo,
        ].some((valor) => String(valor).trim()),
      )
      .map((item, indice) => ({
        titulo: item.titulo.trim() || null,
        cliente: item.cliente.trim() || null,
        proyecto: item.proyecto.trim() || null,
        rol: item.rol.trim() || null,
        descripcion: item.descripcion.trim() || null,
        periodo: item.periodo.trim() || null,
        orden: indice + 1,
      }));

    mutation.mutate({
      resumen_profesional: form.resumen_profesional.trim() || null,
      areas_especializacion: textoALista(form.areas_especializacion),
      herramientas_tecnologias: textoALista(form.herramientas_tecnologias),
      clientes_asesorados: textoALista(form.clientes_asesorados),
      estudios_posgrados: textoALista(form.estudios_posgrados),
      idiomas: textoALista(form.idiomas),
      certificaciones: textoALista(form.certificaciones),
      requiere_revision: false,
      activo: form.activo,
      experiencias,
    });
  };

  const error =
    mutation.error?.response?.data?.detail ||
    mutation.error?.message ||
    "No fue posible guardar los cambios.";

  const formulario = (
    <form onSubmit={guardar} className="space-y-7">
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
        Nombre, rol y capacidades se administran en sus mantenedores
        correspondientes. Aquí se edita solamente la información propia del
        currículum.
      </div>

      <CampoTexto
        label="Resumen profesional"
        value={form.resumen_profesional}
        onChange={(valor) => actualizarCampo("resumen_profesional", valor)}
        multiline
        rows={7}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <CampoTexto
          label="Áreas de especialización"
          value={form.areas_especializacion}
          onChange={(valor) => actualizarCampo("areas_especializacion", valor)}
          multiline
          rows={7}
          placeholder="Una por línea"
        />
        <CampoTexto
          label="Herramientas y tecnologías"
          value={form.herramientas_tecnologias}
          onChange={(valor) =>
            actualizarCampo("herramientas_tecnologias", valor)
          }
          multiline
          rows={7}
          placeholder="Una por línea"
        />
        <CampoTexto
          label="Clientes asesorados"
          value={form.clientes_asesorados}
          onChange={(valor) => actualizarCampo("clientes_asesorados", valor)}
          multiline
          rows={7}
          placeholder="Uno por línea"
        />
        <CampoTexto
          label="Estudios y posgrados"
          value={form.estudios_posgrados}
          onChange={(valor) => actualizarCampo("estudios_posgrados", valor)}
          multiline
          rows={7}
          placeholder="Uno por línea"
        />
        <CampoTexto
          label="Idiomas"
          value={form.idiomas}
          onChange={(valor) => actualizarCampo("idiomas", valor)}
          multiline
          rows={5}
          placeholder="Uno por línea"
        />
        <CampoTexto
          label="Certificaciones"
          value={form.certificaciones}
          onChange={(valor) => actualizarCampo("certificaciones", valor)}
          multiline
          rows={5}
          placeholder="Una por línea"
        />
      </div>

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Experiencias seleccionadas
        </h3>

        <div className="space-y-5">
          {form.experiencias.map((experiencia, indice) => (
            <div
              key={indice}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900">
                  Experiencia {indice + 1}
                </p>
                <button
                  type="button"
                  onClick={() => eliminarExperiencia(indice)}
                  className="btn-secondary !px-3 !py-1.5 !text-xs"
                >
                  Eliminar
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <CampoTexto
                    label="Título"
                    value={experiencia.titulo}
                    onChange={(valor) =>
                      actualizarExperiencia(indice, "titulo", valor)
                    }
                  />
                </div>
                <CampoTexto
                  label="Cliente"
                  value={experiencia.cliente}
                  onChange={(valor) =>
                    actualizarExperiencia(indice, "cliente", valor)
                  }
                />
                <CampoTexto
                  label="Proyecto"
                  value={experiencia.proyecto}
                  onChange={(valor) =>
                    actualizarExperiencia(indice, "proyecto", valor)
                  }
                />
                <CampoTexto
                  label="Rol"
                  value={experiencia.rol}
                  onChange={(valor) =>
                    actualizarExperiencia(indice, "rol", valor)
                  }
                />
                <CampoTexto
                  label="Periodo"
                  value={experiencia.periodo}
                  onChange={(valor) =>
                    actualizarExperiencia(indice, "periodo", valor)
                  }
                />
                <div className="md:col-span-2">
                  <CampoTexto
                    label="Descripción"
                    value={experiencia.descripcion}
                    onChange={(valor) =>
                      actualizarExperiencia(indice, "descripcion", valor)
                    }
                    multiline
                    rows={5}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarExperiencia}
          className="btn-secondary mt-4"
        >
          Agregar experiencia
        </button>
      </section>

      <div className="flex flex-wrap gap-5 rounded-xl border border-slate-200 p-4">
        <div className="w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Al guardar, el currículum pasará automáticamente a estado
          <strong> Actualizado</strong>.
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(event) =>
              actualizarCampo("activo", event.target.checked)
            }
          />
          Currículum activo
        </label>
      </div>

      {mutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {mensaje}
        </div>
      )}

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white py-4">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );

  if (centered) {
    return (
      <div
        className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] sm:p-6"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !mutation.isPending) {
            onClose();
          }
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="curriculum-editor-modal-title"
          className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
            <h2
              id="curriculum-editor-modal-title"
              className="min-w-0 truncate text-base font-bold text-slate-900"
            >
              Editar currículum — {curriculum.persona?.nombre || "Sin nombre"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Cerrar editor de currículum"
              title="Cerrar"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            {formulario}
          </div>
        </section>
      </div>
    );
  }

  return (
    <Panel
      title={`Editar currículum — ${curriculum.persona?.nombre || "Sin nombre"}`}
      onClose={onClose}
      width="xl"
    >
      {formulario}
    </Panel>
  );
}

export function DetalleCurriculum({
  curriculum,
  onClose,
  onEdit,
  onDownload,
  downloading = false,
  centered = false,
}) {
  const persona = curriculum.persona ?? {};
  const experiencias = [...(curriculum.experiencias ?? [])].sort(
    (a, b) => (a.orden ?? 99) - (b.orden ?? 99),
  );

  useEffect(() => {
    if (!centered) return undefined;

    const cerrarConEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [centered, onClose]);

  const contenido = (
    <div className="space-y-7">
      <div className="rounded-2xl bg-slate-900 p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">
            {iniciales(persona.nombre)}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">
              {persona.nombre || "Sin nombre"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-sky-300">
              {persona.rol || "Sin rol registrado"}
            </p>
            <p className="mt-1 text-xs text-white/55">
              N° {persona.numero_empleado || "—"}
              {persona.area ? ` · ${persona.area}` : ""}
            </p>
          </div>
        </div>
      </div>

      <SeccionDetalle titulo="Resumen profesional">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {curriculum.resumen_profesional || "Sin información registrada."}
        </p>
      </SeccionDetalle>

      <SeccionDetalle titulo="Áreas de especialización">
        <ListaEtiquetas valores={curriculum.areas_especializacion} />
      </SeccionDetalle>

      <SeccionDetalle titulo="Experiencias seleccionadas">
        {experiencias.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin experiencias registradas.
          </p>
        ) : (
          <div className="space-y-4">
            {experiencias.map((experiencia) => (
              <article
                key={experiencia.id || experiencia.orden}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="font-semibold text-slate-900">
                  {experiencia.titulo || "Experiencia sin título"}
                </p>

                {[
                  experiencia.cliente,
                  experiencia.proyecto,
                  experiencia.rol,
                  experiencia.periodo,
                ].filter(Boolean).length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      experiencia.cliente,
                      experiencia.proyecto,
                      experiencia.rol,
                      experiencia.periodo,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                {experiencia.descripcion && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {experiencia.descripcion}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </SeccionDetalle>

      <SeccionDetalle titulo="Capacidades">
        {(curriculum.skills ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Sin capacidades registradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {curriculum.skills.map((skill) => (
              <span
                key={`${skill.skill_id}-${skill.nivel}`}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900"
              >
                {skill.nombre}
                {skill.nivel != null ? ` · Nivel ${skill.nivel}` : ""}
              </span>
            ))}
          </div>
        )}
      </SeccionDetalle>

      <SeccionDetalle titulo="Herramientas y tecnologías">
        <ListaEtiquetas valores={curriculum.herramientas_tecnologias} />
      </SeccionDetalle>

      <SeccionDetalle titulo="Clientes asesorados">
        <ListaEtiquetas valores={curriculum.clientes_asesorados} />
      </SeccionDetalle>

      <SeccionDetalle titulo="Estudios y posgrados">
        <ListaEtiquetas valores={curriculum.estudios_posgrados} />
      </SeccionDetalle>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SeccionDetalle titulo="Idiomas">
          <ListaEtiquetas valores={curriculum.idiomas} />
        </SeccionDetalle>

        <SeccionDetalle titulo="Certificaciones">
          <ListaEtiquetas valores={curriculum.certificaciones} />
        </SeccionDetalle>
      </div>

      <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
        Última actualización: {fechaLegible(curriculum.updated_at)}
      </div>
    </div>
  );

  const acciones = (onEdit || onDownload) && (
    <div className="flex flex-wrap justify-end gap-3">
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || !tieneContenidoCurriculum(curriculum)}
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          title={
            tieneContenidoCurriculum(curriculum)
              ? "Descargar currículum en PDF"
              : "Completa el CV antes de descargarlo"
          }
        >
          {downloading ? "Generando…" : "Descargar PDF"}
        </button>
      )}

      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-primary">
          {tieneContenidoCurriculum(curriculum) ? "Editar CV" : "Completar CV"}
        </button>
      )}
    </div>
  );

  if (centered) {
    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] sm:p-6"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="curriculum-modal-title"
          className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
            <h2
              id="curriculum-modal-title"
              className="min-w-0 truncate text-base font-bold text-slate-900"
            >
              Currículum — {persona.nombre || "Sin nombre"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
              aria-label="Cerrar currículum"
              title="Cerrar"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            {contenido}
          </div>

          {acciones && (
            <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
              {acciones}
            </footer>
          )}
        </section>
      </div>
    );
  }

  return (
    <Panel
      title={`Currículum — ${persona.nombre || "Sin nombre"}`}
      onClose={onClose}
    >
      {contenido}
      {acciones && (
        <div className="sticky bottom-0 mt-7 border-t border-slate-100 bg-white py-4">
          {acciones}
        </div>
      )}
    </Panel>
  );
}

export default function Curriculums() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroOferta, setFiltroOferta] = useState("");
  const [mensajeGlobal, setMensajeGlobal] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [editando, setEditando] = useState(null);
  const [descargandoPdfId, setDescargandoPdfId] = useState(null);
  const [descargandoZip, setDescargandoZip] = useState(false);

  const {
    data: curriculums = [],
    isLoading: cargandoCurriculums,
    isError: errorCurriculums,
    error: detalleErrorCurriculums,
    refetch: recargarCurriculums,
  } = useQuery({
    queryKey: ["curriculums"],
    queryFn: () => curriculumsApi.list(),
  });

  const {
    data: personasEquipo = [],
    isLoading: cargandoPersonas,
    isError: errorPersonas,
    error: detalleErrorPersonas,
    refetch: recargarPersonas,
  } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const ofertasPorPersonaId = useMemo(
    () =>
      new Map(
        personasEquipo.map((persona) => [
          String(persona.id),
          String(persona.oferta_valor ?? "").trim(),
        ]),
      ),
    [personasEquipo],
  );

  const obtenerOfertaReal = (curriculum) => {
    const personaId = String(
      curriculum?.persona_id ?? curriculum?.persona?.id ?? "",
    );

    if (ofertasPorPersonaId.has(personaId)) {
      return ofertasPorPersonaId.get(personaId) || "";
    }

    return String(curriculum?.persona?.oferta_valor ?? "").trim();
  };

  const isLoading = cargandoCurriculums || cargandoPersonas;
  const isError = errorCurriculums || errorPersonas;
  const error = detalleErrorCurriculums || detalleErrorPersonas;
  const refetch = () =>
    Promise.all([recargarCurriculums(), recargarPersonas()]);

  const curriculumsOrdenados = useMemo(() => {
    const terminos = normalizar(search).split(/\s+/).filter(Boolean);

    return [...curriculums]
      .filter((curriculum) => {
        const persona = curriculum.persona ?? {};
        const ofertaValorReal = obtenerOfertaReal(curriculum);
        const contenido = normalizar(
          [
            persona.nombre,
            persona.rol,
            ofertaValorReal,
            persona.area,
            persona.numero_empleado,
            curriculum.resumen_profesional,
            ...(curriculum.areas_especializacion ?? []),
            ...(curriculum.herramientas_tecnologias ?? []),
            ...(curriculum.clientes_asesorados ?? []),
            ...(curriculum.skills ?? []).map((skill) => skill.nombre),
          ].join(" "),
        );

        const coincideBusqueda = terminos.every((termino) =>
          contenido.includes(termino),
        );

        const tieneContenido = tieneContenidoCurriculum(curriculum);
        const estado = !tieneContenido
          ? "sin_cv"
          : curriculum.requiere_revision
            ? "requiere_revision"
            : "actualizado";

        const coincideOferta =
          !filtroOferta ||
          (filtroOferta === OFERTA_SIN_ASIGNAR
            ? !ofertaValorReal
            : ofertaValorReal === filtroOferta);

        return (
          coincideBusqueda &&
          coincideOferta &&
          (filtroEstado === "todos" || filtroEstado === estado)
        );
      })
      .sort((a, b) =>
        String(a.persona?.nombre ?? "").localeCompare(
          String(b.persona?.nombre ?? ""),
          "es",
          { sensitivity: "base" },
        ),
      );
  }, [curriculums, search, filtroEstado, filtroOferta, ofertasPorPersonaId]);

  const curriculumsVisiblesConContenido = curriculumsOrdenados.filter(
    tieneContenidoCurriculum,
  );

  const todosVisiblesSeleccionados =
    curriculumsVisiblesConContenido.length > 0 &&
    curriculumsVisiblesConContenido.every((curriculum) =>
      selectedIds.includes(curriculum.id),
    );

  const descargarSeleccionados = async () => {
    if (selectedIds.length === 0) return;

    const personaIds = curriculums
      .filter((curriculum) => selectedIds.includes(curriculum.id))
      .map((curriculum) => curriculum.persona_id);

    if (personaIds.length === 0) return;

    try {
      setDescargandoZip(true);

      const response = await curriculumsApi.downloadZip(personaIds);
      const disposition = response.headers?.["content-disposition"] || "";
      const coincidencia = disposition.match(/filename="?([^"]+)"?/i);
      const nombreArchivo =
        coincidencia?.[1] || "curriculums_seleccionados.zip";

      const url = window.URL.createObjectURL(response.data);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      let detalle = error?.message || "No fue posible descargar el ZIP.";

      if (error?.response?.data instanceof Blob) {
        try {
          const texto = await error.response.data.text();
          const json = JSON.parse(texto);
          detalle = json?.detail?.mensaje || json?.detail || detalle;
        } catch {
          // Mantener el mensaje general si la respuesta no es JSON.
        }
      }

      window.alert(detalle);
    } finally {
      setDescargandoZip(false);
    }
  };

  const descargarPdf = async (curriculum) => {
    try {
      setDescargandoPdfId(curriculum.id);

      const response = await curriculumsApi.downloadPdf(curriculum.persona_id);

      const disposition = response.headers?.["content-disposition"] || "";
      const coincidencia = disposition.match(/filename="?([^"]+)"?/i);
      const nombrePersona = curriculum.persona?.nombre || "persona";
      const nombreDefecto = `CV_${nombrePersona
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}.pdf`;

      const nombreArchivo = coincidencia?.[1] || nombreDefecto;
      const url = window.URL.createObjectURL(response.data);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const detalle =
        error?.response?.data?.detail ||
        error?.message ||
        "No fue posible descargar el PDF.";
      window.alert(detalle);
    } finally {
      setDescargandoPdfId(null);
    }
  };

  const toggleCurriculum = (id) => {
    setSelectedIds((actual) =>
      actual.includes(id)
        ? actual.filter((item) => item !== id)
        : [...actual, id],
    );
  };

  const toggleTodos = () => {
    const visibles = curriculumsVisiblesConContenido.map(
      (curriculum) => curriculum.id,
    );

    if (todosVisiblesSeleccionados) {
      setSelectedIds((actual) => actual.filter((id) => !visibles.includes(id)));
      return;
    }

    setSelectedIds((actual) => Array.from(new Set([...actual, ...visibles])));
  };

  return (
    <div className="w-full space-y-8 pb-8 pl-[1px] pr-[2px] pt-0">
      <div className="relative min-h-[170px] overflow-hidden text-white">
        <img
          src="/banner-personas.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,18,40,0.90) 0%, rgba(6,18,40,0.72) 27%, rgba(6,18,40,0.32) 53%, rgba(6,18,40,0.08) 78%, rgba(6,18,40,0.02) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-[170px] flex-wrap items-center justify-between gap-4 px-8 py-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">
              Somos DX
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Currículums</h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {curriculums.length} personas disponibles · incluye usuarios sin
              CV
            </p>
          </div>

          <button
            type="button"
            disabled={selectedIds.length === 0 || descargandoZip}
            onClick={descargarSeleccionados}
            className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              selectedIds.length === 0
                ? "Selecciona uno o más currículums."
                : "Descargar PDFs individuales dentro de un ZIP."
            }
          >
            {descargandoZip
              ? "Generando ZIP…"
              : `Descargar seleccionados (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {mensajeGlobal && (
        <div className="fixed right-6 top-6 z-[100] rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-lg">
          {mensajeGlobal}
        </div>
      )}

      <div className="space-y-5 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o N° de empleado.... "
              className="input min-w-64 max-w-xl flex-1"
            />

            <select
              value={filtroEstado}
              onChange={(event) => setFiltroEstado(event.target.value)}
              className="input w-48 shrink-0 py-2 pr-8 text-sm"
              aria-label="Filtrar currículums por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="requiere_revision">Requiere revisión</option>
              <option value="actualizado">Actualizado</option>
              <option value="sin_cv">Sin CV</option>
            </select>

            <select
              value={filtroOferta}
              onChange={(event) => setFiltroOferta(event.target.value)}
              className="input w-64 shrink-0 py-2 pr-8 text-sm"
              aria-label="Filtrar currículums por oferta de valor"
            >
              <option value="">Todas las ofertas de valor</option>
              {OFERTAS_VALOR.map((oferta) => (
                <option key={oferta} value={oferta}>
                  {oferta}
                </option>
              ))}
              <option value={OFERTA_SIN_ASIGNAR}>Sin asignar</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
            <span className="font-bold text-slate-900">
              {curriculumsOrdenados.length}
            </span>{" "}
            personas visibles
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading && (
            <p className="py-12 text-center text-sm text-slate-400">
              Cargando currículums…
            </p>
          )}

          {isError && (
            <div className="px-6 py-12 text-center">
              <p className="font-semibold text-red-700">
                No fue posible cargar los currículums.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {error?.response?.data?.detail ||
                  error?.message ||
                  "Revisa que el backend esté iniciado y que VITE_API_URL sea correcto."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="btn-secondary mt-4"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={todosVisiblesSeleccionados}
                        onChange={toggleTodos}
                        aria-label="Seleccionar todos los currículums visibles"
                      />
                    </th>
                    <th className="px-4 py-3">Persona</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Oferta de Valor</th>
                    <th className="px-4 py-3">Experiencias</th>
                    <th className="px-4 py-3">Actualización</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {curriculumsOrdenados.map((curriculum) => {
                    const persona = curriculum.persona ?? {};
                    const tieneContenido = tieneContenidoCurriculum(curriculum);

                    return (
                      <tr
                        key={curriculum.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            disabled={!tieneContenido}
                            checked={
                              tieneContenido &&
                              selectedIds.includes(curriculum.id)
                            }
                            onChange={() => toggleCurriculum(curriculum.id)}
                            title={
                              tieneContenido
                                ? "Seleccionar currículum"
                                : "Completa el CV antes de descargarlo"
                            }
                            aria-label={`Seleccionar currículum de ${persona.nombre || "persona"}`}
                          />
                        </td>

                        <td className="min-w-64 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-white">
                              {iniciales(persona.nombre)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {persona.nombre || "Sin nombre"}
                              </p>
                              <p className="text-xs text-slate-400">
                                N° {persona.numero_empleado || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {persona.rol || "—"}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {obtenerOfertaReal(curriculum) || "Sin asignar"}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {(curriculum.experiencias ?? []).length}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {fechaLegible(curriculum.updated_at)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              "badge border",
                              !tieneContenido
                                ? "border-slate-200 bg-slate-100 text-slate-600"
                                : curriculum.requiere_revision
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-teal-200 bg-teal-50 text-teal-800",
                            )}
                          >
                            {!tieneContenido
                              ? "Sin CV"
                              : curriculum.requiere_revision
                                ? "Requiere revisión"
                                : "Actualizado"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end whitespace-nowrap">
                            <button
                              type="button"
                              className="btn-secondary !py-1.5 !text-xs"
                              onClick={() => setDetalle(curriculum)}
                            >
                              Ver CV
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {curriculumsOrdenados.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-slate-400"
                      >
                        No se encontraron currículums para esta búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detalle && (
        <DetalleCurriculum
          curriculum={detalle}
          centered
          onClose={() => setDetalle(null)}
          onEdit={() => {
            setEditando(detalle);
            setDetalle(null);
          }}
          onDownload={() => descargarPdf(detalle)}
          downloading={descargandoPdfId === detalle.id}
        />
      )}

      {editando && (
        <EditorCurriculum
          curriculum={editando}
          centered
          onClose={() => setEditando(null)}
          onSaved={(actualizado) => {
            queryClient.setQueryData(["curriculums"], (actuales = []) =>
              actuales.map((item) =>
                item.id === actualizado.id ? actualizado : item,
              ),
            );
            setDetalle((actual) =>
              actual?.id === actualizado.id ? actualizado : actual,
            );
            setEditando(null);
            setMensajeGlobal("Datos actualizados correctamente.");
            window.setTimeout(() => setMensajeGlobal(""), 3500);
          }}
        />
      )}
    </div>
  );
}
