import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2 } from "lucide-react";
import clsx from "clsx";
import {
  streamIntelligenceChat,
  type IntelligenceMode,
  type IntelligenceModeOption,
} from "../lib/intelligence";
import { applyGeneratedFiles } from "../lib/workspace";
import { useChatStore, type Message } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";

interface ChatAreaProps {
  modes: IntelligenceModeOption[];
}

export function ChatArea({ modes }: ChatAreaProps) {
  const {
    threads,
    activeThreadId,
    activeProjectId,
    intelligenceMode,
    setIntelligenceMode,
    newThread,
    appendMessage,
    updateAssistant,
  } = useChatStore();

  const thread = threads.find((t) => t.id === activeThreadId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [fileToast, setFileToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const bumpWorkspace = useUiStore((s) => s.bumpWorkspace);
  const pendingPrompt = useUiStore((s) => s.pendingPrompt);
  const pendingAutoSend = useUiStore((s) => s.pendingAutoSend);
  const clearPendingPrompt = useUiStore((s) => s.clearPendingPrompt);

  const activeMode =
    modes.find((m) => m.id === intelligenceMode) ?? modes[1] ?? modes[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages, fileToast]);

  useEffect(() => {
    if (!pendingPrompt) return;
    setInput(pendingPrompt);
    if (pendingAutoSend) {
      void send(pendingPrompt);
    }
    clearPendingPrompt();
  }, [pendingPrompt, pendingAutoSend]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    let threadId = activeThreadId;
    if (!threadId) threadId = newThread();

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    appendMessage(threadId, userMsg);
    appendMessage(threadId, { id: assistantId, role: "assistant", content: "" });
    if (!overrideText) setInput("");
    setSending(true);
    setFileToast(null);

    const current = useChatStore.getState().threads.find((t) => t.id === threadId);
    const history =
      current?.messages
        .filter((m) => m.id !== assistantId && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })) ?? [];

    try {
      let acc = "";
      await streamIntelligenceChat(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        intelligenceMode,
        (token) => {
          acc += token;
          updateAssistant(threadId!, assistantId, acc);
        }
      );

      try {
        const written = await applyGeneratedFiles(acc, activeProjectId);
        if (written.length > 0) {
          bumpWorkspace();
          setFileToast(
            `Saved ${written.length} file(s) to your project workspace.`
          );
        }
      } catch {
        /* no files */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      updateAssistant(threadId!, assistantId, msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-nexo-panel transition-colors duration-300">
      <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-nexo-border gap-3">
        <h1 className="text-[13px] font-medium text-nexo-muted truncate min-w-0">
          {thread?.title ?? "NEXOPLUS Chat"}
        </h1>
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-nexo-composer border border-nexo-border shrink-0">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => setIntelligenceMode(m.id as IntelligenceMode)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200",
                intelligenceMode === m.id
                  ? "bg-nexo-brand text-white shadow-sm"
                  : "text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover"
              )}
            >
              {m.id === "fast" ? "Fast" : m.id === "deep" ? "Deep" : "Smart"}
            </button>
          ))}
        </div>
      </header>

      {fileToast && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-nexo-brand/15 border border-nexo-brand/30 text-[12px] text-nexo-fg animate-fade-in">
          {fileToast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto px-6 py-8 w-full">
          {!thread?.messages.length && (
            <div className="pt-12 pb-8 text-center animate-fade-in">
              <img
                src="/nexoplus-logo.png"
                alt=""
                className="w-48 mx-auto rounded-xl mb-6 opacity-95"
              />
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                What should we build?
              </h2>
              <p className="text-nexo-muted text-[14px] max-w-md mx-auto">
                NEXOPLUS intelligence drafts and writes files for you automatically — powered by
                our in-house automation stack.
              </p>
              <p className="text-[11px] text-nexo-muted mt-2">
                Mode: <span className="text-nexo-fg">{activeMode?.label}</span>
              </p>
              <div className="grid gap-2 mt-8 max-w-lg mx-auto text-left">
                {[
                  "Build a todo API — create all files for a Node backend",
                  "Scaffold a modern landing page with HTML, CSS, and JS",
                ].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => setInput(hint)}
                    className="text-[13px] text-left px-4 py-3 rounded-xl border border-nexo-border bg-nexo-composer/40 hover:bg-nexo-hover transition-all duration-200 text-nexo-muted hover:text-nexo-fg"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {thread?.messages.map((m) => (
              <article key={m.id} className="animate-fade-in">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-nexo-composer border border-nexo-border text-[14px] leading-relaxed shadow-sm">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 shrink-0 rounded-lg bg-nexo-brand text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                      N+
                    </div>
                    <div className="prose-chat flex-1 min-w-0">
                      {m.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      ) : (
                        <div className="flex items-center gap-2 text-nexo-muted text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          NEXOPLUS is thinking…
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 p-4 pb-2">
        <div className="max-w-3xl mx-auto">
          <div
            className={clsx(
              "rounded-2xl border border-nexo-border bg-nexo-composer shadow-composer transition-all duration-300",
              "focus-within:ring-2 focus-within:ring-nexo-brand/35 focus-within:border-nexo-brand/40"
            )}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={sending}
              placeholder="Message NEXOPLUS…"
              rows={3}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[14px] placeholder:text-nexo-muted focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-[11px] text-nexo-muted pl-1">
                {activeMode?.label ?? "NEXOPLUS Smart"}
              </span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl bg-nexo-brand text-white flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform duration-150"
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
