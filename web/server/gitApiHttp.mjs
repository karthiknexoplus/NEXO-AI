import { requireAuth } from "./authHttp.mjs";
import {
  gitCommit,
  gitInit,
  gitPush,
  gitSetRemote,
  gitStatus,
  githubCreateRepo,
} from "./gitHttp.mjs";
import { getGithubSettings } from "./dataStore.mjs";

function authRemoteUrl(cloneUrl, token) {
  if (!token || !cloneUrl?.startsWith("https://")) return cloneUrl;
  try {
    const u = new URL(cloneUrl);
    u.username = "x-access-token";
    u.password = token;
    return u.toString();
  } catch {
    return cloneUrl;
  }
}

export async function handleGitStatus(req, res, sendJson, workspaceRoot, projectId) {
  if (!requireAuth(req, res, sendJson)) return;
  if (!projectId) return sendJson(res, 400, { error: "Missing projectId" });
  const status = await gitStatus(workspaceRoot, projectId);
  return sendJson(res, 200, status);
}

export async function handleGitInit(req, res, sendJson, workspaceRoot, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const result = await gitInit(workspaceRoot, body.projectId);
  if (!result.ok) return sendJson(res, 500, { error: result.error });
  return sendJson(res, 200, { ok: true });
}

export async function handleGitCommit(req, res, sendJson, workspaceRoot, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const result = await gitCommit(workspaceRoot, body.projectId, body.message);
  if (!result.ok) return sendJson(res, 500, { error: result.error });
  return sendJson(res, 200, result);
}

export async function handleGitPush(req, res, sendJson, workspaceRoot, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const result = await gitPush(workspaceRoot, body.projectId);
  if (!result.ok) return sendJson(res, 500, { error: result.error });
  return sendJson(res, 200, result);
}

export async function handleGithubCreateRepo(req, res, sendJson, workspaceRoot, readBody) {
  if (!requireAuth(req, res, sendJson)) return;
  const raw = await readBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  const projectId = body.projectId;
  const name = (body.name || "nexoplus-project").replace(/[^\w.-]/g, "-");
  if (!projectId) return sendJson(res, 400, { error: "Missing projectId" });

  await gitInit(workspaceRoot, projectId);
  const created = await githubCreateRepo(name, !!body.private);
  if (!created.ok) return sendJson(res, 502, { error: created.error });

  const gh = getGithubSettings();
  const remote = authRemoteUrl(created.cloneUrl, gh.token);
  const remoteResult = await gitSetRemote(workspaceRoot, projectId, remote);
  if (!remoteResult.ok) return sendJson(res, 500, { error: remoteResult.error });

  const commit = await gitCommit(workspaceRoot, projectId, body.message || "Initial commit from NEXOPLUS");
  if (!commit.ok && !commit.nothing) {
    return sendJson(res, 500, { error: commit.error || "Commit failed" });
  }

  let pushed = false;
  let pushError = null;
  const push = await gitPush(workspaceRoot, projectId);
  if (push.ok) pushed = true;
  else pushError = push.error;

  return sendJson(res, 200, {
    ok: true,
    htmlUrl: created.htmlUrl,
    fullName: created.fullName,
    committed: !commit.nothing,
    pushed,
    pushError,
  });
}
