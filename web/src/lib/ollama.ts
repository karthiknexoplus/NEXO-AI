const API_BASE = "/api/ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaModel {
  name: string;
}

const SYSTEM_PROMPT = `You are NEXO, an expert AI software developer embedded in a Cursor-style IDE.
You help users design, build, debug, and ship production-ready full-stack applications.
Write clean, maintainable code. Use markdown code fences with language tags when showing files.
Be direct and practical. When the user asks to build a project, propose structure and generate complete file contents step by step.`;

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/tags`);
  if (!res.ok) {
    throw new Error("Cannot reach Ollama. Run: ollama serve");
  }
  const data = (await res.json()) as { models?: OllamaModel[] };
  return (data.models ?? []).map((m) => m.name);
}

export async function streamChat(
  messages: ChatMessage[],
  model: string,
  onToken: (t: string) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.25,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.toLowerCase().includes("not found")) {
      throw new Error(`Model "${model}" not found. Run: ollama pull ${model.split(":")[0]}`);
    }
    throw new Error(text || `Request failed (${res.status})`);
  }

  if (!res.body) {
    throw new Error("No response stream");
  }

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
        const token =
          parsed.choices?.[0]?.delta?.content ??
          parsed.choices?.[0]?.delta?.reasoning;
        if (token) onToken(token);
      } catch {
        /* skip */
      }
    }
  }
}
