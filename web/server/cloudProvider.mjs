/** Server-only: OpenAI-compatible cloud APIs (keys never sent to browser). */

export function intelligenceBackend() {
  const forced = (process.env.NEXO_INTELLIGENCE_PROVIDER || "").toLowerCase();
  if (forced === "ollama") return "ollama";
  if (forced === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (forced === "custom" && process.env.NEXO_API_KEY && process.env.NEXO_OPENAI_BASE_URL) {
    return "custom";
  }

  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.NEXO_API_KEY && process.env.NEXO_OPENAI_BASE_URL) return "custom";
  return "ollama";
}

const CLOUD_MODELS = {
  openrouter: {
    fast: process.env.NEXO_CLOUD_MODEL_FAST || "openrouter/free",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || "openrouter/free",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || "openrouter/free",
  },
  groq: {
    fast: process.env.NEXO_CLOUD_MODEL_FAST || "llama-3.1-8b-instant",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || "llama-3.3-70b-versatile",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || "llama-3.3-70b-versatile",
  },
  custom: {
    fast: process.env.NEXO_CLOUD_MODEL_FAST || process.env.NEXO_MODEL || "gpt-4o-mini",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || process.env.NEXO_MODEL || "gpt-4o-mini",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || process.env.NEXO_MODEL || "gpt-4o",
  },
};

export function resolveCloudModel(backend, mode) {
  const table = CLOUD_MODELS[backend];
  if (!table) return CLOUD_MODELS.openrouter.smart;
  return table[mode] || table.smart;
}

export function cloudChatRequest(backend, model, messages, mode) {
  const temperature = mode === "fast" ? 0.15 : 0.22;
  const body = {
    model,
    stream: true,
    temperature,
    messages,
  };

  if (backend === "openrouter") {
    return {
      url: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXO_PUBLIC_URL || "https://ai.nexoplus.in",
        "X-Title": "NEXOPLUS Web",
      },
      body,
    };
  }

  if (backend === "groq") {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body,
    };
  }

  const base = process.env.NEXO_OPENAI_BASE_URL.replace(/\/$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/v1/chat/completions`;
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${process.env.NEXO_API_KEY}`,
    },
    body,
  };
}

export function ollamaFallbackEnabled() {
  const v = (process.env.NEXO_OLLAMA_FALLBACK || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}
