import {
  authenticateUser,
  createGuestSessionUser,
  createSession,
  destroySession,
  findOrCreateGoogleUser,
  getSession,
  registerUser,
} from "./dataStore.mjs";
import {
  consumeOAuthState,
  createOAuthState,
  exchangeGoogleCode,
  getGoogleOAuthConfig,
  googleAuthUrl,
} from "./googleOAuth.mjs";

const COOKIE_NAME = "nexo_session";

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

export function publicOrigin(req) {
  const env = process.env.NEXO_PUBLIC_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3080";
  const proto = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function cookieSecure(req) {
  if (process.env.NEXO_SECURE_COOKIES === "1") return true;
  const origin = publicOrigin(req);
  return origin.startsWith("https://");
}

function cookieSuffix(req) {
  return cookieSecure(req) ? "; Secure" : "";
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return getSession(cookies[COOKIE_NAME]);
}

export function setSessionCookie(res, token, req) {
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSuffix(req)}`
  );
}

export function clearSessionCookie(res, req) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0${cookieSuffix(req)}`
  );
}

function sessionPayload(session) {
  return {
    ok: true,
    email: session.email,
    isGuest: !!session.isGuest,
    canManageSettings: !!session.canManageSettings,
  };
}

export function handleAuthLogin(req, res, sendJson, readBody) {
  return readBody(req).then((raw) => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "Invalid request" });
    }
    const user = authenticateUser(body.email || "", body.password || "");
    if (!user) return sendJson(res, 401, { error: "Invalid email or password" });
    const token = createSession(user.id);
    setSessionCookie(res, token, req);
    return sendJson(res, 200, sessionPayload({ ...user, isGuest: false, canManageSettings: true }));
  });
}

export function handleAuthRegister(req, res, sendJson, readBody) {
  return readBody(req).then((raw) => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "Invalid request" });
    }
    const result = registerUser(body.email || "", body.password || "");
    if (!result.ok) return sendJson(res, 400, { error: result.error });
    const token = createSession(result.user.id);
    setSessionCookie(res, token, req);
    return sendJson(res, 200, sessionPayload({ ...result.user, isGuest: false, canManageSettings: true }));
  });
}

export function handleAuthGuest(req, res, sendJson) {
  const guest = createGuestSessionUser();
  const token = createSession(guest.id, { guestLabel: guest.label });
  setSessionCookie(res, token, req);
  return sendJson(res, 200, {
    ok: true,
    email: guest.label,
    isGuest: true,
    canManageSettings: false,
  });
}

export function handleAuthLogout(res, sendJson, req) {
  const cookies = parseCookies(req);
  destroySession(cookies[COOKIE_NAME]);
  clearSessionCookie(res, req);
  return sendJson(res, 200, { ok: true });
}

export function handleAuthMe(req, res, sendJson) {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, ...sessionPayload(session) });
}

export function handleAuthConfig(req, res, sendJson) {
  const { clientId, enabled } = getGoogleOAuthConfig();
  return sendJson(res, 200, {
    googleEnabled: enabled,
    googleClientId: enabled ? clientId : "",
  });
}

export function handleGoogleStart(req, res) {
  const { enabled } = getGoogleOAuthConfig();
  if (!enabled) {
    res.writeHead(302, { Location: "/?auth_error=google_not_configured" });
    return res.end();
  }
  const origin = publicOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = createOAuthState();
  const url = googleAuthUrl(redirectUri, state);
  res.writeHead(302, {
    Location: url,
    "Set-Cookie": `nexo_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${cookieSuffix(req)}`,
  });
  res.end();
}

export async function handleGoogleCallback(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req);
  const origin = publicOrigin(req);

  if (!code || !state || cookies.nexo_oauth_state !== state || !consumeOAuthState(state)) {
    res.writeHead(302, { Location: "/?auth_error=google_denied" });
    return res.end();
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const result = await exchangeGoogleCode(code, redirectUri);
  if (!result.ok) {
    res.writeHead(302, { Location: `/?auth_error=${encodeURIComponent(result.error || "google_failed")}` });
    return res.end();
  }

  const user = findOrCreateGoogleUser(result.email, result.googleId, result.name);
  const token = createSession(user.id);
  setSessionCookie(res, token, req);
  res.writeHead(302, { Location: "/?signed_in=1" });
  res.end();
}

export function requireAuth(req, res, sendJson) {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "Sign in required" });
    return null;
  }
  return session;
}
