import * as vscode from "vscode";

export type LlmProvider = "openrouter" | "ollama" | "custom";

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

/** Curated suggestions when Ollama tags API is empty or unreachable. */
export const SUGGESTED_OLLAMA_MODELS = [
  "qwen2.5-coder",
  "deepseek-r1",
  "llama3.2",
  "codellama",
  "mistral",
] as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface StreamCallbacks {
  onToken: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
}

export class LlmClientError extends Error {
  constructor(
    message: string,
    readonly code: "OLLAMA_OFFLINE" | "MODEL_NOT_FOUND" | "HTTP_ERROR" | "NETWORK" | "UNKNOWN",
    readonly detail?: string
  ) {
    super(message);
    this.name = "LlmClientError";
  }
}

export function normalizeOllamaBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  return trimmed.replace(/\/v1$/, "");
}

export function getLlmConfigFromWorkspace(
  overrides?: Partial<LlmConfig>
): LlmConfig {
  const config = vscode.workspace.getConfiguration("cursor-clone");
  const provider = (overrides?.provider ??
    config.get<LlmProvider>("provider")) as LlmProvider;

  let baseUrl = overrides?.baseUrl ?? "";
  let apiKey = overrides?.apiKey ?? "";
  let model = overrides?.model ?? "";

  switch (provider) {
    case "openrouter":
      baseUrl = baseUrl || "https://openrouter.ai/api/v1";
      apiKey =
        apiKey ||
        config.get<string>("openRouterApiKey") ||
        process.env.OPENROUTER_API_KEY ||
        "";
      model = model || config.get<string>("openRouterModel") || "openrouter/free";
      break;
    case "ollama":
      baseUrl = normalizeOllamaBaseUrl(
        baseUrl || config.get<string>("ollamaBaseUrl") || OLLAMA_DEFAULT_BASE_URL
      );
      apiKey = "";
      model =
        model ||
        config.get<string>("ollamaModel") ||
        SUGGESTED_OLLAMA_MODELS[0];
      break;
    case "custom":
      baseUrl = (baseUrl || config.get<string>("customBaseUrl") || "").replace(/\/$/, "");
      apiKey = apiKey || config.get<string>("customApiKey") || "";
      model = model || config.get<string>("customModel") || "gpt-4o-mini";
      break;
  }

  return { provider, baseUrl, apiKey, model };
}

export function chatCompletionsUrl(config: LlmConfig): string {
  if (config.provider === "ollama") {
    return `${normalizeOllamaBaseUrl(config.baseUrl)}/v1/chat/completions`;
  }
  const base = config.baseUrl.replace(/\/$/, "");
  return `${base}/chat/completions`;
}

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://cursor-clone.local";
    headers["X-Title"] = "Cursor Clone VS Code Extension";
  }
  return headers;
}

export async function pingOllama(baseUrl?: string): Promise<boolean> {
  const root = normalizeOllamaBaseUrl(baseUrl ?? OLLAMA_DEFAULT_BASE_URL);
  try {
    const response = await fetch(`${root}/api/tags`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(baseUrl?: string): Promise<OllamaModelInfo[]> {
  const root = normalizeOllamaBaseUrl(baseUrl ?? OLLAMA_DEFAULT_BASE_URL);
  try {
    const response = await fetch(`${root}/api/tags`, { method: "GET" });
    if (!response.ok) {
      throw new LlmClientError(
        `Ollama responded with HTTP ${response.status}. Is the server running at ${root}?`,
        "HTTP_ERROR",
        await safeReadText(response)
      );
    }

    const payload = (await response.json()) as {
      models?: Array<{ name: string; size?: number; modified_at?: string }>;
    };

    return (payload.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));
  } catch (err) {
    throw mapToLlmClientError(err, {
      provider: "ollama",
      baseUrl: root,
      apiKey: "",
      model: "",
    });
  }
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  config: LlmConfig,
  callbacks: StreamCallbacks,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  if (config.provider === "ollama") {
    const online = await pingOllama(config.baseUrl);
    if (!online) {
      const error = new LlmClientError(
        `Ollama is not reachable at ${normalizeOllamaBaseUrl(config.baseUrl)}. Start it with \`ollama serve\` and ensure the model is pulled.`,
        "OLLAMA_OFFLINE"
      );
      notifyUser(error);
      callbacks.onError(error);
      return;
    }
  }

  const url = chatCompletionsUrl(config);
  const body = {
    model: config.model,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 4096,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      const error = mapHttpError(config, response.status, detail);
      notifyUser(error);
      callbacks.onError(error);
      return;
    }

    if (!response.body) {
      const error = new LlmClientError("No response body for streaming.", "UNKNOWN");
      callbacks.onError(error);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const token = parseSseLine(line);
        if (token) {
          callbacks.onToken(token);
        }
      }
    }

    if (buffer.trim()) {
      const token = parseSseLine(buffer);
      if (token) {
        callbacks.onToken(token);
      }
    }

    callbacks.onDone();
  } catch (err) {
    const error = mapToLlmClientError(err, config);
    notifyUser(error);
    callbacks.onError(error);
  }
}

export async function completeText(
  messages: ChatMessage[],
  config: LlmConfig,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  let result = "";
  await streamChatCompletion(
    messages,
    config,
    {
      onToken: (t) => {
        result += t;
      },
      onDone: () => undefined,
      onError: (e) => {
        throw e;
      },
    },
    options
  );
  return result.trim();
}

function parseSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "data: [DONE]") {
    return null;
  }

  const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
  if (!jsonStr.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr) as {
      choices?: Array<{
        delta?: { content?: string; reasoning?: string };
        message?: { content?: string };
      }>;
      message?: { content?: string };
    };

    const choice = parsed.choices?.[0];
    const delta = choice?.delta;
    const content =
      delta?.content ??
      delta?.reasoning ??
      choice?.message?.content ??
      parsed.message?.content;

    return content ?? null;
  } catch {
    return null;
  }
}

function mapHttpError(config: LlmConfig, status: number, detail: string): LlmClientError {
  const lower = detail.toLowerCase();
  const model = config.model;

  if (
    config.provider === "ollama" &&
    (status === 404 || lower.includes("not found") || lower.includes("does not exist"))
  ) {
    return new LlmClientError(
      `Model "${model}" is not available in Ollama. Run \`ollama pull ${model}\` and try again.`,
      "MODEL_NOT_FOUND",
      detail
    );
  }

  if (config.provider === "ollama" && (status === 502 || status === 503)) {
    return new LlmClientError(
      `Ollama is temporarily unavailable at ${normalizeOllamaBaseUrl(config.baseUrl)}.`,
      "OLLAMA_OFFLINE",
      detail
    );
  }

  return new LlmClientError(
    `LLM request failed (${status})${detail ? `: ${detail}` : ""}`,
    "HTTP_ERROR",
    detail
  );
}

function mapToLlmClientError(err: unknown, config: LlmConfig): LlmClientError {
  if (err instanceof LlmClientError) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const model = config.model;

  if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("network") ||
    lower.includes("failed to fetch")
  ) {
    if (config.provider === "ollama") {
      return new LlmClientError(
        `Cannot connect to Ollama at ${normalizeOllamaBaseUrl(config.baseUrl)}. Start the daemon with \`ollama serve\`.`,
        "OLLAMA_OFFLINE",
        message
      );
    }
    return new LlmClientError(`Network error while calling the LLM API: ${message}`, "NETWORK", message);
  }

  if (
    config.provider === "ollama" &&
    model &&
    (lower.includes("not found") || lower.includes("pull"))
  ) {
    return new LlmClientError(
      `Model "${model}" may not be pulled yet. Run \`ollama pull ${model}\`.`,
      "MODEL_NOT_FOUND",
      message
    );
  }

  return new LlmClientError(message, "UNKNOWN", message);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function notifyUser(error: LlmClientError): void {
  if (error.code === "OLLAMA_OFFLINE" || error.code === "MODEL_NOT_FOUND") {
    void vscode.window.showErrorMessage(error.message);
  }
}
