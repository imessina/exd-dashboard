import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { curriculumsApi, ofertasValorApi, personasApi } from "../services/api";
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
function PersonaPanel({ persona, onClose, onEdit }) {
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
  const [vista, setVista] = useState("list");
  const [cvDetalle, setCvDetalle] = useState(null);
  const [cvEditando, setCvEditando] = useState(null);
  const [descargandoPdfId, setDescargandoPdfId] = useState(null);
  const queryClient = useQueryClient();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => personasApi.list(),
  });

  const { data: ofertasValor = [] } = useQuery({
    queryKey: ["ofertas-valor"],
    queryFn: () => ofertasValorApi.list(),
  });

  const ofertasActivas = ofertasValor.filter((oferta) => oferta.activa);

  const ofertasPorNombre = new Map(
    ofertasValor.map((oferta) => [oferta.nombre, oferta]),
  );

  const { data: curriculums = [] } = useQuery({
    queryKey: ["curriculums"],
    queryFn: () => curriculumsApi.list(),
  });

  const curriculumPorPersona = new Map(
    curriculums.map((curriculum) => [
      String(curriculum.persona_id),
      curriculum,
    ]),
  );

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

  const filtered = personas.filter((p) => {
    const terminosBusqueda = normalizarTexto(search)
      .split(/\s+/)
      .filter(Boolean);

    const contenidoPersona = normalizarTexto(
      [
        p.nombre,
        p.rol,
        p.nivel_piramide,
        p.oferta_valor,
        p.responsable,
        p.numero_empleado,
      ]
        .filter(Boolean)
        .join(" "),
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

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:shrink-0">
            <button
              type="button"
              onClick={() => setGestionandoOfertas(true)}
              className="btn-primary w-full justify-center !border-white/25 !bg-white/10 !text-white !shadow-sm backdrop-blur-sm hover:!bg-white/20 sm:w-auto"
            >
              Gestionar ofertas de valor
            </button>

            <button
              onClick={() => setCreating(true)}
              className="btn-primary w-full justify-center shadow-[0_8px_24px_rgba(14,165,233,0.22)] sm:w-auto sm:shrink-0"
            >
              + Nueva persona
            </button>
          </div>
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
        {isLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : vista === "cards" ? (
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
                      onClick={() => setEditing(p)}
                      className="w-full text-left"
                      title={`Editar a ${p.nombre}`}
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

                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Editar
                      </button>
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
                    onClick={() => setEditing(p)}
                    className="border-t border-gray-100 hover:bg-brand-50/30 cursor-pointer"
                    title={`Editar a ${p.nombre}`}
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
            onEdit={() => {
              setCvEditando(cvDetalle);
              setCvDetalle(null);
            }}
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
      </div>
    </div>
  );
}
