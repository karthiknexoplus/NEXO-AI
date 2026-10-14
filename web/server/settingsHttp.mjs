import {
  getGithubSettings,
  getOAuthSettings,
  getProviderSettings,
  publicGithubSettings,
  publicOAuthSettings,
  publicProviderSettings,
  setGithubSettings,
  setOAuthSettings,
  setProviderSettings,
} from "./dataStore.mjs";
import { requireAuth } from "./authHttp.mjs";

const ALLOWED_KEYS = new Set([
  "activeProvider",
  "openrouterApiKey",
  "groqApiKey",
  "opencodeZenApiKey",
  "customApiKey",
  "customBaseUrl",
  "ollamaHost",
  "ollamaFallback",
  "modelFast",
  "modelSmart",
  "modelDeep",
  "cloudTimeoutMs",
]);

function requireSettingsAdmin(req, res, sendJson) {
  const session = requireAuth(req, res, sendJson);
  if (!session) return null;
  if (!session.canManageSettings) {
    sendJson(res, 403, { error: "Only the studio admin can change server settings" });
    return null;
  }
  return session;
}

export function handleSettingsProvidersGet(req, res, sendJson) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  const providers = getProviderSettings();
  return sendJson(res, 200, publicProviderSettings(providers));
}

export async function handleSettingsProvidersPut(req, res, sendJson, readBody) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  const patch = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v === "string" && v.includes("••••")) continue;
    patch[k] = v;
  }

  const updated = setProviderSettings(patch);
  return sendJson(res, 200, publicProviderSettings(updated));
}

export function handleSettingsGithubGet(req, res, sendJson) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  return sendJson(res, 200, publicGithubSettings(getGithubSettings()));
}

export async function handleSettingsGithubPut(req, res, sendJson, readBody) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const patch = {};
  if (typeof body.username === "string") patch.username = body.username;
  if (typeof body.token === "string" && !body.token.includes("••••")) {
    patch.token = body.token;
  }
  const updated = setGithubSettings(patch);
  return sendJson(res, 200, publicGithubSettings(updated));
}

export function handleSettingsOAuthGet(req, res, sendJson) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  return sendJson(res, 200, publicOAuthSettings(getOAuthSettings()));
}

export async function handleSettingsOAuthPut(req, res, sendJson, readBody) {
  if (!requireSettingsAdmin(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const patch = {};
  if (typeof body.googleClientId === "string") patch.googleClientId = body.googleClientId;
  if (typeof body.googleClientSecret === "string" && !body.googleClientSecret.includes("••••")) {
    patch.googleClientSecret = body.googleClientSecret;
  }
  const updated = setOAuthSettings(patch);
  return sendJson(res, 200, publicOAuthSettings(updated));
}
