/** Strip model-internal leakage (safety classifiers, etc.) from assistant text. */

const SAFETY_LINE = /^\s*(?:user|response)\s+safety\s*:\s*\w+\s*$/gim;

export function stripAssistantLeaks(text) {
  if (!text) return "";
  return text.replace(SAFETY_LINE, "").trim();
}

export function shouldDropStreamToken(token) {
  const t = (token || "").trim();
  if (!t) return false;
  return /^(?:user|response)\s+safety\s*:/i.test(t);
}

/** True when the model gave no usable answer (common with some free routers). */
export function isFailedAssistantReply(text) {
  const clean = stripAssistantLeaks(text);
  if (!clean) return true;
  if (!clean.includes("```") && /safety\s*:\s*\w+/i.test(clean) && clean.length < 120) {
    return true;
  }
  return false;
}
