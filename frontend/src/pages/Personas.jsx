/** Gestiona Equipo, ofertas y acceso a CV; reutiliza consultas e índices para agilizar navegación y filtros. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { curriculumsApi, ofertasValorApi, personasApi } from "../services/api";
import { getAuthorizedUser } from "../lib/authUser";
import {
  NIVELES_PIRAMIDE,
  NIVEL_COLOR,
  OFERTA_SIN_ASIGNAR,
} from "../utils/constants";
import clsx from "clsx";
import Panel from "../components/Panel";
import TagInput from "../components/TagInput";
import SkillLevelSelector from "../components/SkillLevelSelector";
import {
  DetalleCurriculum,
  EditorCurriculum,
  tieneContenidoCurriculum,
} from "./Curriculums";

const CATEGORIAS_NIVEL = NIVELES_PIRAMIDE;

function normalizarTexto(valor = "") {
  return String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [year, month, day] = String(fecha).split("-");
  return year && month && day ? `${day}/${month}/${year}` : fecha;
}

const EMPTY = {
  nombre: "",
  rol: "",
  numero_empleado: "",
  fecha_ingreso_compania: "",
  fecha_nacimiento: "",
  nivel_piramide: "Contributor",
  estado_laboral: "Disponible",
  oferta_valor: "",
  responsable: "",
  anos_experiencia: "",
  habilidades: [],
  skillLevels: [],
  certificaciones: [],
  intereses: [],
  disponible_mentoria: false,
  portfolio_link: "",
};

// Gradient avatar colors based on name hash
const AVATAR_GRADIENTS = [
  "from-slate-700 to-slate-950",
  "from-blue-800 to-slate-950",
  "from-slate-600 to-blue-900",
  "from-teal-700 to-slate-900",
  "from-amber-700 to-slate-900",
  "from-cyan-800 to-slate-950",
];
function avatarGradient(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

// ── Formulario ───────────────────────────────────────────────────────────────
function PersonaForm({ initial, onClose, ofertasValor = [] }) {
  const qc = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState(
    initial
      ? {
          nombre: initial.nombre ?? "",
          rol: initial.rol ?? "",
          numero_empleado: initial.numero_empleado ?? "",
          fecha_ingreso_compania: initial.fecha_ingreso_compania ?? "",
          fecha_nacimiento: initial.fecha_nacimiento ?? "",
          nivel_piramide: initial.nivel_piramide ?? "Contributor",
          estado_laboral: initial.estado_laboral ?? "Disponible",
          oferta_valor: initial.oferta_valor ?? "",
          responsable: initial.responsable ?? "",
          anos_experiencia: initial.anos_experiencia ?? "",
          habilidades: initial.habilidades ?? [],
          skillLevels: [],
          certificaciones: initial.certificaciones ?? [],
          intereses: initial.intereses ?? [],
          disponible_mentoria: initial.disponible_mentoria ?? false,
          portfolio_link: initial.portfolio_link ?? "",
        }
      : { ...EMPTY },
  );

  const { data: nivelesIniciales, isLoading: cargandoNiveles } = useQuery({
    queryKey: ["persona-skills", initial?.id],
    queryFn: () => personasApi.skills(initial.id),
    enabled: Boolean(initial?.id),
  });

  useEffect(() => {
    if (!initial?.id || !Array.isArray(nivelesIniciales)) {
      return;
    }

    setForm((actual) => {
      const actuales = JSON.stringify(actual.skillLevels ?? []);
      const nuevos = JSON.stringify(nivelesIniciales);

      if (actuales === nuevos) {
        return actual;
      }

      return {
        ...actual,
        skillLevels: nivelesIniciales,
      };
    });
  }, [initial?.id, nivelesIniciales]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const done = (persona) => {
    qc.invalidateQueries({ queryKey: ["personas"] });
    qc.invalidateQueries({ queryKey: ["curriculums"] });
    qc.invalidateQueries({ queryKey: ["skill-matrix"] });
    qc.invalidateQueries({ queryKey: ["skill-gaps"] });

    if (persona?.id) {
      qc.invalidateQueries({
        queryKey: ["persona-skills", persona.id],
      });
    }

    onClose();
  };

  const remove = useMutation({
    mutationFn: () => personasApi.delete(initial.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["curriculums"] });
      qc.invalidateQueries({ queryKey: ["skill-matrix"] });
      qc.invalidateQueries({ queryKey: ["skill-gaps"] });
      onClose();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { skillLevels, ...personFields } = form;
      const ofertaSeleccionada = ofertasValor.find(
        (oferta) => oferta.nombre === form.oferta_valor,
      );

      const data = {
        ...personFields,
        oferta_valor: form.oferta_valor || null,
        responsable: form.oferta_valor
          ? ofertaSeleccionada?.responsable?.nombre ||
            form.responsable.trim() ||
            null
          : null,
        habilidades: skillLevels.map((item) => item.nombre),
        anos_experiencia:
          form.anos_experiencia !== "" ? Number(form.anos_experiencia) : null,
      };

      const numeroEmpleado = String(form.numero_empleado ?? "").trim();

      if (!initial && !numeroEmpleado) {
        throw new Error("El número de empleado es obligatorio.");
      }

      const persona = initial
        ? await personasApi.update(initial.id, data)
        : await personasApi.create({
            ...data,
            id: `emp-${numeroEmpleado}`,
          });

      await personasApi.replaceSkills(
        persona.id,
        skillLevels.map((item) => ({
          skill_id: item.skill_id,
          nivel: Number(item.nivel),
        })),
      );

      return persona;
    },
    onSuccess: done,
  });

  const busy = save.isPending || remove.isPending;
  const err = save.error || remove.error;

  const submit = (event) => {
    event.preventDefault();
    save.mutate();
  };

  const ofertaActual = ofertasValor.find(
    (oferta) => oferta.nombre === form.oferta_valor,
  );

  const ofertaActualExisteEnCatalogo = Boolean(ofertaActual);

  const ofertasFormulario = ofertasValor.filter(
    (oferta) => oferta.activa || oferta.nombre === form.oferta_valor,
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Nombre *</label>
          <input
            required
            className="input"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Rol *</label>
          <input
            required
            className="input"
            value={form.rol}
            onChange={(e) => set("rol", e.target.value)}
            placeholder="ej: UX Designer"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="form-label">N° de empleado {!initial && "*"}</label>
          <input
            required={!initial}
            inputMode="numeric"
            pattern="[0-9]+"
            className="input"
            value={form.numero_empleado}
            onChange={(e) =>
              set("numero_empleado", e.target.value.replace(/\D/g, ""))
            }
            placeholder="ej: 284356"
          />
        </div>
        <div>
          <label className="form-label">Fecha de ingreso</label>
          <input
            type="date"
            className="input"
            value={form.fecha_ingreso_compania}
            onChange={(e) => set("fecha_ingreso_compania", e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Fecha de nacimiento</label>
          <input
            type="date"
            className="input"
            value={form.fecha_nacimiento}
            onChange={(e) => set("fecha_nacimiento", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="form-label">Segmento</label>
          <select
            className="input"
            value={form.nivel_piramide}
            onChange={(e) => set("nivel_piramide", e.target.value)}
          >
            {NIVELES_PIRAMIDE.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Años de experiencia</label>
          <input
            type="number"
            min="0"
            className="input"
            value={form.anos_experiencia}
            onChange={(e) => set("anos_experiencia", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="form-label">Oferta de Valor</label>
          <select
            className="input"
            value={form.oferta_valor}
            onChange={(e) => {
              const nombre = e.target.value;
              const oferta = ofertasValor.find(
                (item) => item.nombre === nombre,
              );

              setForm((actual) => ({
                ...actual,
                oferta_valor: nombre,
                responsable: nombre
                  ? oferta?.responsable?.nombre || actual.responsable
                  : "",
              }));
            }}
          >
            <option value="">Sin asignar</option>

            {!ofertaActualExisteEnCatalogo && form.oferta_valor && (
              <option value={form.oferta_valor}>
                {form.oferta_valor} (valor actual)
              </option>
            )}

            {ofertasFormulario.map((oferta) => (
              <option key={oferta.id} value={oferta.nombre}>
                {oferta.nombre}
                {!oferta.activa ? " (inactiva)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Responsable de Oferta</label>
          <input
            className="input bg-slate-50"
            value={
              ofertaActual?.responsable?.nombre ||
              form.responsable ||
              "Sin responsable"
            }
            readOnly
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Se administra desde “Gestionar ofertas de valor”.
          </p>
        </div>
      </div>
      <div>
        <label className="form-label">Habilidades</label>
        {cargandoNiveles ? (
          <p className="text-xs text-gray-400 py-3">Cargando evaluaciones…</p>
        ) : (
          <SkillLevelSelector
            value={form.skillLevels}
            onChange={(value) => set("skillLevels", value)}
          />
        )}
      </div>
      <div>
        <label className="form-label">Certificaciones</label>
        <TagInput
          value={form.certificaciones}
          onChange={(v) => set("certificaciones", v)}
          placeholder="ej: Google UX Certificate"
        />
      </div>
      <div>
        <label className="form-label">Intereses</label>
        <TagInput
          value={form.intereses}
          onChange={(v) => set("intereses", v)}
          placeholder="ej: Motion Design"
        />
      </div>
      <div>
        <label className="form-label">Portfolio</label>
        <input
          type="url"
          className="input"
          value={form.portfolio_link}
          onChange={(e) => set("portfolio_link", e.target.value)}
          placeholder="https://..."
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.disponible_mentoria}
          onChange={(e) => set("disponible_mentoria", e.target.checked)}
          className="rounded"
        />
        Disponible para mentoría
      </label>
      {err && <p className="text-xs text-red-500">Error: {err.message}</p>}
      <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {initial &&
            (confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-red-600">
                  ¿Eliminar permanentemente?
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={busy}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  {remove.isPending ? "Eliminando..." : "Sí"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="text-xs text-gray-500 hover:underline disabled:opacity-50"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Eliminar persona
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {save.isPending
              ? "Guardando..."
              : initial
                ? "Guardar cambios"
                : "Crear persona"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Gestión de ofertas de valor ──────────────────────────────────────────────
function OfertaValorForm({ initial, personas, onCancel, onSaved }) {
  const qc = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? "",
    responsable_persona_id: initial?.responsable_persona_id ?? "",
    descripcion: initial?.descripcion ?? "",
    activa: initial?.activa ?? true,
  });

  const set = (key, value) =>
    setForm((actual) => ({ ...actual, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        nombre: form.nombre.trim(),
        responsable_persona_id: form.responsable_persona_id || null,
        descripcion: form.descripcion.trim() || null,
        activa: Boolean(form.activa),
      };

      return initial
        ? ofertasValorApi.update(initial.id, payload)
        : ofertasValorApi.create(payload);
    },
    onSuccess: (oferta) => {
      qc.invalidateQueries({ queryKey: ["ofertas-valor"] });
      qc.invalidateQueries({ queryKey: ["personas"] });
      onSaved(oferta);
    },
  });

  const remove = useMutation({
    mutationFn: () => ofertasValorApi.delete(initial.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ofertas-valor"] });
      qc.invalidateQueries({ queryKey: ["personas"] });
      onSaved(null);
    },
  });

  const error = save.error || remove.error;
  const detalleError = error?.response?.data?.detail || error?.message || null;

  const personasOrdenadas = [...personas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  const busy = save.isPending || remove.isPending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="space-y-5"
    >
      <div>
        <label className="form-label">Nombre de la oferta *</label>
        <input
          required
          className="input"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder="Ej: Mobile Platforms"
        />
      </div>

      <div>
        <label className="form-label">Responsable</label>
        <select
          className="input"
          value={form.responsable_persona_id}
          onChange={(e) => set("responsable_persona_id", e.target.value)}
        >
          <option value="">Sin responsable</option>
          {personasOrdenadas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
              {persona.rol ? ` — ${persona.rol}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Descripción</label>
        <textarea
          className="input min-h-[100px] resize-y"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          placeholder="Descripción opcional"
        />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.activa}
          onChange={(e) => set("activa", e.target.checked)}
          className="rounded"
        />
        Oferta activa
      </label>

      {initial && initial.personas_count > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Esta oferta tiene {initial.personas_count}{" "}
          {initial.personas_count === 1
            ? "persona asociada"
            : "personas asociadas"}
          . Puedes editarla o desactivarla, pero no eliminarla mientras tenga
          personas.
        </p>
      )}

      {detalleError && (
        <p className="text-xs text-red-500">Error: {detalleError}</p>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {initial &&
            initial.personas_count === 0 &&
            (confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-red-600">
                  ¿Eliminar esta oferta?
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={busy}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  {remove.isPending ? "Eliminando..." : "Sí"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="text-xs text-gray-500 hover:underline disabled:opacity-50"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Eliminar oferta
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={busy || !form.nombre.trim()}
            className="btn-primary"
          >
            {save.isPending
              ? "Guardando..."
              : initial
                ? "Guardar cambios"
                : "Crear oferta"}
          </button>
        </div>
      </div>
    </form>
  );
}

function GestionOfertasPanel({ ofertas, personas, onClose }) {
  const [editingOferta, setEditingOferta] = useState(null);
  const [creatingOferta, setCreatingOferta] = useState(false);

  const volverListado = () => {
    setEditingOferta(null);
    setCreatingOferta(false);
  };

  return (
    <Panel title="Gestionar ofertas de valor" onClose={onClose}>
      {editingOferta || creatingOferta ? (
        <OfertaValorForm
          initial={editingOferta}
          personas={personas}
          onCancel={volverListado}
          onSaved={volverListado}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Ofertas de valor
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Administra las ofertas de valor y sus responsables.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCreatingOferta(true)}
              className="btn-primary !text-xs !py-2 shrink-0"
            >
              + Nueva oferta
            </button>
          </div>

          <div className="space-y-2">
            {ofertas.map((oferta) => (
              <div
                key={oferta.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">
                        {oferta.nombre}
                      </p>
                      <span
                        className={clsx(
                          "badge",
                          oferta.activa
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {oferta.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">
                        Responsable:
                      </span>{" "}
                      {oferta.responsable?.nombre || "Sin responsable"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {oferta.personas_count}{" "}
                      {oferta.personas_count === 1 ? "persona" : "personas"}
                    </p>

                    {oferta.descripcion && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {oferta.descripcion}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingOferta(oferta)}
                    className="btn-secondary !text-xs !py-1.5 shrink-0"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}

            {ofertas.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No hay ofertas configuradas todavía.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Perfil completo ──────────────────────────────────────────────────────────
function PersonaPanel({ persona, onClose, onEdit, puedeEditar = false }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const { data: skillsEvaluadas = [] } = useQuery({
    queryKey: ["persona-skills", persona.id],
    queryFn: () => personasApi.skills(persona.id),
  });

  const del = useMutation({
    mutationFn: () => personasApi.delete(persona.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["skill-matrix"] });
      onClose();
    },
  });

  return (
    <Panel title={persona.nombre} onClose={onClose}>
      <div className="space-y-5">
        {/* Header con avatar */}
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-lg font-bold shrink-0",
              avatarGradient(persona.nombre),
            )}
            style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.20)" }}
          >
            {persona.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={clsx("badge", NIVEL_COLOR[persona.nivel_piramide])}
              >
                {persona.nivel_piramide ?? "Sin clasificar"}
              </span>
              {persona.anos_experiencia && (
                <span className="text-xs text-gray-400 font-medium">
                  {persona.anos_experiencia} años exp.
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{persona.rol}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              N° empleado
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {persona.numero_empleado || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Ingreso
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {formatearFecha(persona.fecha_ingreso_compania)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Nacimiento
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {formatearFecha(persona.fecha_nacimiento)}
            </p>
          </div>
        </div>

        {skillsEvaluadas.length > 0 && (
          <div>
            <p className="section-label mb-2">Capacidades evaluadas</p>
            <div className="space-y-1.5">
              {skillsEvaluadas.map((skill) => (
                <div
                  key={skill.skill_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {skill.nombre}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {skill.categoria || "Sin categoría"}
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                    {skill.nivel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {persona.certificaciones?.length > 0 && (
          <div>
            <p className="form-label">Certificaciones</p>
            <div className="flex flex-wrap gap-1.5">
              {persona.certificaciones.map((c) => (
                <span key={c} className="badge bg-amber-50 text-amber-700">
                  🏆 {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.intereses?.length > 0 && (
          <div>
            <p className="form-label">Intereses</p>
            <div className="flex flex-wrap gap-1.5">
              {persona.intereses.map((i) => (
                <span key={i} className="badge bg-purple-50 text-purple-700">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.portfolio_link && (
          <a
            href={persona.portfolio_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-brand-600 hover:text-brand-800 hover:underline block font-medium"
          >
            🔗 Ver portfolio
          </a>
        )}

        {persona.disponible_mentoria && (
          <p className="text-xs text-emerald-600 font-semibold">
            ✓ Disponible para mentoría
          </p>
        )}

        {persona.evaluacion_ultima &&
          typeof persona.evaluacion_ultima === "object" && (
            <div>
              <p className="form-label">Última evaluación</p>
              <div
                className="rounded-xl overflow-hidden text-xs"
                style={{ border: "1px solid rgba(28,159,228,0.12)" }}
              >
                {Object.entries(persona.evaluacion_ultima).map(
                  ([k, v], idx) => {
                    const isNull = v === null || v === undefined;
                    const isScoreMap = !isNull && typeof v === "object";

                    return (
                      <div
                        key={k}
                        className={idx % 2 === 0 ? "bg-white" : undefined}
                        style={
                          idx % 2 !== 0
                            ? { background: "rgba(28,159,228,0.04)" }
                            : {}
                        }
                      >
                        {/* Fila principal */}
                        <div className="flex items-start justify-between gap-3 px-3.5 py-2">
                          <span className="text-gray-400 capitalize shrink-0 w-28">
                            {k}
                          </span>
                          {isNull ? (
                            <span className="text-gray-300 font-medium">—</span>
                          ) : isScoreMap ? (
                            <span className="text-brand-500 font-semibold text-right">
                              {Object.keys(v).length} scores →
                            </span>
                          ) : (
                            <span className="font-semibold text-gray-700 text-right">
                              {String(v)}
                            </span>
                          )}
                        </div>

                        {/* Sub-tabla de scores si el valor es un mapa de habilidades */}
                        {isScoreMap && (
                          <div
                            className="mx-3 mb-2 rounded-lg overflow-hidden"
                            style={{
                              border: "1px solid rgba(28,159,228,0.10)",
                            }}
                          >
                            {Object.entries(v).map(([skill, score], si) => {
                              const numScore =
                                typeof score === "number"
                                  ? score
                                  : parseFloat(score);
                              const maxScore = 5;
                              const pct = isNaN(numScore)
                                ? 0
                                : Math.round((numScore / maxScore) * 100);
                              return (
                                <div
                                  key={skill}
                                  className="flex items-center gap-3 px-3 py-1.5"
                                  style={
                                    si % 2 === 0
                                      ? { background: "rgba(28,159,228,0.03)" }
                                      : {}
                                  }
                                >
                                  <span
                                    className="text-gray-500 flex-1 truncate"
                                    title={skill}
                                  >
                                    {skill}
                                  </span>
                                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:shrink-0">
                                    <div className="w-16 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          background:
                                            "linear-gradient(90deg, #127cba, #1c9fe4)",
                                        }}
                                      />
                                    </div>
                                    <span className="font-bold text-gray-700 w-8 text-right tabular-nums">
                                      {isNaN(numScore)
                                        ? String(score)
                                        : numScore}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

        {puedeEditar && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-red-600">
                  ¿Eliminar permanentemente?
                </span>
                <button
                  onClick={() => del.mutate()}
                  disabled={del.isPending}
                  className="text-xs text-red-600 font-semibold hover:underline"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                Eliminar persona
              </button>
            )}
            <button onClick={onEdit} className="btn-primary !text-xs !py-1.5">
              ✏️ Editar
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function PersonaCard({ persona, onClick }) {
  const skills = persona.habilidades ?? [];
  return (
    <button
      className="card text-left cursor-pointer w-full h-full flex flex-col border border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md group"
      onClick={onClick}
    >
      {/* Identidad: avatar + nombre + rol (nombre con espacio propio, sin competir con la categoría) */}
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-base font-bold shrink-0",
            avatarGradient(persona.nombre),
          )}
          style={{ boxShadow: "0 3px 10px rgba(15,23,42,0.18)" }}
        >
          {persona.nombre.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-[15px] leading-snug break-words">
            {persona.nombre}
          </p>
          {persona.rol && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {persona.rol}
            </p>
          )}
        </div>
      </div>

      {/* Segmento: fila propia, claramente legible */}
      <div className="mt-3">
        <span
          className={clsx(
            "badge",
            NIVEL_COLOR[persona.nivel_piramide] ?? "bg-gray-100 text-gray-600",
          )}
        >
          {persona.nivel_piramide ?? "Sin clasificar"}
        </span>
      </div>

      {/* Skills: con etiqueta para escanear rápido */}
      {skills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Capacidades
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((h) => (
              <span key={h} className="badge bg-brand-50 text-brand-500">
                {h}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="badge bg-gray-100 text-gray-500">
                +{skills.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pie: mentoría, anclado abajo para alinear las cards de una fila */}
      {persona.disponible_mentoria && (
        <p className="text-xs text-emerald-600 font-semibold mt-auto pt-3 flex items-center gap-1">
          <span aria-hidden>✓</span> Disponible para mentoría
        </p>
      )}
    </button>
  );
}

// ── Carga masiva ─────────────────────────────────────────────────────────────

const CSV_COLUMNAS = [
  "numero_empleado",
  "nombre",
  "rol",
  "nivel_piramide",
  "fecha_ingreso_compania",
  "fecha_nacimiento",
  "estado_laboral",
  "oferta_valor",
  "responsable",
  "empresa_actual",
  "area",
  "anos_experiencia",
  "certificaciones",
  "intereses",
  "disponible_mentoria",
  "portfolio_link",
];

const CSV_EJEMPLO = [
  CSV_COLUMNAS.join(","),
  '284356,Ana García,UX Designer,Contributor,2023-03-15,1990-07-22,Disponible,Digital Experience,María López,NTT DATA,Diseño,4,Design Thinking;Figma,UX Research;Accesibilidad,false,',
  '291045,Carlos Ruiz,Lead Engineer,Lead,2021-09-01,1988-11-10,Disponible,Technology,,NTT DATA,Desarrollo,7,React;Node.js,Backend;APIs,true,https://carlosruiz.dev',
].join("\n");

function descargarPlantillaCSV() {
  const blob = new Blob([CSV_EJEMPLO], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "plantilla_carga_masiva_personas.csv";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function parsearCSV(texto) {
  const lineas = texto.trim().split(/\r?\n/);
  if (lineas.length < 2) return { filas: [], error: "El archivo no tiene datos." };

  const encabezados = lineas[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const requeridos = ["numero_empleado", "nombre", "rol"];
  const faltantes = requeridos.filter((r) => !encabezados.includes(r));
  if (faltantes.length) {
    return {
      filas: [],
      error: `Faltan columnas obligatorias: ${faltantes.join(", ")}`,
    };
  }

  // Parseo simple que respeta campos entre comillas con comas internas.
  function splitFila(linea) {
    const resultado = [];
    let actual = "";
    let dentroComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        dentroComillas = !dentroComillas;
      } else if (ch === "," && !dentroComillas) {
        resultado.push(actual.trim());
        actual = "";
      } else {
        actual += ch;
      }
    }
    resultado.push(actual.trim());
    return resultado;
  }

  const filas = [];
  for (let i = 1; i < lineas.length; i++) {
    const valores = splitFila(lineas[i]);
    if (valores.every((v) => !v)) continue; // línea vacía

    const fila = {};
    encabezados.forEach((col, idx) => {
      fila[col] = valores[idx] ?? "";
    });

    filas.push({
      _linea: i + 1,
      numero_empleado: fila.numero_empleado || "",
      nombre: fila.nombre || "",
      rol: fila.rol || "",
      nivel_piramide: fila.nivel_piramide || null,
      fecha_ingreso_compania: fila.fecha_ingreso_compania || null,
      fecha_nacimiento: fila.fecha_nacimiento || null,
      estado_laboral: fila.estado_laboral || "Disponible",
      oferta_valor: fila.oferta_valor || null,
      responsable: fila.responsable || null,
      empresa_actual: fila.empresa_actual || null,
      area: fila.area || null,
      anos_experiencia: fila.anos_experiencia
        ? parseInt(fila.anos_experiencia, 10) || null
        : null,
      // Dentro de una columna, las listas usan punto y coma, igual que la plantilla.
      certificaciones: fila.certificaciones
        ? fila.certificaciones.split(";").map((s) => s.trim()).filter(Boolean)
        : [],
      intereses: fila.intereses
        ? fila.intereses.split(";").map((s) => s.trim()).filter(Boolean)
        : [],
      disponible_mentoria:
        String(fila.disponible_mentoria).toLowerCase() === "true",
      portfolio_link: fila.portfolio_link || null,
    });
  }

  return { filas, error: null };
}

function CargaMasivaPanel({ onClose, onSuccess }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const [paso, setPaso] = useState("upload"); // upload | preview | resultado
  const [filas, setFilas] = useState([]);
  const [parseError, setParseError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  function handleArchivo(archivo) {
    if (!archivo) return;
    if (!archivo.name.endsWith(".csv")) {
      setParseError("Solo se aceptan archivos .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const { filas: filasParseadas, error } = parsearCSV(e.target.result);
      if (error) {
        setParseError(error);
        setFilas([]);
      } else {
        setParseError("");
        setFilas(filasParseadas);
        setPaso("preview");
      }
    };
    reader.readAsText(archivo, "UTF-8");
  }

  function handleDrop(e) {
    e.preventDefault();
    const archivo = e.dataTransfer.files?.[0];
    handleArchivo(archivo);
  }

  async function confirmarEnvio() {
    setEnviando(true);
    setErrorEnvio("");
    try {
      // Quitar el campo interno _linea antes de enviar
      const payload = filas.map(({ _linea, ...rest }) => rest);
      const res = await personasApi.bulkCreate(payload);
      setResultado(res);
      setPaso("resultado");
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["skill-matrix"] });
      if (res.creadas > 0) onSuccess?.();
    } catch (err) {
      setErrorEnvio(
        err?.response?.data?.detail ||
          err?.message ||
          "No fue posible completar la carga masiva.",
      );
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setPaso("upload");
    setFilas([]);
    setParseError("");
    setResultado(null);
    setErrorEnvio("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const erroresValidacion = filas.filter(
    (f) => !f.numero_empleado || !f.nombre || !f.rol,
  );

  return (
    <Panel title="Carga masiva de personas" onClose={onClose}>
      <div className="space-y-5">
        {/* ── Pasos indicadores ── */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {["Subir archivo", "Revisar", "Resultado"].map((label, idx) => {
            const pasos = ["upload", "preview", "resultado"];
            const activo = pasos[idx] === paso;
            const completado = pasos.indexOf(paso) > idx;
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={clsx(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    activo && "bg-sky-500 text-white",
                    completado && "bg-emerald-500 text-white",
                    !activo && !completado && "bg-slate-200 text-slate-500",
                  )}
                >
                  {completado ? "✓" : idx + 1}
                </span>
                <span
                  className={clsx(
                    activo ? "text-slate-900" : "text-slate-400",
                  )}
                >
                  {label}
                </span>
                {idx < 2 && (
                  <span className="text-slate-300 select-none">›</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════
            PASO 1 — UPLOAD
        ══════════════════════════════════════════ */}
        {paso === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Sube un archivo <strong>.csv</strong> con una persona por fila.
              Las columnas obligatorias son{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">
                numero_empleado
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">nombre</code>{" "}
              y{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">rol</code>.
            </p>

            {/* Zona de drop */}
            <label
              htmlFor="csv-upload"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="
                flex cursor-pointer flex-col items-center justify-center gap-3
                rounded-xl border-2 border-dashed border-slate-300
                bg-slate-50 px-6 py-10 text-center
                transition hover:border-sky-400 hover:bg-sky-50
              "
            >
              <svg
                className="h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Arrastra tu CSV aquí o{" "}
                  <span className="text-sky-600 underline underline-offset-2">
                    selecciona un archivo
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Solo archivos .csv · UTF-8
                </p>
              </div>
              <input
                id="csv-upload"
                ref={inputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => handleArchivo(e.target.files?.[0])}
              />
            </label>

            {parseError && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 border border-red-200">
                {parseError}
              </p>
            )}

            <button
              type="button"
              onClick={descargarPlantillaCSV}
              className="flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-800 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 3v13.5m0 0l-4.5-4.5M12 16.5l4.5-4.5"
                />
              </svg>
              Descargar plantilla CSV
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PASO 2 — PREVIEW
        ══════════════════════════════════════════ */}
        {paso === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">
                Se encontraron{" "}
                <strong className="text-slate-900">{filas.length}</strong>{" "}
                {filas.length === 1 ? "persona" : "personas"} en el archivo.
              </p>
              <button
                type="button"
                onClick={reiniciar}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                ← Cambiar archivo
              </button>
            </div>

            {erroresValidacion.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">
                  {erroresValidacion.length}{" "}
                  {erroresValidacion.length === 1 ? "fila tiene" : "filas tienen"} campos obligatorios vacíos y serán omitidas.
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                  {erroresValidacion.slice(0, 5).map((f) => (
                    <li key={f._linea}>
                      Línea {f._linea}: numero_empleado="{f.numero_empleado}"
                      nombre="{f.nombre}" rol="{f.rol}"
                    </li>
                  ))}
                  {erroresValidacion.length > 5 && (
                    <li>…y {erroresValidacion.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Tabla preview */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Línea</th>
                    <th className="px-3 py-2 text-left font-semibold">N° empleado</th>
                    <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold">Rol</th>
                    <th className="px-3 py-2 text-left font-semibold">Segmento</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((f) => {
                    const invalida =
                      !f.numero_empleado || !f.nombre || !f.rol;
                    return (
                      <tr
                        key={f._linea}
                        className={clsx(
                          invalida
                            ? "bg-red-50 text-red-700"
                            : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <td className="px-3 py-2 text-slate-400">{f._linea}</td>
                        <td className="px-3 py-2 font-mono">{f.numero_empleado || <span className="italic text-red-400">vacío</span>}</td>
                        <td className="px-3 py-2">{f.nombre || <span className="italic text-red-400">vacío</span>}</td>
                        <td className="px-3 py-2">{f.rol || <span className="italic text-red-400">vacío</span>}</td>
                        <td className="px-3 py-2 text-slate-500">{f.nivel_piramide || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{f.estado_laboral}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errorEnvio && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 border border-red-200">
                {errorEnvio}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={reiniciar}
                disabled={enviando}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEnvio}
                disabled={enviando || filas.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {enviando ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Importando…
                  </span>
                ) : (
                  `Confirmar importación (${filas.length - erroresValidacion.length} válidas)`
                )}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PASO 3 — RESULTADO
        ══════════════════════════════════════════ */}
        {paso === "resultado" && resultado && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{resultado.creadas}</p>
                <p className="text-xs font-medium text-emerald-600">Creadas</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{resultado.omitidas}</p>
                <p className="text-xs font-medium text-amber-600">Omitidas</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{resultado.errores}</p>
                <p className="text-xs font-medium text-red-600">Errores</p>
              </div>
            </div>

            {/* Detalle fila a fila */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">N° empleado</th>
                    <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                    <th className="px-3 py-2 text-left font-semibold">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultado.resultados.map((r, idx) => (
                    <tr
                      key={idx}
                      className={clsx(
                        r.status === "created" && "text-emerald-700 bg-emerald-50/40",
                        r.status === "skipped" && "text-amber-700 bg-amber-50/40",
                        r.status === "error" && "text-red-700 bg-red-50/40",
                      )}
                    >
                      <td className="px-3 py-2 font-mono">{r.numero_empleado}</td>
                      <td className="px-3 py-2">{r.nombre}</td>
                      <td className="px-3 py-2">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            r.status === "created" && "bg-emerald-100 text-emerald-700",
                            r.status === "skipped" && "bg-amber-100 text-amber-700",
                            r.status === "error" && "bg-red-100 text-red-700",
                          )}
                        >
                          {r.status === "created" ? "Creada" : r.status === "skipped" ? "Omitida" : "Error"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={reiniciar}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Nueva carga
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Personas() {
  const [search, setSearch] = useState("");
  const [nivelFilter, setNivelFilter] = useState("");
  const [ofertaFilter, setOfertaFilter] = useState("");
  const [responsableFilter, setResponsableFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [gestionandoOfertas, setGestionandoOfertas] = useState(false);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);
  const [vista, setVista] = useState("list");
  const [cvDetalle, setCvDetalle] = useState(null);
  const [cvEditando, setCvEditando] = useState(null);
  const [descargandoPdfId, setDescargandoPdfId] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    getAuthorizedUser().then((usuario) => {
      if (mounted) setAuthorizedUser(usuario);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const puedeEditar = ["superadmin", "admin", "editor"].includes(
    authorizedUser?.rol,
  );

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const { data: ofertasValor = [] } = useQuery({
    queryKey: ["ofertas-valor"],
    queryFn: () => ofertasValorApi.list(),
  });

  const ofertasActivas = ofertasValor.filter((oferta) => oferta.activa);

  // Los índices solo cambian cuando llegan datos, no al escribir en un filtro.
  const ofertasPorNombre = useMemo(() => new Map(
    ofertasValor.map((oferta) => [oferta.nombre, oferta]),
  ), [ofertasValor]);

  const { data: curriculums = [] } = useQuery({
    queryKey: ["curriculums"],
    queryFn: () => curriculumsApi.list(),
  });

  const curriculumPorPersona = useMemo(() => new Map(
    curriculums.map((curriculum) => [
      String(curriculum.persona_id),
      curriculum,
    ]),
  ), [curriculums]);

  const descargarPdf = async (curriculum) => {
    if (!curriculum || !tieneContenidoCurriculum(curriculum)) return;

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

      const url = window.URL.createObjectURL(response.data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = coincidencia?.[1] || nombreDefecto;
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

  const responsablesDisponibles = Array.from(
    new Map(
      ofertasValor
        .filter((oferta) => oferta.responsable)
        .map((oferta) => [oferta.responsable.id, oferta.responsable]),
    ).values(),
  ).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  // Normaliza la búsqueda una sola vez y evita recalcular al abrir/cerrar paneles.
  const filtered = useMemo(() => {
    const terminosBusqueda = normalizarTexto(search)
      .split(/\s+/)
      .filter(Boolean);
    return personas.filter((p) => {
    const contenidoPersona = normalizarTexto(
      [p.nombre, p.numero_empleado].filter(Boolean).join(" "),
    );

    const coincideBusqueda =
      terminosBusqueda.length === 0 ||
      terminosBusqueda.every((termino) => contenidoPersona.includes(termino));

    const coincideCategoria = !nivelFilter || p.nivel_piramide === nivelFilter;

    const coincideOferta =
      !ofertaFilter ||
      (ofertaFilter === OFERTA_SIN_ASIGNAR
        ? !p.oferta_valor
        : p.oferta_valor === ofertaFilter);

    const ofertaCatalogo = ofertasPorNombre.get(p.oferta_valor);

    const coincideResponsable =
      !responsableFilter ||
      (responsableFilter === OFERTA_SIN_ASIGNAR
        ? !ofertaCatalogo?.responsable
        : ofertaCatalogo?.responsable?.id === responsableFilter);

    return (
      coincideBusqueda &&
      coincideCategoria &&
      coincideOferta &&
      coincideResponsable
    );
    });
  }, [personas, search, nivelFilter, ofertaFilter, responsableFilter, ofertasPorNombre]);

  const resumenOferta = (() => {
    if (!ofertaFilter) {
      return {
        cantidad: personas.length,
        etiqueta: "Todas las ofertas de valor",
        responsables: [],
      };
    }

    if (ofertaFilter === OFERTA_SIN_ASIGNAR) {
      return {
        cantidad: personas.filter((persona) => !persona.oferta_valor).length,
        etiqueta: "Sin asignar",
        responsables: [],
      };
    }

    const personasOferta = personas.filter(
      (persona) => persona.oferta_valor === ofertaFilter,
    );

    const ofertaCatalogo = ofertasPorNombre.get(ofertaFilter);

    return {
      cantidad: personasOferta.length,
      etiqueta: ofertaFilter,
      responsables: ofertaCatalogo?.responsable?.nombre
        ? [ofertaCatalogo.responsable.nombre]
        : [],
    };
  })();

  if (isLoading) {
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

  return (
    <div className="w-full space-y-6 pb-8 pt-0 sm:space-y-8">
      {/* Header */}
      <div className="relative min-h-[190px] overflow-hidden text-white sm:min-h-[170px]">
        {/* Banner */}
        <img
          src="/banner-personas.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center" }}
        />

        {/* Overlay para mantener legibilidad sin ocultar la imagen */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,18,40,0.88) 0%, rgba(6,18,40,0.72) 24%, rgba(6,18,40,0.34) 50%, rgba(6,18,40,0.10) 72%, rgba(6,18,40,0.03) 100%)",
          }}
        />

        {/* Profundidad inferior suave */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            boxShadow:
              "inset 0 -1px 0 rgba(125,211,252,0.10), inset 0 -26px 42px rgba(6,18,40,0.08)",
          }}
        />

        {/* Contenido */}
        <div className="relative z-10 flex min-h-[190px] flex-col items-start justify-center gap-5 px-4 py-6 sm:min-h-[170px] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">
              Somos DX
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipo DX</h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {filtered.length} personas
            </p>
          </div>

          {puedeEditar && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:shrink-0">
              <button
                type="button"
                onClick={() => setGestionandoOfertas(true)}
                className="btn-primary w-full justify-center !border-white/25 !bg-white/10 !text-white !shadow-sm backdrop-blur-sm hover:!bg-white/20 sm:w-auto"
              >
                Gestionar ofertas de valor
              </button>

              <button
                type="button"
                onClick={() => setCargandoMasivo(true)}
                className="btn-primary w-full justify-center !border-white/25 !bg-white/10 !text-white !shadow-sm backdrop-blur-sm hover:!bg-white/20 sm:w-auto"
              >
                Carga masiva
              </button>

              <button
                onClick={() => setCreating(true)}
                className="btn-primary w-full justify-center shadow-[0_8px_24px_rgba(14,165,233,0.22)] sm:w-auto sm:shrink-0"
              >
                + Nueva persona
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 px-4 sm:space-y-6 sm:px-6 lg:px-8">
        {/* Filtros y resumen de oferta */}
        <div className="space-y-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[300px_190px_270px_220px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o N° de empleado.... "
                className="input w-full"
              />

              <select
                value={nivelFilter}
                onChange={(e) => setNivelFilter(e.target.value)}
                className="input w-full"
              >
                <option value="">Todos los segmentos</option>
                {CATEGORIAS_NIVEL.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>

              <select
                value={ofertaFilter}
                onChange={(e) => setOfertaFilter(e.target.value)}
                className="input w-full"
                title="Filtrar por oferta de valor"
              >
                <option value="">Todas las ofertas de valor</option>
                {ofertasActivas.map((oferta) => (
                  <option key={oferta.id} value={oferta.nombre}>
                    {oferta.nombre}
                  </option>
                ))}
                <option value={OFERTA_SIN_ASIGNAR}>Sin asignar</option>
              </select>

              <select
                value={responsableFilter}
                onChange={(e) => setResponsableFilter(e.target.value)}
                className="input w-full"
                title="Filtrar por responsable de oferta"
              >
                <option value="">Todos los responsables</option>
                {responsablesDisponibles.map((responsable) => (
                  <option key={responsable.id} value={responsable.id}>
                    {responsable.nombre}
                  </option>
                ))}
                <option value={OFERTA_SIN_ASIGNAR}>Sin asignar</option>
              </select>
            </div>

            <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 xl:w-[270px] xl:shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Resumen de oferta
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-bold leading-none text-slate-900">
                  {resumenOferta.cantidad}
                </span>
                <span className="pb-0.5 text-sm font-semibold text-slate-500">
                  {resumenOferta.cantidad === 1 ? "persona" : "personas"}
                </span>
              </div>
              <p
                className="mt-2 truncate text-sm font-medium text-slate-600"
                title={resumenOferta.etiqueta}
              >
                {resumenOferta.etiqueta}
              </p>

              {resumenOferta.responsables.length > 0 && (
                <p
                  className="mt-1 text-xs text-slate-500"
                  title={resumenOferta.responsables.join(", ")}
                >
                  <span className="font-semibold text-slate-600">
                    {resumenOferta.responsables.length === 1
                      ? "Responsable:"
                      : "Responsables:"}
                  </span>{" "}
                  {resumenOferta.responsables.join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full overflow-hidden rounded-lg border border-gray-200 bg-white sm:w-fit">
            <button
              type="button"
              onClick={() => setVista("list")}
              className={clsx(
                "flex-1 px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
                vista === "list"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-gray-50",
              )}
            >
              Lista
            </button>

            <button
              type="button"
              onClick={() => setVista("cards")}
              className={clsx(
                "flex-1 px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
                vista === "cards"
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-gray-50",
              )}
            >
              Tarjetas
            </button>
          </div>
        </div>

        {/* Vista de tarjetas o lista */}
        {vista === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                onClick={() => setSelected(p)}
              />
            ))}

            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 col-span-full py-8 text-center">
                Sin resultados.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Lista móvil: evita que la tabla desktop ensanche el viewport */}
            <div className="space-y-3 md:hidden">
              {filtered.map((p) => {
                const curriculum = curriculumPorPersona.get(String(p.id));

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => (puedeEditar ? setEditing(p) : setSelected(p))}
                      className="w-full text-left"
                      title={puedeEditar ? `Editar a ${p.nombre}` : `Ver a ${p.nombre}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold leading-5 text-slate-900">
                            {p.nombre}
                          </p>
                          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                            {p.rol || "Sin rol"}
                          </p>
                        </div>

                        <span
                          className={clsx(
                            "badge max-w-[46%] shrink-0 text-center",
                            NIVEL_COLOR[p.nivel_piramide] ??
                              "bg-gray-100 text-gray-600",
                          )}
                        >
                          {p.nivel_piramide ?? "Sin clasificar"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Oferta de valor
                          </p>
                          <p className="mt-1 break-words text-xs font-medium text-slate-600">
                            {p.oferta_valor || "Sin asignar"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            N° empleado
                          </p>
                          <p className="mt-1 break-words text-xs font-medium text-slate-600">
                            {p.numero_empleado || "—"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Fecha de ingreso
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-600">
                            {formatearFecha(p.fecha_ingreso_compania)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Experiencia
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-600">
                            {p.anos_experiencia != null
                              ? `${p.anos_experiencia} años`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (curriculum) setCvDetalle(curriculum);
                        }}
                        disabled={!curriculum}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                        title={`Ver currículum de ${p.nombre}`}
                      >
                        Ver CV
                      </button>

                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="btn-secondary !px-3 !py-1.5 !text-xs"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  Sin resultados.
                </p>
              )}
            </div>

            {/* Tabla original, solo desde md hacia arriba */}
            <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3">Oferta de Valor</th>
                  <th className="px-4 py-3">N° empleado</th>
                  <th className="px-4 py-3">Fecha de ingreso</th>
                  <th className="px-4 py-3">Años de experiencia</th>
                  <th className="px-4 py-3 text-center">CV</th>
                  <th
                    className="px-4 py-3 w-16 text-center"
                    aria-label="Acciones"
                  >
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => (puedeEditar ? setEditing(p) : setSelected(p))}
                    className="border-t border-gray-100 hover:bg-brand-50/30 cursor-pointer"
                    title={puedeEditar ? `Editar a ${p.nombre}` : `Ver a ${p.nombre}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {p.nombre}
                    </td>

                    <td className="px-4 py-3 text-gray-500">{p.rol || "—"}</td>

                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "badge",
                          NIVEL_COLOR[p.nivel_piramide] ??
                            "bg-gray-100 text-gray-600",
                        )}
                      >
                        {p.nivel_piramide ?? "Sin clasificar"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {p.oferta_valor || "Sin asignar"}
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {p.numero_empleado || "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatearFecha(p.fecha_ingreso_compania)}
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {p.anos_experiencia ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const curriculum = curriculumPorPersona.get(
                            String(p.id),
                          );
                          if (curriculum) setCvDetalle(curriculum);
                        }}
                        disabled={!curriculumPorPersona.has(String(p.id))}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                        title={`Ver currículum de ${p.nombre}`}
                      >
                        Ver CV
                      </button>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(p);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
                          title={`Editar a ${p.nombre}`}
                          aria-label={`Editar a ${p.nombre}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </>
        )}

        {gestionandoOfertas && (
          <GestionOfertasPanel
            ofertas={ofertasValor}
            personas={personas}
            onClose={() => setGestionandoOfertas(false)}
          />
        )}

        {cvDetalle && !cvEditando && (
          <DetalleCurriculum
            curriculum={cvDetalle}
            onClose={() => setCvDetalle(null)}
            onEdit={
              puedeEditar
                ? () => {
                    setCvEditando(cvDetalle);
                    setCvDetalle(null);
                  }
                : undefined
            }
            onDownload={() => descargarPdf(cvDetalle)}
            downloading={descargandoPdfId === cvDetalle.id}
            centered
          />
        )}

        {cvEditando && (
          <EditorCurriculum
            curriculum={cvEditando}
            onClose={() => setCvEditando(null)}
            centered
            onSaved={(actualizado) => {
              queryClient.setQueryData(["curriculums"], (actuales = []) =>
                actuales.map((item) =>
                  item.id === actualizado.id ? actualizado : item,
                ),
              );
              queryClient.invalidateQueries({ queryKey: ["curriculums"] });
              setCvEditando(null);
              setCvDetalle(actualizado);
            }}
          />
        )}

        {selected && !editing && !cvDetalle && !cvEditando && (
          <PersonaPanel
            persona={selected}
            onClose={() => setSelected(null)}
            puedeEditar={puedeEditar}
            onEdit={() => {
              setEditing(selected);
              setSelected(null);
            }}
          />
        )}

        {(creating || editing) && (
          <Panel
            title={editing ? `Editar — ${editing.nombre}` : "Nueva persona"}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          >
            <PersonaForm
              initial={editing ?? null}
              ofertasValor={ofertasValor}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </Panel>
        )}

        {cargandoMasivo && (
          <CargaMasivaPanel
            onClose={() => setCargandoMasivo(false)}
            onSuccess={() => setCargandoMasivo(false)}
          />
        )}
      </div>
    </div>
  );
}
