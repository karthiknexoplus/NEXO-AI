/** Server-only: OpenAI-compatible cloud APIs (keys never sent to browser). */

import { getProviderSettings } from "./dataStore.mjs";
import { resolveMaxOutputTokens } from "./limits.mjs";

function settings() {
  const s = getProviderSettings();
  return {
    activeProvider: (s.activeProvider || "openrouter").toLowerCase(),
    openrouterApiKey: s.openrouterApiKey || process.env.OPENROUTER_API_KEY || "",
    groqApiKey: s.groqApiKey || process.env.GROQ_API_KEY || "",
    opencodeZenApiKey: s.opencodeZenApiKey || process.env.OPENCODE_ZEN_API_KEY || "",
    customApiKey: s.customApiKey || process.env.NEXO_API_KEY || "",
    customBaseUrl: s.customBaseUrl || process.env.NEXO_OPENAI_BASE_URL || "",
    ollamaHost: s.ollamaHost || process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
    ollamaFallback: s.ollamaFallback ?? true,
    modelFast: s.modelFast || "openrouter/free",
    modelSmart: s.modelSmart || "openrouter/free",
    modelDeep: s.modelDeep || "openrouter/free",
    cloudTimeoutMs: s.cloudTimeoutMs || Number(process.env.NEXO_CLOUD_TIMEOUT_MS || 300000),
    publicUrl: process.env.NEXO_PUBLIC_URL || "https://ai.nexoplus.in",
  };
}

export function getCloudTimeoutMs() {
  return settings().cloudTimeoutMs;
}

export function getOllamaHost() {
  return settings().ollamaHost;
}

export function intelligenceBackend() {
  const s = settings();
  const pick = s.activeProvider;

  if (pick === "ollama") return "ollama";
  if (pick === "openrouter" && s.openrouterApiKey) return "openrouter";
  if (pick === "groq" && s.groqApiKey) return "groq";
  if (pick === "opencode" && s.opencodeZenApiKey) return "opencode";
  if (pick === "custom" && s.customApiKey && s.customBaseUrl) return "custom";

  if (s.openrouterApiKey) return "openrouter";
  if (s.opencodeZenApiKey) return "opencode";
  if (s.groqApiKey) return "groq";
  if (s.customApiKey && s.customBaseUrl) return "custom";
  return "ollama";
}

export function resolveCloudModel(backend, mode) {
  const s = settings();
  const table = {
    openrouter: { fast: s.modelFast, smart: s.modelSmart, deep: s.modelDeep },
    groq: { fast: s.modelFast, smart: s.modelSmart, deep: s.modelDeep },
    opencode: { fast: s.modelFast, smart: s.modelSmart, deep: s.modelDeep },
    custom: { fast: s.modelFast, smart: s.modelSmart, deep: s.modelDeep },
  };
  const t = table[backend] || table.openrouter;
  return t[mode] || t.smart;
}

export function cloudChatRequest(backend, model, messages, mode) {
  const s = settings();
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
        Authorization: `Bearer ${s.openrouterApiKey}`,
        "HTTP-Referer": s.publicUrl,
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
        Authorization: `Bearer ${s.opencodeZenApiKey}`,
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
        Authorization: `Bearer ${s.groqApiKey}`,
      },
      body,
    };
  }

  const base = s.customBaseUrl.replace(/\/$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/v1/chat/completions`;
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${s.customApiKey}`,
    },
    body,
  };
}

export function ollamaFallbackEnabled() {
  const s = settings();
  if (s.ollamaFallback === false) return false;
  const v = (process.env.NEXO_OLLAMA_FALLBACK || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}
