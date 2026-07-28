// Modal reservado solo para alertas, confirmaciones y mensajes del sistema.
// Para formularios y vistas de contenido, usar Panel.
export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-sm"
        style={{
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(28,159,228,0.10)",
        }}
      >
        {/* Gradient accent bar */}
        <div
          className="h-1 w-full rounded-t-2xl"
          style={{
            background: "linear-gradient(90deg, #127cba 0%, #1c9fe4 100%)",
          }}
        />
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       transition-all duration-150 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
