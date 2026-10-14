import { useCallback, useEffect, useState } from "react";
import { Github, Loader2, Upload } from "lucide-react";
import { fetchAuthMe } from "../lib/auth";
import {
  fetchGitStatus,
  fetchGithubSettings,
  gitCommit,
  gitInit,
  gitPush,
  githubCreateAndPush,
  saveGithubSettings,
  type GitStatus,
} from "../lib/git";

interface GitHubPanelProps {
  workspaceId: string | null;
}

export function GitHubPanel({ workspaceId }: GitHubPanelProps) {
  const [canManageSettings, setCanManageSettings] = useState<boolean | null>(null);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState("Update from NEXOPLUS");
  const [repoName, setRepoName] = useState("nexoplus-project");
  const [ghToken, setGhToken] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    void fetchAuthMe().then((s) => setCanManageSettings(!!s.canManageSettings));
  }, []);

  const refresh = useCallback(async () => {
    if (!workspaceId || !canManageSettings) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const s = await fetchGitStatus(workspaceId);
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, canManageSettings]);

  useEffect(() => {
    if (canManageSettings) void refresh();
  }, [refresh, canManageSettings]);

  useEffect(() => {
    if (!canManageSettings) return;
    void fetchGithubSettings()
      .then((g) => {
        setGhUser(g.username);
        setHasToken(!!g.hasToken);
      })
      .catch(() => {});
  }, [canManageSettings]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (canManageSettings === false || canManageSettings === null) {
    return null;
  }

  if (!workspaceId) {
    return (
      <p className="text-[11px] text-nexo-muted px-3 py-2 border-t border-nexo-border">
        Select a chat or imported folder to use Git.
      </p>
    );
  }

  return (
    <div className="border-t border-nexo-border px-3 py-3 space-y-2 bg-nexo-composer/30">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-nexo-fg">
        <Github className="w-3.5 h-3.5" />
        GitHub (admin)
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <input
          value={ghUser}
          onChange={(e) => setGhUser(e.target.value)}
          placeholder="GitHub username"
          className="col-span-1 rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1 text-[10px]"
        />
        <input
          type="password"
          value={ghToken}
          onChange={(e) => setGhToken(e.target.value)}
          placeholder={hasToken ? "Token saved" : "Personal access token"}
          className="col-span-1 rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1 text-[10px] font-mono"
        />
        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            void run("save", async () => {
              const patch: { username?: string; token?: string } = { username: ghUser };
              if (ghToken && !ghToken.includes("••••")) patch.token = ghToken;
              const g = await saveGithubSettings(patch);
              setHasToken(!!g.hasToken);
              setGhToken("");
            })
          }
          className="col-span-2 text-[10px] py-1 rounded-lg border border-nexo-border hover:bg-nexo-hover"
        >
          Save GitHub connection
        </button>
      </div>

      {loading ? (
        <p className="text-[10px] text-nexo-muted flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking repo…
        </p>
      ) : status ? (
        <p className="text-[10px] text-nexo-muted leading-snug">
          {status.initialized ? (
            <>
              Branch <span className="font-mono text-nexo-fg">{status.branch}</span>
              {status.clean ? " · clean" : ` · ${status.changed.length + status.untracked.length} change(s)`}
              {status.remote ? (
                <>
                  <br />
                  <span className="font-mono truncate block">
                    {status.remote.replace(/x-access-token:[^@]+@/, "")}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            "Not a git repo yet — init or create on GitHub."
          )}
        </p>
      ) : null}

      <input
        value={commitMsg}
        onChange={(e) => setCommitMsg(e.target.value)}
        className="w-full rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1 text-[10px]"
        placeholder="Commit message"
      />

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run("init", () => gitInit(workspaceId))}
          className="text-[10px] px-2 py-1 rounded-lg border border-nexo-border hover:bg-nexo-hover"
        >
          Init git
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run("commit", () => gitCommit(workspaceId, commitMsg))}
          className="text-[10px] px-2 py-1 rounded-lg border border-nexo-border hover:bg-nexo-hover"
        >
          Commit
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run("push", () => gitPush(workspaceId))}
          className="text-[10px] px-2 py-1 rounded-lg nexo-btn-primary"
        >
          Push
        </button>
      </div>

      <div className="flex gap-1">
        <input
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          className="flex-1 rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1 text-[10px] font-mono"
          placeholder="new-repo-name"
        />
        <button
          type="button"
          disabled={!!busy}
          title="Create GitHub repo, commit, and push"
          onClick={() =>
            void run("create", async () => {
              const r = await githubCreateAndPush(workspaceId, repoName, {
                message: commitMsg,
              });
              if (r.htmlUrl) window.open(r.htmlUrl, "_blank", "noopener");
              if (r.pushError) setError(`Repo created but push: ${r.pushError}`);
            })
          }
          className="text-[10px] px-2 py-1 rounded-lg border border-nexo-brand/40 text-nexo-brand flex items-center gap-1"
        >
          <Upload className="w-3 h-3" />
          Create repo
        </button>
      </div>

      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {busy && (
        <p className="text-[10px] text-nexo-muted flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> {busy}…
        </p>
      )}
    </div>
  );
}
