/** Server-side token / size limits (env overrides). */

export function resolveMaxOutputTokens(mode) {
  const override = Number(process.env.NEXO_MAX_OUTPUT_TOKENS || 0);
  if (override > 0) return override;

  const table = {
    fast: Number(process.env.NEXO_MAX_OUTPUT_TOKENS_FAST || 8192),
    smart: Number(process.env.NEXO_MAX_OUTPUT_TOKENS_SMART || 16384),
    deep: Number(process.env.NEXO_MAX_OUTPUT_TOKENS_DEEP || 32768),
  };
  return table[mode] || table.smart;
}

export function resolveOllamaNumPredict(mode) {
  const override = Number(process.env.NEXO_OLLAMA_NUM_PREDICT || 0);
  if (override > 0) return override;

  const table = {
    fast: 8192,
    smart: 16384,
    deep: 32768,
  };
  return table[mode] || table.smart;
}

export function resolveOllamaNumCtx(mode) {
  const override = Number(process.env.NEXO_OLLAMA_NUM_CTX || 0);
  if (override > 0) return override;

  const light = process.env.NEXO_LIGHT === "1" || process.env.NEXO_LIGHT === "true";
  if (light) {
    return mode === "deep" ? 8192 : 6144;
  }
  return mode === "deep" ? 32768 : mode === "fast" ? 8192 : 16384;
}

/** 0 = no limit (Node default). */
export function maxRequestBodyBytes() {
  return Number(process.env.NEXO_MAX_REQUEST_BYTES || 0);
}
