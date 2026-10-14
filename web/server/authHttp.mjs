import {
  authenticateUser,
  createSession,
  destroySession,
  getSession,
} from "./dataStore.mjs";

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

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return getSession(cookies[COOKIE_NAME]);
}

export function setSessionCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
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
    setSessionCookie(res, token);
    return sendJson(res, 200, { ok: true, email: user.email });
  });
}

export function handleAuthLogout(res, sendJson, req) {
  const cookies = parseCookies(req);
  destroySession(cookies[COOKIE_NAME]);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}

export function handleAuthMe(req, res, sendJson) {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, email: session.email });
}

export function requireAuth(req, res, sendJson) {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "Sign in required" });
    return null;
  }
  return session;
}
