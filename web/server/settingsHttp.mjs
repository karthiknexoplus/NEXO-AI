import {
  getGithubSettings,
  getProviderSettings,
  publicGithubSettings,
  publicProviderSettings,
  setGithubSettings,
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

export function handleSettingsProvidersGet(req, res, sendJson) {
  if (!requireAuth(req, res, sendJson)) return;
  const providers = getProviderSettings();
  return sendJson(res, 200, publicProviderSettings(providers));
}

export async function handleSettingsProvidersPut(req, res, sendJson, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
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
  if (!requireAuth(req, res, sendJson)) return;
  return sendJson(res, 200, publicGithubSettings(getGithubSettings()));
}

export async function handleSettingsGithubPut(req, res, sendJson, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
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
