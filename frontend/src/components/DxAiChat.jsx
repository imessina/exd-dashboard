/** Chat con respuestas progresivas y confirmaciones explícitas independientes del texto del modelo. */
import { useEffect, useRef, useState } from "react";
import AgentAction from "./AgentAction";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { aiApi } from "../services/api";
import { getAuthorizedUser } from "../lib/authUser";

function SendIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function CloseIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hola. Soy **TalentIA**. Puedo ayudarte a consultar y analizar información del equipo DX.",
  },
];

function MarkdownMessage({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children: heading }) => (
          <h1 className="mb-3 mt-1 text-lg font-bold text-slate-900">
            {heading}
          </h1>
        ),

        h2: ({ children: heading }) => (
          <h2 className="mb-2.5 mt-4 text-base font-bold text-slate-900 first:mt-0">
            {heading}
          </h2>
        ),

        h3: ({ children: heading }) => (
          <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-900 first:mt-0">
            {heading}
          </h3>
        ),

        p: ({ children: paragraph }) => (
          <p className="mb-3 leading-6 last:mb-0">{paragraph}</p>
        ),

        strong: ({ children: strong }) => (
          <strong className="font-semibold text-slate-900">{strong}</strong>
        ),

        em: ({ children: emphasis }) => <em className="italic">{emphasis}</em>,

        ul: ({ children: list }) => (
          <ul className="mb-3 ml-5 list-disc space-y-1.5 last:mb-0">{list}</ul>
        ),

        ol: ({ children: list }) => (
          <ol className="mb-3 ml-5 list-decimal space-y-1.5 last:mb-0">
            {list}
          </ol>
        ),

        li: ({ children: item }) => (
          <li className="pl-0.5 leading-6">{item}</li>
        ),

        blockquote: ({ children: quote }) => (
          <blockquote className="my-3 border-l-2 border-brand-400 pl-3 text-slate-600">
            {quote}
          </blockquote>
        ),

        hr: () => <hr className="my-4 border-slate-200" />,

        a: ({ href, children: linkText }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
          >
            {linkText}
          </a>
        ),

        table: ({ children: tableContent }) => (
          <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse bg-white text-left text-xs">
              {tableContent}
            </table>
          </div>
        ),

        thead: ({ children: header }) => (
          <thead className="bg-slate-100 text-slate-700">{header}</thead>
        ),

        tbody: ({ children: body }) => (
          <tbody className="divide-y divide-slate-100">{body}</tbody>
        ),

        tr: ({ children: row }) => <tr className="align-top">{row}</tr>,

        th: ({ children: cell }) => (
          <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 font-semibold last:border-r-0">
            {cell}
          </th>
        ),

        td: ({ children: cell }) => (
          <td className="min-w-[110px] border-r border-slate-100 px-3 py-2.5 leading-5 text-slate-700 last:border-r-0">
            {cell}
          </td>
        ),

        code: ({ children: code }) => (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">
            {code}
          </code>
        ),

        pre: ({ children: codeBlock }) => (
          <pre className="my-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs leading-5 text-slate-100">
            {codeBlock}
          </pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export default function DxAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const messageRefs = useRef({});
  const sessionIdRef = useRef(null);
  const [chatButtonPos, setChatButtonPos] = useState({ x: null, y: null });
  const dragStateRef = useRef({
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  if (!sessionIdRef.current) {
    const storedSessionId = sessionStorage.getItem("talentia-session-id");

    if (storedSessionId) {
      sessionIdRef.current = storedSessionId;
    } else {
      const newSessionId = crypto.randomUUID();

      sessionStorage.setItem("talentia-session-id", newSessionId);

      sessionIdRef.current = newSessionId;
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !loading || streamingStarted) {
      return;
    }

    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [isOpen, loading, streamingStarted]);

  useEffect(() => {
    if (!streamingStarted || !activeAssistantId) {
      return;
    }

    const element = messageRefs.current[activeAssistantId];

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [streamingStarted, activeAssistantId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = localStorage.getItem("talentia-chat-button-pos");
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (
        parsed
        && typeof parsed.x === "number"
        && typeof parsed.y === "number"
      ) {
        setChatButtonPos({ x: parsed.x, y: parsed.y });
      }
    } catch {
      // Si falla parseo, usamos posición por defecto.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof chatButtonPos.x !== "number" || typeof chatButtonPos.y !== "number") {
      return;
    }

    localStorage.setItem(
      "talentia-chat-button-pos",
      JSON.stringify(chatButtonPos),
    );
  }, [chatButtonPos]);

  const handleChatButtonPointerDown = (event) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    dragStateRef.current = {
      dragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: typeof chatButtonPos.x === "number" ? chatButtonPos.x : rect.left,
      originY: typeof chatButtonPos.y === "number" ? chatButtonPos.y : rect.top,
      moved: false,
    };

    target.setPointerCapture?.(event.pointerId);
  };

  const handleChatButtonPointerMove = (event) => {
    const state = dragStateRef.current;
    if (!state.dragging || state.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (!state.moved && Math.hypot(dx, dy) > 4) {
      state.moved = true;
    }

    const size = window.innerWidth >= 640 ? 96 : 80;
    const minX = 0;
    const minY = 0;
    const maxX = Math.max(minX, window.innerWidth - size);
    const maxY = Math.max(minY, window.innerHeight - size);

    const nextX = Math.min(maxX, Math.max(minX, state.originX + dx));
    const nextY = Math.min(maxY, Math.max(minY, state.originY + dy));

    setChatButtonPos({ x: nextX, y: nextY });
  };

  const handleChatButtonPointerUp = (event) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) {
      return;
    }

    const target = event.currentTarget;
    target.releasePointerCapture?.(event.pointerId);

    dragStateRef.current = {
      ...dragStateRef.current,
      dragging: false,
      pointerId: null,
    };

    if (!state.moved) {
      setIsOpen(true);
    }
  };

  const sendMessage = async () => {
    const cleanMessage = message.trim();

    if (!cleanMessage || loading) {
      return;
    }

    const timestamp = Date.now();

    const userMessage = {
      id: `user-${timestamp}`,
      role: "user",
      content: cleanMessage,
    };

    const assistantMessageId = `assistant-${timestamp}`;

    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    setActiveAssistantId(assistantMessageId);

    setMessage("");
    setLoading(true);
    setStreamingStarted(false);

    const intentaEscritura = /\b(cre(ar|ame|arme|emos|en)|actualiz(ar|ame|arme|emos|en)|editar|modificar|agregar|insertar)\b/i.test(cleanMessage)
      && /\b(persona|personas|asignaci[oó]n|asignaciones|proyecto|proyectos|oportunidad|oportunidades)\b/i.test(cleanMessage);

    if (intentaEscritura) {
      try {
        const usuario = await getAuthorizedUser();
        if (usuario?.rol === "viewer" || usuario?.rol === "usuario") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    content:
                      "Gracias por tu solicitud 🙌\n\nCon tu rol actual puedes consultar información, pero no crear o modificar registros.\n\nSi necesitas hacer este cambio, te recomiendo pedir apoyo a un administrador del equipo.",
                  }
                : item,
            ),
          );
          setLoading(false);
          setStreamingStarted(false);
          setActiveAssistantId(null);
          return;
        }
      } catch {
        // Si falla la consulta del perfil, continúa el flujo normal y el backend valida permisos.
      }
    }

    const controller = new AbortController();

    abortControllerRef.current = controller;

    let receivedText = false;
    let receivedAction = false;

    try {
      const data = await aiApi.chatStream(cleanMessage, {
        sessionId: sessionIdRef.current,
        signal: controller.signal,
        onAction: (action) => {
          receivedAction = true;
          setMessages((current) => current.some((item) => item.id === action.id) ? current : [
            ...current, { id: action.id, role: "action", action },
          ]);
        },

        onDelta: (delta, fullText) => {
          if (!delta) {
            return;
          }

          receivedText = true;

          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    content: fullText,
                  }
                : item,
            ),
          );

          setStreamingStarted(true);
        },
      });

      if (!receivedText && !receivedAction) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content:
                    data?.response || "TalentIA no entregó una respuesta.",
                }
              : item,
          ),
        );
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.error("Error consultando TalentIA:", error);

      const detail =
        error?.message || "No fue posible comunicarse con TalentIA.";

      const normalizedDetail = String(detail).toLowerCase();
      const forbiddenLike =
        normalizedDetail.includes("403") ||
        normalizedDetail.includes("forbidden") ||
        normalizedDetail.includes("acceso reservado a administradores") ||
        normalizedDetail.includes("solo administradores pueden realizar cambios");

      const finalDetail = forbiddenLike
        ? "Gracias por tu solicitud 🙌\n\nCon tu rol actual puedes consultar información, pero no crear o modificar registros.\n\nSi necesitas hacer este cambio, te recomiendo pedir apoyo a un administrador del equipo."
        : detail;

      if (receivedText) {
        setMessages((current) => [
          ...current,
          {
            id: `error-${Date.now()}`,
            role: "error",
            content: finalDetail,
          },
        ]);
      } else {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  role: "error",
                  content: finalDetail,
                }
              : item,
          ),
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
      setStreamingStarted(false);
      setActiveAssistantId(null);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const chatUi = (
    <>
      {isOpen && (
        <div
          className="
            fixed
            bottom-4
            right-4
            z-[9998]
            flex
            h-[54dvh]
            max-h-[500px]
            w-[calc(100vw-32px)]
            max-w-[350px]
            flex-col
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-2xl

            sm:bottom-6
            sm:right-6
            sm:h-[470px]
            sm:max-h-[62vh]
            sm:w-[340px]
            sm:max-w-none
          "
        >
          <div
            className="flex items-center justify-between px-3.5 py-2 text-white sm:px-4 sm:py-2.5"
            style={{
              background: "linear-gradient(135deg, #051128 0%, #08274d 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <img
                src="/talentia-chat.png"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 shrink-0 scale-[1.45] object-contain sm:h-10 sm:w-10 sm:scale-[1.5]"
              />

              <div>
                <h2 className="text-[13px] font-semibold sm:text-sm">
                  TalentIA
                </h2>

                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  <span className="text-[10px] text-slate-300 sm:text-[11px]">
                    Asistente de talento
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
              aria-label="Cerrar chat"
            >
              <CloseIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-2.5 py-2.5 sm:px-3.5 sm:py-3.5">
            <div className="space-y-3 sm:space-y-4">
              {messages.map((item) => {
                const isUser = item.role === "user";
                const isError = item.role === "error";

                if (item.role === "assistant" && !item.content) {
                  return null;
                }

                return (
                  <div
                    key={item.id}
                    ref={(element) => {
                      if (element) {
                        messageRefs.current[item.id] = element;
                      } else {
                        delete messageRefs.current[item.id];
                      }
                    }}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={[
                        "max-w-[92%]",
                        "min-w-0",
                        "rounded-2xl",
                        "px-3",
                        "py-2.5",
                        "text-[12px]",
                        "leading-5",
                        "break-words",
                        "sm:text-[12.5px]",
                        isUser
                          ? "rounded-br-md bg-brand-500 text-white"
                          : isError
                            ? "rounded-bl-md border border-red-200 bg-red-50 text-red-700"
                            : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm",
                      ].join(" ")}
                    >
                      {item.role === "action" ? (
                        <AgentAction action={item.action} sessionId={sessionIdRef.current} disabled={loading} />
                      ) : isUser || isError ? (
                        <span className="whitespace-pre-wrap">
                          {item.content}
                        </span>
                      ) : (
                        <MarkdownMessage>{item.content}</MarkdownMessage>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && !streamingStarted && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />

                        <span
                          className="h-2 w-2 animate-pulse rounded-full bg-slate-400"
                          style={{
                            animationDelay: "150ms",
                          }}
                        />

                        <span
                          className="h-2 w-2 animate-pulse rounded-full bg-slate-400"
                          style={{
                            animationDelay: "300ms",
                          }}
                        />
                      </div>

                      <span className="text-xs text-slate-400">
                        Analizando...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-2.5 sm:p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10">
              <textarea
                ref={inputRef}
                rows={1}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Pregunta sobre el equipo DX..."
                className="max-h-24 min-h-[34px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[36px] sm:text-[13px]"
              />

              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                aria-label="Enviar mensaje"
              >
                <SendIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </button>
            </div>
          </form>
        </div>
      )}

      {!isOpen && (
        <button
          key="talentia-open"
          type="button"
          onPointerDown={handleChatButtonPointerDown}
          onPointerMove={handleChatButtonPointerMove}
          onPointerUp={handleChatButtonPointerUp}
          onPointerCancel={handleChatButtonPointerUp}
          className="
            fixed
            z-[9999]
            flex
            h-20
            w-20
            items-center
            justify-center
            overflow-visible
            border-0
            bg-transparent
            p-0
            shadow-none
            transition-transform
            duration-200
            hover:-translate-y-0.5
            hover:scale-105

            sm:h-24
            sm:w-24
          "
          style={
            typeof chatButtonPos.x === "number" && typeof chatButtonPos.y === "number"
              ? { left: `${chatButtonPos.x}px`, top: `${chatButtonPos.y}px`, touchAction: "none" }
              : { right: "-4px", bottom: "16px", touchAction: "none" }
          }
          aria-label="Abrir TalentIA"
        >
          <img
            src="/talentia-chat.png"
            alt=""
            aria-hidden="true"
            className="
              h-20
              w-20
              max-w-none
              scale-125
              object-contain
              drop-shadow-[0_8px_20px_rgba(14,165,233,0.35)]

              sm:h-24
              sm:w-24
            "
          />
        </button>
      )}
    </>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(chatUi, document.body);
}
