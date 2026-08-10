import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { aiApi } from "../services/api";

function BotIcon({ className = "w-5 h-5" }) {
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
      <rect x="5" y="7" width="14" height="11" rx="3" />
      <path d="M12 3v4" />
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M9 15h6" />
      <path d="M3 11v4" />
      <path d="M21 11v4" />
    </svg>
  );
}

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

  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, messages, loading]);

  const sendMessage = async () => {
    const cleanMessage = message.trim();

    if (!cleanMessage || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleanMessage,
    };

    setMessages((current) => [...current, userMessage]);

    setMessage("");
    setLoading(true);

    try {
      const data = await aiApi.chat(cleanMessage);

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data?.response || "TalentIA no entregó una respuesta.",
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error("Error consultando TalentIA:", error);

      const detail =
        error?.response?.data?.detail ||
        "No fue posible comunicarse con TalentIA.";

      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "error",
          content: detail,
        },
      ]);
    } finally {
      setLoading(false);
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

  return (
    <>
      {isOpen && (
        <div
          className="
            fixed
            right-6
            bottom-24
            z-50
            flex
            h-[620px]
            max-h-[calc(100vh-8rem)]
            w-[410px]
            max-w-[calc(100vw-2rem)]
            flex-col
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-2xl
          "
        >
          <div
            className="flex items-center justify-between px-5 py-4 text-white"
            style={{
              background: "linear-gradient(135deg, #051128 0%, #08274d 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <BotIcon className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold">TalentIA</h2>

                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  <span className="text-[11px] text-slate-300">
                    Asistente de talento
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar chat"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5">
            <div className="space-y-4">
              {messages.map((item) => {
                const isUser = item.role === "user";

                const isError = item.role === "error";

                return (
                  <div
                    key={item.id}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={[
                        "max-w-[92%]",
                        "min-w-0",
                        "rounded-2xl",
                        "px-4",
                        "py-3",
                        "text-sm",
                        "leading-6",
                        "break-words",
                        isUser
                          ? "rounded-br-md bg-brand-500 text-white"
                          : isError
                            ? "rounded-bl-md border border-red-200 bg-red-50 text-red-700"
                            : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm",
                      ].join(" ")}
                    >
                      {isUser || isError ? (
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

              {loading && (
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
            className="border-t border-slate-200 bg-white p-4"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10">
              <textarea
                ref={inputRef}
                rows={1}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Pregunta sobre el equipo DX..."
                className="max-h-28 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar mensaje"
              >
                <SendIcon className="h-[18px] w-[18px]" />
              </button>
            </div>

            <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">
              Las respuestas se generan a partir de la información disponible en
              Dashboard DX.
            </p>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-xl transition duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-2xl"
        aria-label={isOpen ? "Cerrar TalentIA" : "Abrir TalentIA"}
      >
        {isOpen ? (
          <CloseIcon className="h-6 w-6" />
        ) : (
          <BotIcon className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
