import { randomBytes } from "node:crypto";
import { getOAuthSettings, loadStore, saveStore } from "./dataStore.mjs";

const STATE_TTL_MS = 10 * 60 * 1000;

export function createOAuthState() {
  const state = randomBytes(24).toString("hex");
  const store = loadStore();
  store.oauthStates = store.oauthStates || {};
  store.oauthStates[state] = { expires: Date.now() + STATE_TTL_MS };
  saveStore(store);
  return state;
}

export function consumeOAuthState(state) {
  if (!state) return false;
  const store = loadStore();
  const entry = store.oauthStates?.[state];
  if (!entry || entry.expires < Date.now()) return false;
  delete store.oauthStates[state];
  saveStore(store);
  return true;
}

export function getGoogleOAuthConfig() {
  const o = getOAuthSettings();
  const clientId = o.googleClientId || process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = o.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "";
  return { clientId, clientSecret, enabled: !!(clientId && clientSecret) };
}

export function googleAuthUrl(redirectUri, state) {
  const { clientId } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code, redirectUri) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return { ok: false, error: tokenData.error_description || tokenData.error || "Token exchange failed" };
  }
  const accessToken = tokenData.access_token;
  if (!accessToken) return { ok: false, error: "No access token" };

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || !profile.email) {
    return { ok: false, error: "Could not read Google profile" };
  }
  return {
    ok: true,
    email: profile.email,
    name: profile.name || profile.email,
    googleId: profile.id,
  };
}
