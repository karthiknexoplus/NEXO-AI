/** Server-only model routing — never expose raw model names to the browser. */

/** Default llama3.2:3b fits 4 GB VPS (CPU-only). Override with NEXO_MODEL* env. */
const DEFAULT_MODEL = process.env.NEXO_MODEL || "llama3.2:3b";

const MODES = {
  fast: process.env.NEXO_MODEL_FAST || DEFAULT_MODEL,
  smart: process.env.NEXO_MODEL_SMART || DEFAULT_MODEL,
  deep: process.env.NEXO_MODEL_DEEP || DEFAULT_MODEL,
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
