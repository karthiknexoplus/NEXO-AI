/** Server-only model routing — never expose raw model names to the browser. */

const MODES = {
  fast: process.env.NEXO_MODEL_FAST || process.env.NEXO_MODEL || "qwen2.5-coder",
  smart: process.env.NEXO_MODEL || "qwen2.5-coder",
  deep: process.env.NEXO_MODEL_DEEP || process.env.NEXO_MODEL || "qwen2.5-coder",
};

export function resolveModel(mode) {
  if (mode && MODES[mode]) return MODES[mode];
  return MODES.smart;
}

export function publicModes() {
  return [
    { id: "fast", label: "NEXOPLUS Fast", hint: "Quicker drafts" },
    { id: "smart", label: "NEXOPLUS Smart", hint: "Recommended" },
    { id: "deep", label: "NEXOPLUS Deep", hint: "Complex builds" },
  ];
}
