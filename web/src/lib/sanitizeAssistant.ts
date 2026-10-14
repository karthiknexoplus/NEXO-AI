const SAFETY_LINE = /^\s*(?:user|response)\s+safety\s*:\s*\w+\s*$/gim;

export function shouldDropStreamToken(token: string): boolean {
  const t = (token || "").trim();
  if (!t) return false;
  return /^(?:user|response)\s+safety\s*:/i.test(t);
}

export function stripAssistantLeaks(text: string): string {
  if (!text) return "";
  return text.replace(SAFETY_LINE, "").trim();
}

export function isFailedAssistantReply(text: string): boolean {
  const clean = stripAssistantLeaks(text);
  if (!clean) return true;
  if (!clean.includes("```") && /safety\s*:\s*\w+/i.test(clean) && clean.length < 120) {
    return true;
  }
  return false;
}

export const STUB_REPLY_MESSAGE =
  "NEXOPLUS couldn't draft files for that message. Please send the request again, or try NEXOPLUS Fast mode. If it keeps happening, contact NEXOPLUS Automations support.";
