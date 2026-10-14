export type IntelligenceMode = "fast" | "smart" | "deep";

export interface IntelligenceModeOption {
  id: IntelligenceMode;
  label: string;
  hint: string;
}

import { shouldDropStreamToken } from "./sanitizeAssistant";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_MODES: IntelligenceModeOption[] = [
  { id: "fast", label: "NEXOPLUS Fast", hint: "Quicker drafts" },
  { id: "smart", label: "NEXOPLUS Smart", hint: "Recommended" },
  { id: "deep", label: "NEXOPLUS Deep", hint: "Complex builds" },
];

export async function fetchIntelligenceModes(): Promise<IntelligenceModeOption[]> {
  try {
    const res = await fetch("/api/intelligence/modes", { credentials: "include" });
    if (!res.ok) return DEFAULT_MODES;
    const data = (await res.json()) as { modes: IntelligenceModeOption[] };
    return data.modes?.length ? data.modes : DEFAULT_MODES;
  } catch {
    return DEFAULT_MODES;
  }
}

let activeChatAbort: AbortController | null = null;

export function abortIntelligenceChat() {
  activeChatAbort?.abort();
  activeChatAbort = null;
}

export async function streamIntelligenceChat(
  messages: ChatMessage[],
  mode: IntelligenceMode,
  onToken: (t: string) => void,
  signal?: AbortSignal
): Promise<void> {
  activeChatAbort?.abort();
  const controller = new AbortController();
  activeChatAbort = controller;
  const linked = signal ?? controller.signal;

  let res: Response;
  try {
    res = await fetch("/api/intelligence/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ mode, messages }),
      signal: linked,
    });
  } catch (e) {
    if (linked.aborted) throw new Error("Stopped");
    throw new Error("Load failed");
  } finally {
    if (activeChatAbort === controller) activeChatAbort = null;
  }

  if (!res.ok) {
    let message = "NEXOPLUS could not respond right now. Please try again.";
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error("NEXOPLUS could not respond right now.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
      if (!jsonStr.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(jsonStr) as {
          choices?: Array<{ delta?: { content?: string; reasoning?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        let token = delta?.content;
        if (!token?.trim() && delta?.reasoning) token = delta.reasoning;
        if (token && !shouldDropStreamToken(token)) onToken(token);
      } catch {
        /* skip */
      }
    }
  }
}
