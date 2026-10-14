const jsonOpts: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export async function fetchAuthMe(): Promise<{ authenticated: boolean; email?: string }> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return { authenticated: false };
  return (await res.json()) as { authenticated: boolean; email?: string };
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    ...jsonOpts,
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Sign in failed");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
