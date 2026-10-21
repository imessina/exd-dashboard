/** Muestra el contenido exacto guardado por el backend y envía solo la decisión explícita del usuario. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { aiApi } from "../services/api";

const TITLES = {
  crear_persona: "Agregar persona",
  crear_proyecto: "Crear proyecto",
  crear_oportunidad: "Crear oportunidad",
  actualizar_proyecto: "Actualizar proyecto",
};

export default function AgentAction({ action, sessionId, disabled }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // El servidor conserva los datos, comprueba permisos y evita duplicados en reintentos.
  const decide = async (confirm) => {
    if (busy || status !== "pending") return;
    setBusy(true);
    setError("");
    try {
      const result = await aiApi.decideAction(action.id, sessionId, confirm);
      setStatus(result.status);
      if (result.status === "executed") {
        for (const key of ["personas", "proyectos", "oportunidades", "dashboard-summary", "skill-matrix", "curriculums", "ofertas-valor", "hitos"]) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    } catch (failure) {
      setError(failure.response?.data?.detail || "No fue posible procesar la decisión. Puedes reintentar sin duplicar la operación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <strong>{TITLES[action.operation] || "Revisar cambios"}</strong>
      <p>Revisa los datos antes de confirmar. La propuesta vence en 10 minutos.</p>
      {action.target_id && <p>Proyecto: {action.target_id}</p>}
      <dl className="space-y-1">
        {Object.entries(action.payload).map(([field, value]) => (
          <div key={field}>
            <dt className="font-semibold capitalize">{field.replaceAll("_", " ")}</dt>
            <dd>{value == null ? "Sin valor" : typeof value === "boolean" ? (value ? "Sí" : "No") : Array.isArray(value) ? value.join(", ") || "Sin elementos" : String(value)}</dd>
          </div>
        ))}
      </dl>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {status === "pending" ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy || disabled} onClick={() => decide(true)}
            className="rounded-lg bg-brand-500 px-3 py-2 text-white disabled:opacity-40">{busy ? "Procesando..." : "Confirmar"}</button>
          <button type="button" disabled={busy || disabled} onClick={() => decide(false)}
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">Cancelar</button>
        </div>
      ) : <p role="status">{status === "executed" ? "Cambios guardados correctamente." : "Propuesta cancelada. No se guardaron cambios."}</p>}
    </div>
  );
}
