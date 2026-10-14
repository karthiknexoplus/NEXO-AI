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
    const res = await fetch("/api/intelligence/modes");
    if (!res.ok) return DEFAULT_MODES;
    const data = (await res.json()) as { modes: IntelligenceModeOption[] };
    return data.modes?.length ? data.modes : DEFAULT_MODES;
  } catch {
    return DEFAULT_MODES;
  }
}

export async function streamIntelligenceChat(
  messages: ChatMessage[],
  mode: IntelligenceMode,
  onToken: (t: string) => void
): Promise<void> {
  const res = await fetch("/api/intelligence/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ mode, messages }),
  });

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
        const token = parsed.choices?.[0]?.delta?.content;
        if (token && !shouldDropStreamToken(token)) onToken(token);
      } catch {
        /* skip */
      }
    }
  }
}
