import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, FileCode2, Loader2, Menu, Square } from "lucide-react";
import clsx from "clsx";
import {
  abortIntelligenceChat,
  type IntelligenceMode,
  type IntelligenceModeOption,
} from "../lib/intelligence";
import { labelForPhase } from "../lib/generationStatus";
import { runChatGeneration } from "../lib/runChatGeneration";
import { isFailedAssistantReply, STUB_REPLY_MESSAGE } from "../lib/sanitizeAssistant";
import { buildWorkspaceContext, formatNetworkError } from "../lib/workspaceContext";
import { useWorkspaceId } from "../hooks/useWorkspaceId";
import { trackEvent } from "../lib/analytics";
import { useChatStore, type Message } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";

interface ChatAreaProps {
  modes: IntelligenceModeOption[];
  onOpenSidebar?: () => void;
}

export function ChatArea({ modes, onOpenSidebar }: ChatAreaProps) {
  const {
    threads,
    activeThreadId,
    intelligenceMode,
    setIntelligenceMode,
    newThread,
    appendMessage,
    updateAssistant,
  } = useChatStore();

  const workspaceId = useWorkspaceId();
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
  const setOpenFilePath = useUiStore((s) => s.setOpenFilePath);
  const setCodePanelOpen = useUiStore((s) => s.setCodePanelOpen);

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
      const wsId = workspaceId ?? threadId;
      const workspaceCtx = await buildWorkspaceContext(wsId, text);
      const baseHistory = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const chatHistory = workspaceCtx
        ? baseHistory.map((m, i) =>
            i === baseHistory.length - 1 && m.role === "user"
              ? {
                  ...m,
                  content: `${workspaceCtx}\n\nUser request:\n${m.content}`,
                }
              : m
          )
        : baseHistory;

      const { content: acc, written } = await runChatGeneration({
        mode: intelligenceMode,
        projectId: wsId,
        userText: text,
        chatHistory,
        onToken: (clean, phase, detail) => {
          setGeneration(phase, detail);
          updateAssistant(threadId!, assistantId, clean);
        },
        onSaving: () => setGeneration("saving", null),
        onFilesWritten: (paths) => {
          const last = paths[paths.length - 1];
          if (last) {
            setCodePanelOpen(true);
            setOpenFilePath(last);
          }
        },
      });

      if (!acc.trim() || isFailedAssistantReply(acc)) {
        updateAssistant(threadId!, assistantId, STUB_REPLY_MESSAGE);
        return;
      }

      updateAssistant(threadId!, assistantId, acc);

      if (written.length > 0) {
        bumpWorkspace();
        setFileToast(`Saved ${written.length} file(s) to your project workspace.`);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong.";
      if (raw === "Stopped") {
        const partial = useChatStore
          .getState()
          .threads.find((t) => t.id === threadId)
          ?.messages.find((m) => m.id === assistantId)
          ?.content?.trim();
        if (partial) updateAssistant(threadId!, assistantId, `${partial}\n\n_(Stopped)_`);
        return;
      }
      const msg = formatNetworkError(raw);
      updateAssistant(threadId!, assistantId, msg);
    } finally {
      setSending(false);
      setStreamingAssistantId(null);
      setGeneration(null, null);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 nexo-glass bg-nexo-panel border border-nexo-border rounded-2xl overflow-hidden transition-colors duration-300">
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-6 py-3 sm:py-0 sm:h-14 border-b border-nexo-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="lg:hidden shrink-0 p-2 -ml-1 rounded-xl hover:bg-nexo-hover text-nexo-muted"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="font-display text-[13px] sm:text-[14px] font-semibold text-nexo-fg truncate min-w-0 tracking-tight">
            {thread?.title ?? "Workspace"}
          </h1>
          <button
            type="button"
            onClick={() => setCodePanelOpen(true)}
            className="lg:hidden shrink-0 ml-auto p-2 rounded-xl hover:bg-nexo-hover text-nexo-muted"
            aria-label="Open project files"
          >
            <FileCode2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-xl bg-nexo-composer/80 border border-nexo-border shrink-0 self-end sm:self-auto overflow-x-auto max-w-full">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => {
                if (m.id !== intelligenceMode) void trackEvent("mode_switched", { mode: m.id });
                setIntelligenceMode(m.id as IntelligenceMode);
              }}
              className={clsx(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all duration-200 whitespace-nowrap",
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
          <span className="font-medium flex-1 min-w-0 truncate">
            {labelForPhase(generationPhase, generationDetail)}
          </span>
          <button
            type="button"
            onClick={() => abortIntelligenceChat()}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-nexo-border hover:bg-nexo-hover text-[11px]"
            title="Stop generating"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop
          </button>
        </div>
      )}

      {fileToast && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-nexo-brand/15 border border-nexo-brand/30 text-[12px] text-nexo-fg animate-fade-in">
          {fileToast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 w-full">
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

      <div className="shrink-0 p-3 sm:p-5 pb-safe">
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
