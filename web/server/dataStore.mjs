import fs from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.NEXO_DATA_DIR || path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "nexoplus-store.json");

const DEFAULT_EMAIL = "karthik@nexoplus.in";
const DEFAULT_PASSWORD = "Nexoplus@1234";

const DEFAULT_GITHUB = {
  token: "",
  username: "",
};

const DEFAULT_OAUTH = {
  googleClientId: "",
  googleClientSecret: "",
};

const DEFAULT_PROVIDERS = {
  activeProvider: "openrouter",
  openrouterApiKey: "",
  groqApiKey: "",
  opencodeZenApiKey: "",
  customApiKey: "",
  customBaseUrl: "",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaFallback: true,
  modelFast: "openrouter/free",
  modelSmart: "openrouter/free",
  modelDeep: "openrouter/free",
  cloudTimeoutMs: 300000,
};

function hashPassword(password, saltHex) {
  const salt = saltHex || randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const trial = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === trial.length && timingSafeEqual(expected, trial);
}

function emptyStore() {
  const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
  return {
    users: [{ id: "1", email: DEFAULT_EMAIL, salt, hash }],
    sessions: {},
    providers: { ...DEFAULT_PROVIDERS },
    github: { ...DEFAULT_GITHUB },
    oauth: { ...DEFAULT_OAUTH },
    oauthStates: {},
  };
}

export function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const initial = emptyStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    if (!data.users?.length) {
      const seeded = emptyStore();
      data.users = seeded.users;
    }
    data.providers = { ...DEFAULT_PROVIDERS, ...data.providers };
    data.github = { ...DEFAULT_GITHUB, ...data.github };
    data.oauth = { ...DEFAULT_OAUTH, ...data.oauth };
    data.oauthStates = data.oauthStates || {};
    data.sessions = data.sessions || {};
    return data;
  } catch {
    const initial = emptyStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function saveStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function getProviderSettings() {
  return { ...loadStore().providers };
}

export function setProviderSettings(patch) {
  const store = loadStore();
  store.providers = { ...store.providers, ...patch };
  saveStore(store);
  return getProviderSettings();
}

export function getGithubSettings() {
  return { ...loadStore().github };
}

export function setGithubSettings(patch) {
  const store = loadStore();
  store.github = { ...store.github, ...patch };
  saveStore(store);
  return getGithubSettings();
}

export function publicGithubSettings(github) {
  return {
    username: github.username || "",
    token: maskSecret(github.token),
    hasToken: !!github.token,
  };
}

export function createSession(userId, extra = {}) {
  const store = loadStore();
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  store.sessions[token] = { userId, expires, ...extra };
  saveStore(store);
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const store = loadStore();
  const s = store.sessions[token];
  if (!s || s.expires < Date.now()) {
    if (s) {
      delete store.sessions[token];
      saveStore(store);
    }
    return null;
  }
  const user = store.users.find((u) => u.id === s.userId);
  if (!user) {
    if (s.userId?.startsWith("guest-")) {
      return {
        userId: s.userId,
        email: s.guestLabel || "Guest",
        isGuest: true,
        canManageSettings: false,
      };
    }
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    isGuest: !!user.isGuest,
    canManageSettings: !user.isGuest,
  };
}

export function destroySession(token) {
  const store = loadStore();
  if (store.sessions[token]) {
    delete store.sessions[token];
    saveStore(store);
  }
}

export function authenticateUser(email, password) {
  const store = loadStore();
  const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.isGuest || !user.salt || !user.hash) return null;
  if (!verifyPassword(password, user.salt, user.hash)) return null;
  return { id: user.id, email: user.email };
}

export function registerUser(email, password) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email" };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  const store = loadStore();
  if (store.users.some((u) => u.email.toLowerCase() === normalized)) {
    return { ok: false, error: "An account with this email already exists" };
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: `u-${Date.now()}`,
    email: normalized,
    salt,
    hash,
    createdAt: Date.now(),
  };
  store.users.push(user);
  saveStore(store);
  return { ok: true, user: { id: user.id, email: user.email } };
}

export function createGuestSessionUser() {
  const id = `guest-${randomBytes(8).toString("hex")}`;
  const label = `Guest ${id.slice(-4)}`;
  return { id, label };
}

export function findOrCreateGoogleUser(email, googleId, name) {
  const store = loadStore();
  const normalized = email.toLowerCase();
  let user = store.users.find(
    (u) => u.googleId === googleId || u.email.toLowerCase() === normalized
  );
  if (!user) {
    user = {
      id: `u-${Date.now()}`,
      email: normalized,
      googleId,
      name: name || normalized,
      createdAt: Date.now(),
      authProvider: "google",
    };
    store.users.push(user);
    saveStore(store);
  } else if (!user.googleId) {
    user.googleId = googleId;
    saveStore(store);
  }
  return { id: user.id, email: user.email };
}

export function getOAuthSettings() {
  return { ...loadStore().oauth };
}

export function setOAuthSettings(patch) {
  const store = loadStore();
  store.oauth = { ...store.oauth, ...patch };
  saveStore(store);
  return getOAuthSettings();
}

export function publicOAuthSettings(oauth) {
  const clientId = oauth.googleClientId || process.env.GOOGLE_CLIENT_ID || "";
  const hasSecret = !!(oauth.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET);
  return {
    googleClientId: clientId,
    googleClientSecret: maskSecret(oauth.googleClientSecret),
    googleEnabled: !!(clientId && (hasSecret || process.env.GOOGLE_CLIENT_SECRET)),
    hasGoogleSecret: hasSecret,
  };
}

export function maskSecret(value) {
  if (!value || value.length < 8) return value ? "••••••••" : "";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function publicProviderSettings(providers) {
  return {
    activeProvider: providers.activeProvider,
    openrouterApiKey: maskSecret(providers.openrouterApiKey),
    groqApiKey: maskSecret(providers.groqApiKey),
    opencodeZenApiKey: maskSecret(providers.opencodeZenApiKey),
    customApiKey: maskSecret(providers.customApiKey),
    customBaseUrl: providers.customBaseUrl || "",
    ollamaHost: providers.ollamaHost || DEFAULT_PROVIDERS.ollamaHost,
    ollamaFallback: !!providers.ollamaFallback,
    modelFast: providers.modelFast,
    modelSmart: providers.modelSmart,
    modelDeep: providers.modelDeep,
    cloudTimeoutMs: providers.cloudTimeoutMs,
    hasOpenrouterKey: !!providers.openrouterApiKey,
    hasGroqKey: !!providers.groqApiKey,
    hasOpencodeKey: !!providers.opencodeZenApiKey,
    hasCustomKey: !!providers.customApiKey && !!providers.customBaseUrl,
  };
}
