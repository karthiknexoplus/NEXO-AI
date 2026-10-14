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

export function createSession(userId) {
  const store = loadStore();
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  store.sessions[token] = { userId, expires };
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
  if (!user) return null;
  return { userId: user.id, email: user.email };
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
  if (!user || !verifyPassword(password, user.salt, user.hash)) return null;
  return { id: user.id, email: user.email };
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
