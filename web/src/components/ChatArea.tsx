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
import {
  isFailedAssistantReply,
  STUB_REPLY_MESSAGE,
  stripAssistantLeaks,
} from "../lib/sanitizeAssistant";
import { labelForPhase, phaseFromStream } from "../lib/generationStatus";
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
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [fileToast, setFileToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const bumpWorkspace = useUiStore((s) => s.bumpWorkspace);
  const setGeneration = useUiStore((s) => s.setGeneration);
  const generationPhase = useUiStore((s) => s.generationPhase);
  const generationDetail = useUiStore((s) => s.generationDetail);
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
    setStreamingAssistantId(assistantId);
    if (!overrideText) setInput("");
    setSending(true);
    setFileToast(null);
    setGeneration("thinking", null);

    const current = useChatStore.getState().threads.find((t) => t.id === threadId);
    const history =
      current?.messages
        .filter((m) => m.id !== assistantId && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })) ?? [];

    try {
      const chatHistory = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const runStream = async (messages: typeof chatHistory) => {
        let acc = "";
        await streamIntelligenceChat(messages, intelligenceMode, (token) => {
          acc += token;
          const clean = stripAssistantLeaks(acc);
          const { phase, detail } = phaseFromStream(clean);
          setGeneration(phase, detail);
          updateAssistant(threadId!, assistantId, clean);
        });
        return stripAssistantLeaks(acc);
      };

      let acc = await runStream(chatHistory);
      if (isFailedAssistantReply(acc)) {
        acc = await runStream([
          ...chatHistory,
          {
            role: "user",
            content:
              `${text}\n\nReply as NEXOPLUS: output every file using markdown path fences only (no tool_call or write(path= syntax). Example: \`\`\`calculator-app/package.json`,
          },
        ]);
      }

      if (isFailedAssistantReply(acc)) {
        updateAssistant(threadId!, assistantId, STUB_REPLY_MESSAGE);
        return;
      }

      updateAssistant(threadId!, assistantId, acc);

      try {
        setGeneration("saving", null);
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
      setStreamingAssistantId(null);
      setGeneration(null, null);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 nexo-glass bg-nexo-panel border border-nexo-border rounded-2xl overflow-hidden transition-colors duration-300">
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-nexo-border gap-3">
        <h1 className="font-display text-[14px] font-semibold text-nexo-fg truncate min-w-0 tracking-tight">
          {thread?.title ?? "Workspace"}
        </h1>
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-nexo-composer/80 border border-nexo-border shrink-0">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => setIntelligenceMode(m.id as IntelligenceMode)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200",
                intelligenceMode === m.id
                  ? "nexo-pill-active"
                  : "text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover"
              )}
            >
              {m.id === "fast" ? "Fast" : m.id === "deep" ? "Deep" : "Smart"}
            </button>
          ))}
        </div>
      </header>

      {sending && generationPhase && (
        <div className="mx-5 mt-3 px-3 py-2.5 rounded-xl border border-nexo-border bg-nexo-composer/80 flex items-center gap-2.5 text-[12px] text-nexo-fg animate-fade-in">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-nexo-brand shrink-0" />
          <span className="font-medium">{labelForPhase(generationPhase, generationDetail)}</span>
          <span className="text-nexo-muted hidden sm:inline">
            {activeMode?.label ?? "NEXOPLUS"}
          </span>
        </div>
      )}

      {fileToast && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-nexo-brand/15 border border-nexo-brand/30 text-[12px] text-nexo-fg animate-fade-in">
          {fileToast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto px-6 py-8 w-full">
          {!thread?.messages.length && (
            <div className="pt-16 pb-10 text-center animate-fade-in">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-nexo-border bg-nexo-composer/60 text-nexo-muted mb-6">
                {activeMode?.label ?? "NEXOPLUS Smart"}
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3 nexo-gradient-text">
                What should we build?
              </h2>
              <p className="text-nexo-muted text-[15px] max-w-md mx-auto leading-relaxed">
                Describe your idea — get instant answers, code, and downloadable project files.
              </p>
              <div className="grid gap-2.5 mt-10 max-w-lg mx-auto text-left">
                {[
                  "Build a todo API — create all files for a Node backend",
                  "Scaffold a modern landing page with HTML, CSS, and JS",
                ].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => setInput(hint)}
                    className="text-[13px] text-left px-4 py-3.5 rounded-2xl border border-nexo-border bg-nexo-composer/50 hover:border-nexo-brand/30 hover:bg-nexo-hover transition-all duration-200 text-nexo-muted hover:text-nexo-fg shadow-sm"
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
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 bg-nexo-composer border border-nexo-border text-[14px] leading-relaxed shadow-sm ring-1 ring-[color-mix(in_srgb,var(--nexo-brand)_12%,transparent)]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-xl nexo-btn-primary text-[11px] font-bold flex items-center justify-center mt-0.5 shadow-sm">
                      N+
                    </div>
                    <div className="prose-chat flex-1 min-w-0">
                      {m.content ? (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          {sending &&
                            m.id === streamingAssistantId &&
                            generationPhase &&
                            generationPhase !== "drafting" && (
                              <p className="mt-2 flex items-center gap-2 text-[12px] text-nexo-muted">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {labelForPhase(generationPhase, generationDetail)}
                              </p>
                            )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-nexo-muted text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {labelForPhase(generationPhase ?? "thinking", generationDetail)}
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

      <div className="shrink-0 p-5 pb-3">
        <div className="max-w-3xl mx-auto">
          <div
            className={clsx(
              "rounded-2xl border border-nexo-border bg-nexo-composer/90 nexo-glass shadow-composer transition-all duration-300",
              "focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--nexo-brand)_35%,transparent)] focus-within:border-[color-mix(in_srgb,var(--nexo-brand)_40%,transparent)]"
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
              rows={4}
              className="w-full resize-y min-h-[88px] max-h-[40vh] bg-transparent px-4 pt-4 pb-2 text-[14px] placeholder:text-nexo-muted focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-[11px] text-nexo-muted pl-1">
                {activeMode?.label ?? "NEXOPLUS Smart"}
              </span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl nexo-btn-primary flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform duration-150"
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
