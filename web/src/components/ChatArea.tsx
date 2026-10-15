import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Copy, FileCode2, Loader2, Menu, MessageSquarePlus, Mic, MicOff, Paperclip, Pencil, RotateCcw, Square } from "lucide-react";
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

function extractMarkdownText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractMarkdownText).join("");
  if (node && typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props?.children !== undefined) return extractMarkdownText(props.children);
  }
  return "";
}

export function ChatArea({ modes, onOpenSidebar }: ChatAreaProps) {
  const {
    threads,
    activeThreadId,
    intelligenceMode,
    setIntelligenceMode,
    newThread,
    appendMessage,
    setActiveThread,
    updateAssistant,
  } = useChatStore();

  const workspaceId = useWorkspaceId();
  const thread = threads.find((t) => t.id === activeThreadId);
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
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
  const queuePrompt = useUiStore((s) => s.queuePrompt);
  const showToast = useUiStore((s) => s.showToast);

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
    const rawText = (overrideText ?? input).trim();
    if (!rawText || sending) return;

    let text = rawText;
    if (rawText.startsWith("/")) {
      const parts = rawText.slice(1).split(/\\s+(.+)/s);
      const cmd = (parts[0] || "").toLowerCase();
      const arg = parts[1] || "";
      const cmdMap: Record<string, string> = {
        fix: `Fix these issues in the current project/workspace: ${arg || "identify and fix bugs from the project files"}. Apply minimal safe edits and output changed files in path fences.`,
        feature: `Implement this feature in the current project/workspace: ${arg}. Reuse existing structure and output changed/new files in path fences.`,
        add: `Implement this feature in the current project/workspace: ${arg}. Reuse existing structure and output changed/new files in path fences.`,
        refactor: `Refactor the current project/workspace for clarity and maintainability: ${arg || "improve code structure without behavior changes"}. Output changed files in path fences.`,
        tests: `Add or improve tests for the current project/workspace${arg ? ` focusing on: ${arg}` : ""}. Output test files in path fences.`,
        explain: `Explain the current project/workspace${arg ? ` focusing on: ${arg}` : ""}. No file changes.`,
        improve: `Improve UX and robustness of the current project/workspace: ${arg || "make meaningful enhancements"}. Output changed files in path fences.`,
      };
      if (cmdMap[cmd]) text = cmdMap[cmd];
    }

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
        .map((m) => {
          // Keep prompts intact; condense very long assistant turns to stay in context budget.
          // The saved workspace files below remain the source of truth.
          if (m.role === "assistant" && m.content.length > 1500) {
            return {
              role: m.role,
              content: `${m.content.slice(0, 900)}\n\n[...earlier response condensed — ${m.content.length} chars; see workspace files above/below...]\n`,
            };
          }
          return { role: m.role, content: m.content };
        }) ?? [];

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

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy message:", text);
    }
  };

  const startEditMessage = (msg: Message) => {
    setEditingId(msg.id);
    setDraftContent(msg.content);
  };

  const saveEditedMessage = () => {
    if (editingId && activeThreadId) updateAssistant(activeThreadId, editingId, draftContent);
    setEditingId(null);
    setDraftContent("");
  };

  const cancelEditMessage = () => {
    setEditingId(null);
    setDraftContent("");
  };

  const regenerateMessage = (msgId: string) => {
    if (!thread) return;
    const idx = thread.messages.findIndex((m) => m.id === msgId);
    let userText = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (thread.messages[i].role === "user") {
        userText = thread.messages[i].content;
        break;
      }
    }
    if (userText) queuePrompt(userText, true);
  };

  const forkFromMessage = (msgId: string) => {
    if (!thread) return;
    const idx = thread.messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    const slice = thread.messages.slice(0, idx + 1);
    const id = newThread();
    for (const m of slice) {
      appendMessage(id, { ...m, id: `${m.id}-fork-${Date.now()}` });
    }
    setActiveThread(id);
  };

  const handleFilesForSummary = async (files: FileList | null) => {
    if (!files?.length) return;
    if (sending) {
      showToast("Wait for the current response to finish first.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const parts: string[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (file.type.startsWith("image/")) {
        showToast(`Image files cannot be summarized as text (${file.name}).`, "error");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        parts.push(`File: \`${file.name}\`\n\n[Skipped: larger than 5MB]`);
        continue;
      }
      if (isPdf) {
        try {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const res = await fetch("/api/files/extract-text", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: base64 }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || "Could not read PDF");
          }
          const data = (await res.json()) as { text?: string };
          const clipped = (data.text || "").slice(0, 40000);
          parts.push(`File: \`${file.name}\` (PDF)\n\`\`\`\n${clipped || "[No text extracted]"}\n\`\`\``);
        } catch (e) {
          parts.push(`File: \`${file.name}\` (PDF)\n\n[Could not read PDF: ${e instanceof Error ? e.message : "unknown"}]`);
        }
        continue;
      }
      if (file.size > 200 * 1024) {
        parts.push(`File: \`${file.name}\`\n\n[Skipped: larger than 200KB]`);
        continue;
      }
      try {
        const text = await file.text();
        const clipped = text.slice(0, 40000);
        parts.push(`File: \`${file.name}\`\n\`\`\`\n${clipped}\n\`\`\``);
      } catch {
        parts.push(`File: \`${file.name}\`\n\n[Could not read as text]`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (parts.length === 0) {
      setUploading(false);
      return;
    }
    const prompt = [
      "Please analyze, explain, and summarize the uploaded file(s).",
      "Include: purpose, key functions/components, dependencies, possible bugs, and recommended improvements.",
      "",
      ...parts,
    ].join("\n");
    setUploading(false);
    showToast(`Added ${parts.length} file(s) to the prompt for analysis.`, "success");
    void send(prompt);
  };

  const toggleVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showToast("Voice input is not supported in this browser.", "error");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    const base = input;
    let finalText = "";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${chunk} `;
        else interim += chunk;
      }
      setInput(`${base}${base ? " " : ""}${finalText}${interim}`.trimStart());
    };
    rec.onerror = () => {
      setListening(false);
      showToast("Voice input error.", "error");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      showToast("Could not start voice input.", "error");
    }
  };

  return (
    <main
      className="flex-1 flex flex-col min-w-0 nexo-glass bg-nexo-panel border border-nexo-border rounded-2xl overflow-hidden transition-colors duration-300 relative"
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer?.files?.length) setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFilesForSummary(e.dataTransfer?.files || null);
      }}
    >
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-nexo-composer/90 border-2 border-dashed border-nexo-brand text-nexo-fg pointer-events-none">
          <span className="font-medium">Drop files to analyze & summarize</span>
        </div>
      )}
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
                Describe your app or fix — NEXOPLUS writes, fixes, and refactors code and generates project files you can download.
              </p>
              <p className="mt-3 text-[12px] text-nexo-muted max-w-md mx-auto">
                Code-focused: software development tasks only. Not for web browsing, surfing, or general research.
              </p>
              <p className="mt-3 text-[11px] text-nexo-muted max-w-md mx-auto">
                Use the paperclip or drag-and-drop to upload files (including PDFs) for summary/analysis, and the mic icon for voice input.
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
                      {editingId === m.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={draftContent}
                            onChange={(e) => setDraftContent(e.target.value)}
                            className="w-full min-h-[120px] max-h-[40vh] rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-[13px] font-mono focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={saveEditedMessage} className="text-[11px] px-3 py-1.5 rounded-lg nexo-btn-primary">
                              Save edit
                            </button>
                            <button type="button" onClick={cancelEditMessage} className="text-[11px] px-3 py-1.5 rounded-lg border border-nexo-border text-nexo-muted hover:bg-nexo-hover">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : m.content ? (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              pre({ children }) {
                                const text = extractMarkdownText(children);
                                return (
                                  <div className="relative group my-3">
                                    <button
                                      type="button"
                                      onClick={() => void copyMessage(text)}
                                      className="absolute right-2 top-2 text-[10px] px-2 py-1 rounded-md border border-nexo-border bg-nexo-composer text-nexo-muted hover:text-nexo-fg opacity-0 group-hover:opacity-100 transition"
                                    >
                                      Copy code
                                    </button>
                                    <pre>{children}</pre>
                                  </div>
                                );
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                          {sending &&
                            m.id === streamingAssistantId &&
                            generationPhase &&
                            generationPhase !== "drafting" && (
                              <p className="mt-2 flex items-center gap-2 text-[12px] text-nexo-muted">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {labelForPhase(generationPhase, generationDetail)}
                              </p>
                            )}
                          {!sending || m.id !== streamingAssistantId ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => void copyMessage(m.content)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-nexo-border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg">
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                              <button type="button" onClick={() => startEditMessage(m)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-nexo-border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button type="button" onClick={() => regenerateMessage(m.id)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-nexo-border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg">
                                <RotateCcw className="w-3 h-3" /> Regenerate
                              </button>
                              <button type="button" onClick={() => forkFromMessage(m.id)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-nexo-border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg">
                                <MessageSquarePlus className="w-3 h-3" /> New chat from this
                              </button>
                            </div>
                          ) : null}
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFilesForSummary(e.target.files)}
            />
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
              <div className="flex items-center gap-1.5 pl-1 min-w-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                  title="Upload file to analyze/summarize"
                  className="shrink-0 p-1.5 rounded-lg border border-nexo-border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg disabled:opacity-30"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={sending || uploading}
                  title={listening ? "Stop voice input" : "Voice to text"}
                  className={`shrink-0 p-1.5 rounded-lg border text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg disabled:opacity-30 ${
                    listening ? "border-red-500/50 text-red-400" : "border-nexo-border"
                  }`}
                >
                  {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <span className="hidden sm:inline text-[11px] text-nexo-muted truncate">
                  {activeMode?.label ?? "NEXOPLUS Smart"}
                </span>
              </div>
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
