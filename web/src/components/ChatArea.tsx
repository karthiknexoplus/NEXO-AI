import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2 } from "lucide-react";
import clsx from "clsx";
import { streamChat } from "../lib/ollama";
import { useChatStore, type Message } from "../store/chatStore";

interface ChatAreaProps {
  models: string[];
  modelsOnline: boolean;
}

export function ChatArea({ models, modelsOnline }: ChatAreaProps) {
  const {
    threads,
    activeThreadId,
    model,
    setModel,
    newThread,
    appendMessage,
    updateAssistant,
  } = useChatStore();

  const thread = threads.find((t) => t.id === activeThreadId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !modelsOnline) return;

    let threadId = activeThreadId;
    if (!threadId) {
      threadId = newThread();
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantId = `a-${Date.now()}`;
    appendMessage(threadId, userMsg);
    appendMessage(threadId, { id: assistantId, role: "assistant", content: "" });
    setInput("");
    setSending(true);

    const current = useChatStore
      .getState()
      .threads.find((t) => t.id === threadId);
    const history =
      current?.messages
        .filter((m) => m.id !== assistantId && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })) ?? [];

    try {
      let acc = "";
      await streamChat(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        model,
        (token) => {
          acc += token;
          updateAssistant(threadId!, assistantId, acc);
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      updateAssistant(threadId!, assistantId, `**Error:** ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-cursor-panel">
      <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-cursor-border">
        <h1 className="text-[13px] font-medium text-cursor-muted truncate">
          {thread?.title ?? "New Chat"}
        </h1>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="text-[12px] font-mono bg-cursor-composer border border-cursor-border rounded-lg px-2.5 py-1.5 text-cursor-fg focus:outline-none focus:ring-1 focus:ring-cursor-accent/50"
        >
          {(models.length ? models : [model]).map((m) => (
            <option key={m} value={m}>{m.replace(":latest", "")}</option>
          ))}
        </select>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 w-full">
          {!thread?.messages.length && (
            <div className="pt-16 pb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                What are we building today?
              </h2>
              <p className="text-cursor-muted text-[14px] max-w-md mx-auto">
                Describe a full-stack app, paste code, or ask NEXO to scaffold your project file by
                file — powered by local Ollama.
              </p>
              <div className="grid gap-2 mt-8 max-w-lg mx-auto text-left">
                {[
                  "Build a todo app with Express API and React frontend",
                  "Create package.json and README for a SaaS MVP",
                  "Explain how to structure a monorepo with pnpm",
                ].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => setInput(hint)}
                    className="text-[13px] text-left px-4 py-3 rounded-xl border border-cursor-border bg-cursor-composer/50 hover:bg-cursor-hover transition-colors text-cursor-muted hover:text-cursor-fg"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {thread?.messages.map((m) => (
              <article key={m.id}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-cursor-composer border border-cursor-border text-[14px] leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="prose-chat">
                    {m.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : (
                      <div className="flex items-center gap-2 text-cursor-muted text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking…
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div
            className={clsx(
              "rounded-2xl border border-cursor-border bg-cursor-composer shadow-composer transition-shadow",
              "focus-within:ring-1 focus-within:ring-cursor-accent/40"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={sending || !modelsOnline}
              placeholder={
                modelsOnline
                  ? "Ask NEXO to build your project…"
                  : "Start Ollama: ollama serve"
              }
              rows={3}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[14px] placeholder:text-cursor-muted focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-[11px] text-cursor-muted pl-1">
                Enter to send · Shift+Enter newline
              </span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim() || !modelsOnline}
                className="w-9 h-9 rounded-xl bg-cursor-fg text-cursor-bg flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
