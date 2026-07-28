import { useEffect } from "react";
import clsx from "clsx";

const WIDTHS = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-lg",
  lg: "w-full max-w-2xl",
  xl: "w-full max-w-3xl",
};

// Panel lateral deslizante desde la derecha.
// Uso: <Panel title="…" onClose={fn} width="md|lg|xl">…</Panel>
export default function Panel({ title, onClose, children, width = "md" }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={clsx(
          "relative bg-white h-full flex flex-col",
          WIDTHS[width],
        )}
        style={{ boxShadow: "-2px 0 40px rgba(0,0,0,0.10)" }}
      >
        {/* Acento de color en el borde superior */}
        <div
          className="h-1 shrink-0 w-full"
          style={{
            background: "linear-gradient(90deg, #127cba 0%, #1c9fe4 100%)",
          }}
        />

        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-gray-900 text-sm truncate pr-4">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       transition-all duration-150 text-sm"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
