import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { projectDir } from "./workspaceApi.mjs";
import { getGithubSettings } from "./dataStore.mjs";

const execFileAsync = promisify(execFile);

function workspaceRoot(root, projectId) {
  const dir = projectDir(root, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function runGit(cwd, args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, stdout: (stdout || stderr || "").trim() };
  } catch (e) {
    const err = e && typeof e === "object" ? e : {};
    return {
      ok: false,
      error: String(err.stderr || err.message || "git failed").trim(),
      code: err.code,
    };
  }
}

export async function gitStatus(workspaceRootDir, projectId) {
  const cwd = workspaceRoot(workspaceRootDir, projectId);
  const inside = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok) {
    return {
      initialized: false,
      branch: null,
      clean: true,
      changed: [],
      untracked: [],
      remote: null,
    };
  }
  const branch = await runGit(cwd, ["branch", "--show-current"]);
  const status = await runGit(cwd, ["status", "--porcelain"]);
  const remote = await runGit(cwd, ["remote", "get-url", "origin"]);
  const lines = (status.stdout || "").split("\n").filter(Boolean);
  const changed = [];
  const untracked = [];
  for (const line of lines) {
    const code = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (code === "??" || code.includes("?")) untracked.push(file);
    else changed.push(file);
  }
  return {
    initialized: true,
    branch: branch.stdout || "main",
    clean: lines.length === 0,
    changed,
    untracked,
    remote: remote.ok ? remote.stdout : null,
  };
}

export async function gitInit(workspaceRootDir, projectId) {
  const cwd = workspaceRoot(workspaceRootDir, projectId);
  const init = await runGit(cwd, ["init", "-b", "main"]);
  if (!init.ok) return { ok: false, error: init.error };
  return { ok: true };
}

export async function gitCommit(workspaceRootDir, projectId, message) {
  const cwd = workspaceRoot(workspaceRootDir, projectId);
  await runGit(cwd, ["add", "-A"]);
  const commit = await runGit(cwd, ["commit", "-m", message || "Update from NEXOPLUS"]);
  if (!commit.ok) {
    if (commit.error?.includes("nothing to commit")) {
      return { ok: true, nothing: true };
    }
    return { ok: false, error: commit.error };
  }
  return { ok: true, output: commit.stdout };
}

export async function gitPush(workspaceRootDir, projectId) {
  const cwd = workspaceRoot(workspaceRootDir, projectId);
  const gh = getGithubSettings();
  const env = gh.token ? { GIT_TERMINAL_PROMPT: "0" } : {};
  const push = await runGit(cwd, ["push", "-u", "origin", "HEAD"], env);
  if (!push.ok) return { ok: false, error: push.error };
  return { ok: true, output: push.stdout };
}

export async function gitSetRemote(workspaceRootDir, projectId, url) {
  const cwd = workspaceRoot(workspaceRootDir, projectId);
  const existing = await runGit(cwd, ["remote", "get-url", "origin"]);
  if (existing.ok) {
    const set = await runGit(cwd, ["remote", "set-url", "origin", url]);
    if (!set.ok) return { ok: false, error: set.error };
  } else {
    const add = await runGit(cwd, ["remote", "add", "origin", url]);
    if (!add.ok) return { ok: false, error: add.error };
  }
  return { ok: true };
}

export async function githubCreateRepo(name, privateRepo = false) {
  const gh = getGithubSettings();
  if (!gh.token) return { ok: false, error: "Add a GitHub token in settings first" };
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gh.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "NEXOPLUS-Web",
    },
    body: JSON.stringify({
      name,
      private: !!privateRepo,
      auto_init: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || `GitHub ${res.status}`;
    return { ok: false, error: msg };
  }
  const cloneUrl = data.clone_url;
  const sshUrl = data.ssh_url;
  return {
    ok: true,
    htmlUrl: data.html_url,
    cloneUrl,
    sshUrl,
    fullName: data.full_name,
  };
}
