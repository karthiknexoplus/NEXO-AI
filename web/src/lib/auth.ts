const jsonOpts: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export interface AuthSession {
  authenticated: boolean;
  email?: string;
  isGuest?: boolean;
  canManageSettings?: boolean;
}

export interface AuthConfig {
  googleEnabled: boolean;
  googleClientId: string;
}

export async function fetchAuthMe(): Promise<AuthSession> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return { authenticated: false };
  return (await res.json()) as AuthSession;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch("/api/auth/config", { credentials: "include" });
  if (!res.ok) return { googleEnabled: false, googleClientId: "" };
  return (await res.json()) as AuthConfig;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const res = await fetch("/api/auth/login", {
    ...jsonOpts,
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Sign in failed");
  }
  return (await res.json()) as AuthSession;
}

export async function register(email: string, password: string): Promise<AuthSession> {
  const res = await fetch("/api/auth/register", {
    ...jsonOpts,
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Sign up failed");
  }
  return (await res.json()) as AuthSession;
}

export async function loginAsGuest(): Promise<AuthSession> {
  const res = await fetch("/api/auth/guest", { ...jsonOpts, method: "POST" });
  if (!res.ok) throw new Error("Could not start guest session");
  return (await res.json()) as AuthSession;
}

export function startGoogleSignIn(): void {
  window.location.href = "/api/auth/google";
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
