/** Server-only: OpenAI-compatible cloud APIs (keys never sent to browser). */

import { resolveMaxOutputTokens } from "./limits.mjs";

export function intelligenceBackend() {
  const forced = (process.env.NEXO_INTELLIGENCE_PROVIDER || "").toLowerCase();
  if (forced === "ollama") return "ollama";
  if (forced === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (forced === "opencode" && process.env.OPENCODE_ZEN_API_KEY) return "opencode";
  if (forced === "custom" && process.env.NEXO_API_KEY && process.env.NEXO_OPENAI_BASE_URL) {
    return "custom";
  }

  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENCODE_ZEN_API_KEY) return "opencode";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.NEXO_API_KEY && process.env.NEXO_OPENAI_BASE_URL) return "custom";
  return "ollama";
}

const CLOUD_MODELS = {
  openrouter: {
    // Per-model :free slugs are often disabled per account; openrouter/free still works for many keys.
    fast: process.env.NEXO_CLOUD_MODEL_FAST || "openrouter/free",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || "openrouter/free",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || "openrouter/free",
  },
  groq: {
    fast: process.env.NEXO_CLOUD_MODEL_FAST || "openai/gpt-oss-20b",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || "openai/gpt-oss-120b",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || "openai/gpt-oss-120b",
  },
  opencode: {
    // OpenCode Zen — model IDs from https://opencode.ai/zen/v1/models (chat/completions models)
    fast: process.env.NEXO_CLOUD_MODEL_FAST || process.env.OPENCODE_ZEN_MODEL || "gpt-5.5",
    smart: process.env.NEXO_CLOUD_MODEL_SMART || process.env.OPENCODE_ZEN_MODEL || "gpt-5.5",
    deep: process.env.NEXO_CLOUD_MODEL_DEEP || process.env.OPENCODE_ZEN_MODEL || "gpt-5.5-pro",
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
    max_tokens: resolveMaxOutputTokens(mode),
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

  if (backend === "opencode") {
    const zenBase = (process.env.OPENCODE_ZEN_BASE_URL || "https://opencode.ai/zen/v1").replace(
      /\/$/,
      ""
    );
    const url = zenBase.endsWith("/chat/completions")
      ? zenBase
      : `${zenBase}/chat/completions`;
    return {
      url,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${process.env.OPENCODE_ZEN_API_KEY}`,
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
