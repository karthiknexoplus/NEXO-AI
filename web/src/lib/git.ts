const fetchOpts: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export interface GitStatus {
  initialized: boolean;
  branch: string | null;
  clean: boolean;
  changed: string[];
  untracked: string[];
  remote: string | null;
}

export interface GithubSettingsPublic {
  username: string;
  token: string;
  hasToken?: boolean;
}

export async function fetchGitStatus(projectId: string): Promise<GitStatus> {
  const res = await fetch(
    `/api/git/status?projectId=${encodeURIComponent(projectId)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Could not read git status");
  return (await res.json()) as GitStatus;
}

export async function gitInit(projectId: string): Promise<void> {
  const res = await fetch("/api/git/init", {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error("Git init failed");
}

export async function gitCommit(projectId: string, message: string): Promise<void> {
  const res = await fetch("/api/git/commit", {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({ projectId, message }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Commit failed");
  }
}

export async function gitPush(projectId: string): Promise<void> {
  const res = await fetch("/api/git/push", {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Push failed");
  }
}

export async function githubCreateAndPush(
  projectId: string,
  name: string,
  options?: { private?: boolean; message?: string }
): Promise<{ htmlUrl?: string; pushed?: boolean; pushError?: string | null }> {
  const res = await fetch("/api/github/create-repo", {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({
      projectId,
      name,
      private: options?.private,
      message: options?.message,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    htmlUrl?: string;
    pushed?: boolean;
    pushError?: string | null;
  };
  if (!res.ok) throw new Error(data.error || "Could not create repository");
  return data;
}

export async function fetchGithubSettings(): Promise<GithubSettingsPublic> {
  const res = await fetch("/api/settings/github", { credentials: "include" });
  if (!res.ok) throw new Error("Could not load GitHub settings");
  return (await res.json()) as GithubSettingsPublic;
}

export async function saveGithubSettings(patch: {
  username?: string;
  token?: string;
}): Promise<GithubSettingsPublic> {
  const res = await fetch("/api/settings/github", {
    ...fetchOpts,
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Could not save GitHub settings");
  return (await res.json()) as GithubSettingsPublic;
}
