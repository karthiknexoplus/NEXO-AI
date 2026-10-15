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
    users: [{ id: "1", email: DEFAULT_EMAIL, salt, hash, role: "admin" }],
    sessions: {},
    providers: { ...DEFAULT_PROVIDERS },
    github: { ...DEFAULT_GITHUB },
    oauth: { ...DEFAULT_OAUTH },
    oauthStates: {},
    analytics: { events: [] },
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
    data.analytics = data.analytics || { events: [] };
    if (!Array.isArray(data.analytics.events)) data.analytics.events = [];
    for (const u of data.users) {
      if (isStudioAdmin(u.email)) u.role = "admin";
    }
    return data;
  } catch {
    const initial = emptyStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

export function saveStore(store) {
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

export function isStudioAdmin(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  const admins = new Set([DEFAULT_EMAIL.toLowerCase()]);
  for (const part of (process.env.NEXO_ADMIN_EMAILS || "").split(",")) {
    const e = part.trim().toLowerCase();
    if (e) admins.add(e);
  }
  return admins.has(normalized);
}

export function canUserManageSettings(user) {
  if (!user || user.isGuest) return false;
  if (user.role === "admin") return true;
  return isStudioAdmin(user.email);
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
    canManageSettings: canUserManageSettings(user),
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

const ANALYTICS_MAX_EVENTS = 20000;
const ANALYTICS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ANALYTICS_TEXT_LIMIT = 500;

function sanitizeAnalyticsMetadata(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > ANALYTICS_TEXT_LIMIT ? value.slice(0, ANALYTICS_TEXT_LIMIT) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (depth > 2) return `[${value.length} items]`;
    return value.slice(0, 20).map((v) => sanitizeAnalyticsMetadata(v, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 2) return "[object]";
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) {
      out[String(k).slice(0, 80)] = sanitizeAnalyticsMetadata(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, ANALYTICS_TEXT_LIMIT);
}

export function recordAnalyticsEvent({ userId, userEmail, eventType, metadata } = {}) {
  const type = (eventType || "unknown").toString().slice(0, 80);
  if (!type) return null;
  const store = loadStore();
  if (!store.analytics) store.analytics = { events: [] };
  if (!Array.isArray(store.analytics.events)) store.analytics.events = [];
  const now = Date.now();
  const event = {
    id: `e-${now}-${Math.random().toString(36).slice(2, 10)}`,
    userId: (userId || "anonymous").toString(),
    userEmail: (userEmail || "").toString().slice(0, 200),
    eventType: type,
    metadata: sanitizeAnalyticsMetadata(metadata || {}),
    createdAt: now,
  };
  store.analytics.events.push(event);
  const cutoff = now - ANALYTICS_RETENTION_MS;
  store.analytics.events = store.analytics.events.filter((e) => e.createdAt >= cutoff);
  if (store.analytics.events.length > ANALYTICS_MAX_EVENTS) {
    store.analytics.events = store.analytics.events.slice(-ANALYTICS_MAX_EVENTS);
  }
  saveStore(store);
  return event;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hourKey(ts) {
  return new Date(ts).getHours();
}

export function getAnalyticsSummary() {
  const store = loadStore();
  const events = Array.isArray(store.analytics?.events) ? store.analytics.events : [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const activeSets = {
    day: new Set(),
    week: new Set(),
    month: new Set(),
  };
  for (const e of events) {
    if (now - e.createdAt <= oneDay) activeSets.day.add(e.userId);
    if (now - e.createdAt <= sevenDays) activeSets.week.add(e.userId);
    if (now - e.createdAt <= thirtyDays) activeSets.month.add(e.userId);
  }

  const chatEvents = events.filter((e) => e.eventType === "chat_query");
  const searchEvents = events.filter((e) => e.eventType === "chat_search");

  // Daily series (last 14 days)
  const dailyMap = new Map();
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(now - i * oneDay);
    dailyMap.set(key, { date: key, chats: 0, searches: 0, events: 0, activeUsers: new Set() });
  }
  for (const e of events) {
    const key = dayKey(e.createdAt);
    if (!dailyMap.has(key)) continue;
    const row = dailyMap.get(key);
    row.events += 1;
    if (e.eventType === "chat_query") row.chats += 1;
    if (e.eventType === "chat_search") row.searches += 1;
    row.activeUsers.add(e.userId);
  }
  const daily = Array.from(dailyMap.values()).map((r) => ({
    date: r.date,
    chats: r.chats,
    searches: r.searches,
    events: r.events,
    activeUsers: r.activeUsers.size,
  }));

  // Mode distribution
  const modeCounts = new Map();
  for (const e of chatEvents) {
    const mode = (e.metadata && e.metadata.mode) || "unknown";
    modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);
  }
  const modes = Array.from(modeCounts.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  // Event types
  const typeCounts = new Map();
  for (const e of events) {
    typeCounts.set(e.eventType, (typeCounts.get(e.eventType) || 0) + 1);
  }
  const eventTypes = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Top queries
  const queryMap = new Map();
  for (const e of chatEvents) {
    const raw = (e.metadata && (e.metadata.prompt || e.metadata.query)) || "";
    const key = String(raw).trim().toLowerCase();
    if (!key) continue;
    const cur = queryMap.get(key) || { query: String(raw).trim(), count: 0, lastAt: 0, users: new Set() };
    cur.count += 1;
    cur.lastAt = Math.max(cur.lastAt, e.createdAt);
    cur.users.add(e.userId);
    queryMap.set(key, cur);
  }
  // also search events
  for (const e of searchEvents) {
    const raw = (e.metadata && e.metadata.query) || "";
    const key = `search:${String(raw).trim().toLowerCase()}`;
    if (!String(raw).trim()) continue;
    const cur = queryMap.get(key) || { query: `[search] ${String(raw).trim()}`, count: 0, lastAt: 0, users: new Set() };
    cur.count += 1;
    cur.lastAt = Math.max(cur.lastAt, e.createdAt);
    cur.users.add(e.userId);
    queryMap.set(key, cur);
  }
  const topQueries = Array.from(queryMap.values())
    .map((q) => ({ query: q.query, count: q.count, lastAt: q.lastAt, users: q.users.size }))
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, 15);

  // Top users
  const userMap = new Map();
  for (const e of events) {
    const cur = userMap.get(e.userId) || {
      userId: e.userId,
      email: e.userEmail,
      events: 0,
      chats: 0,
      searches: 0,
      logins: 0,
      lastActive: 0,
    };
    cur.events += 1;
    if (e.eventType === "chat_query") cur.chats += 1;
    if (e.eventType === "chat_search") cur.searches += 1;
    if (e.eventType === "auth_login" || e.eventType === "auth_register" || e.eventType === "auth_guest") cur.logins += 1;
    cur.lastActive = Math.max(cur.lastActive, e.createdAt);
    if (!cur.email && e.userEmail) cur.email = e.userEmail;
    userMap.set(e.userId, cur);
  }
  const topUsers = Array.from(userMap.values())
    .sort((a, b) => b.events - a.events || b.lastActive - a.lastActive)
    .slice(0, 15);

  // Peak hour (chat volume)
  const hourCounts = new Array(24).fill(0);
  for (const e of chatEvents) {
    if (now - e.createdAt <= thirtyDays) hourCounts[hourKey(e.createdAt)] += 1;
  }
  let peakHourIndex = 0;
  for (let i = 1; i < 24; i++) if (hourCounts[i] > hourCounts[peakHourIndex]) peakHourIndex = i;
  const peakHour = hourCounts[peakHourIndex] > 0 ? `${String(peakHourIndex).padStart(2, "0")}:00` : null;

  // Registered users count
  const registeredUsers = store.users.filter((u) => !u.isGuest).length;

  const last7Chats = chatEvents.filter((e) => now - e.createdAt <= sevenDays).length;
  const activeWeekCount = activeSets.week.size || 1;
  const avgChatsPerActiveUser = Math.round((last7Chats / activeWeekCount) * 10) / 10;

  // Peak day
  let peakDay = null;
  let peakDayCount = 0;
  for (const d of daily) {
    if (d.chats > peakDayCount) {
      peakDayCount = d.chats;
      peakDay = d.date;
    }
  }
  if (peakDayCount === 0) peakDay = null;

  // Recent events (latest 50)
  const recentEvents = events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      userId: e.userId,
      userEmail: e.userEmail,
      eventType: e.eventType,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));

  return {
    generatedAt: now,
    totals: {
      registeredUsers,
      distinctUsersEver: new Set(events.map((e) => e.userId)).size,
      events: events.length,
      chats: chatEvents.length,
      searches: searchEvents.length,
      logins: events.filter((e) => e.eventType === "auth_login").length,
      registrations: events.filter((e) => e.eventType === "auth_register").length,
      guests: events.filter((e) => e.eventType === "auth_guest").length,
    },
    activeUsers: {
      last24h: activeSets.day.size,
      last7d: activeSets.week.size,
      last30d: activeSets.month.size,
    },
    daily,
    modes,
    eventTypes,
    topQueries,
    topUsers,
    recentEvents,
    insights: {
      avgChatsPerActiveUserLast7d: avgChatsPerActiveUser,
      peakDay,
      peakDayChats: peakDayCount,
      peakHour,
      last7dChats: last7Chats,
      topMode: modes.length ? modes[0].mode : null,
    },
    hourDistribution: hourCounts,
  };
}
