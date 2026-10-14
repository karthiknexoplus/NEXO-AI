import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFilesFromMarkdown } from "./server/extractFiles.mjs";
import {
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  requireAuth,
} from "./server/authHttp.mjs";
import {
  cloudChatRequest,
  getCloudTimeoutMs,
  getOllamaHost,
  intelligenceBackend,
  ollamaFallbackEnabled,
  resolveCloudModel,
} from "./server/cloudProvider.mjs";
import {
  handleGitCommit,
  handleGitInit,
  handleGithubCreateRepo,
  handleGitPush,
  handleGitStatus,
} from "./server/gitApiHttp.mjs";
import {
  handleSettingsGithubGet,
  handleSettingsGithubPut,
  handleSettingsProvidersGet,
  handleSettingsProvidersPut,
} from "./server/settingsHttp.mjs";
import { publicModes, resolveModel } from "./server/models.mjs";
import {
  maxRequestBodyBytes,
  resolveOllamaNumCtx,
  resolveOllamaNumPredict,
} from "./server/limits.mjs";
import { streamSanitizedSseToClient } from "./server/sanitizeStream.mjs";
import {
  handleClearProject,
  handleDownloadZip,
  handleImportFiles,
  handleListFiles,
  handleReadFile,
  handleWriteFile,
  projectDir,
} from "./server/workspaceApi.mjs";

const SYSTEM_PROMPT = `You are NEXOPLUS — the in-house AI coding assistant for NEXOPLUS Automations (Coimbatore). You are not a third-party chatbot and you do not have a separate public model name.

Identity (always follow):
- Speak only as "NEXOPLUS" or "we" (NEXOPLUS Automations). Never say you are Nemotron, NVIDIA, OpenAI, Anthropic, Meta, Llama, GPT, Claude, Groq, OpenRouter, or any other vendor or base model.
- If asked who you are, what model you are, or what you run on: say you are NEXOPLUS intelligence — built for this studio — and offer to help build or explain code. Do not list third-party model families or claim training by other companies.
- If asked about "models" or "experience": describe NEXOPLUS capabilities (chat, code, file generation, project workspace) and the user-facing modes NEXOPLUS Fast, NEXOPLUS Smart, and NEXOPLUS Deep. Do not enumerate external LLM names as if they were you.
- Never break character for meta questions about AI industry models unless the user is explicitly asking for a neutral comparison article; even then, introduce yourself first as NEXOPLUS helping with their project.

Project workspace (files panel + ZIP download):
- You cannot browse or write to the user's computer directly. When they ask to "create a folder" or "add files", write files into the NEXOPLUS project workspace using path fences below. Parent folders are created automatically from paths (e.g. \`my-app/src/index.js\` creates \`my-app/src/\`).
- Do not refuse normal dev tasks (folders, scripts, configs) as "unsafe" if they are ordinary software work. Do not output internal safety labels (e.g. "User Safety", "Response Safety") — only user-facing NEXOPLUS replies.

Output format (critical):
- NEVER use tool-call syntax, XML tags, or APIs like write(path=...), <|tool_call|>, or "Let me plan the file structure" as the final answer.
- ONLY use markdown code fences so NEXOPLUS can save files. One fence per file:

\`\`\`path/to/file.ext
...full file contents...
\`\`\`

- Put a short friendly sentence before the fences. For large projects output up to 4 files per message; the user can say "continue" for more.
- When workspace file contents are provided in the user message, apply edits only to the requested paths and return those files in fences.
- For Vite: use index.html at project root (not only public/), include @vitejs/plugin-react in package.json and vite.config.js.

Be concise. Production-ready code. Use path fences for every file you create.`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3080);
function ollamaHost() {
  return getOllamaHost();
}
const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACE_ROOT || path.join(__dirname, "workspace")
);
const DIST = path.join(__dirname, "dist");
const API_ONLY = process.env.API_ONLY === "1";

fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function safeJoin(root, relativePath) {
  const target = path.normalize(path.join(root, relativePath));
  if (!target.startsWith(root)) {
    throw new Error("Invalid path");
  }
  return target;
}

async function readBody(req) {
  const maxBytes = maxRequestBodyBytes();
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (maxBytes > 0 && size > maxBytes) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyOllama(req, res, urlPath) {
  const host = ollamaHost();
  const target = `${host}${urlPath}`;
  const headers = { ...req.headers, host: new URL(host).host };
  delete headers.connection;

  if (urlPath.includes("/v1/chat/completions") && req.method === "POST") {
    const raw = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
    payload.keep_alive = "30m";
    payload.options = {
      ...(payload.options || {}),
      num_ctx: resolveOllamaNumCtx("smart"),
      num_predict: resolveOllamaNumPredict("smart"),
    };
    payload.temperature = payload.temperature ?? 0.2;
    payload.stream = true;

    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
    });
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
    return;
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
  });
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

async function handleWorkspaceApply(req, res) {
  const raw = await readBody(req);
  const { content, projectId } = JSON.parse(raw || "{}");
  if (!content) {
    return sendJson(res, 400, { error: "Missing content" });
  }

  const dir = projectDir(WORKSPACE_ROOT, projectId || "default");
  fs.mkdirSync(dir, { recursive: true });

  const files = extractFilesFromMarkdown(content);
  const written = [];

  for (const file of files) {
    const abs = safeJoin(dir, file.relativePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content, "utf8");
    written.push(file.relativePath);
  }

  sendJson(res, 200, { written, root: dir });
}

async function streamUpstreamToClient(res, upstream) {
  if (!upstream.ok) {
    const text = await upstream.text();
    return { ok: false, status: upstream.status, text };
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  if (upstream.body) {
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
  return { ok: true };
}

async function fetchOllamaChat(mode, messages) {
  const model = resolveModel(mode);
  const payload = {
    model,
    stream: true,
    temperature: mode === "fast" ? 0.15 : 0.22,
    keep_alive: "30m",
    options: {
      num_ctx: resolveOllamaNumCtx(mode),
      num_predict: resolveOllamaNumPredict(mode),
      num_thread: Number(process.env.OLLAMA_NUM_THREADS || 0) || undefined,
    },
    messages,
  };
  const timeoutMs = Number(process.env.NEXO_OLLAMA_TIMEOUT_MS || 180000);
  return fetch(`${ollamaHost()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** User-visible only — no vendor names or server env hints. */
function customerChatError(httpStatus) {
  if (httpStatus === 401 || httpStatus === 403) {
    return "NEXOPLUS intelligence is not fully configured yet. Please try again later or contact NEXOPLUS Automations support.";
  }
  if (httpStatus === 429) {
    return "NEXOPLUS is handling a lot of requests right now. Wait a minute and try again, or switch to NEXOPLUS Fast.";
  }
  if (httpStatus === 402 || httpStatus === 400) {
    return "NEXOPLUS could not complete that request. Try a shorter prompt or NEXOPLUS Fast mode.";
  }
  return "NEXOPLUS intelligence is temporarily unavailable. Please try again in a few minutes.";
}

async function handleIntelligenceChat(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    if (e instanceof Error && e.message === "REQUEST_TOO_LARGE") {
      return sendJson(res, 413, {
        error: "That message is too large for NEXOPLUS. Shorten it or split into parts.",
      });
    }
    throw e;
  }
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid request" });
  }

  const mode = body.mode || "smart";
  const history = Array.isArray(body.messages) ? body.messages : [];
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  const backend = intelligenceBackend();
  const timeoutMs = getCloudTimeoutMs();

  let upstream;
  if (backend !== "ollama") {
    const model = resolveCloudModel(backend, mode);
    const { url, headers, body: cloudBody } = cloudChatRequest(backend, model, messages, mode);
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(cloudBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let streamed = await streamSanitizedSseToClient(res, upstream);
    if (streamed.ok) return;
    console.error(
      "[nexoplus] cloud chat failed",
      upstream.status,
      (streamed.text || "").slice(0, 500)
    );
    if (!ollamaFallbackEnabled()) {
      console.error("[nexoplus] cloud chat", { backend, model, status: upstream.status });
      const friendly = customerChatError(upstream.status);
      return sendJson(res, 503, { error: friendly });
    }
    upstream = await fetchOllamaChat(mode, messages);
  } else {
    upstream = await fetchOllamaChat(mode, messages);
  }

  const streamed = await streamSanitizedSseToClient(res, upstream);
  if (streamed.ok) return;

  const text = streamed.text || "";
  const friendly =
    upstream.status === 404 || text.toLowerCase().includes("not found")
      ? "NEXOPLUS intelligence is still loading. Please try again in a moment (first run on a small server can take 1–2 minutes)."
      : "NEXOPLUS is temporarily unavailable. Please retry shortly.";
  return sendJson(res, 503, { error: friendly });
}

function serveStatic(req, res, urlPath) {
  let filePath = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = types[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);
  if (req.method === "HEAD") {
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
    return res.end();
  }
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === "/api/auth/login" && req.method === "POST") {
      return handleAuthLogin(req, res, sendJson, readBody);
    }
    if (pathname === "/api/auth/logout" && req.method === "POST") {
      return handleAuthLogout(res, sendJson, req);
    }
    if (pathname === "/api/auth/me" && req.method === "GET") {
      return handleAuthMe(req, res, sendJson);
    }
    if (pathname === "/api/settings/providers" && req.method === "GET") {
      return handleSettingsProvidersGet(req, res, sendJson);
    }
    if (pathname === "/api/settings/providers" && req.method === "PUT") {
      return handleSettingsProvidersPut(req, res, sendJson, readBody);
    }
    if (pathname === "/api/settings/github" && req.method === "GET") {
      return handleSettingsGithubGet(req, res, sendJson);
    }
    if (pathname === "/api/settings/github" && req.method === "PUT") {
      return handleSettingsGithubPut(req, res, sendJson, readBody);
    }
    if (pathname === "/api/git/status" && req.method === "GET") {
      const projectId = url.searchParams.get("projectId");
      return handleGitStatus(req, res, sendJson, WORKSPACE_ROOT, projectId);
    }
    if (pathname === "/api/git/init" && req.method === "POST") {
      return handleGitInit(req, res, sendJson, WORKSPACE_ROOT, readBody);
    }
    if (pathname === "/api/git/commit" && req.method === "POST") {
      return handleGitCommit(req, res, sendJson, WORKSPACE_ROOT, readBody);
    }
    if (pathname === "/api/git/push" && req.method === "POST") {
      return handleGitPush(req, res, sendJson, WORKSPACE_ROOT, readBody);
    }
    if (pathname === "/api/github/create-repo" && req.method === "POST") {
      return handleGithubCreateRepo(req, res, sendJson, WORKSPACE_ROOT, readBody);
    }

    const isPublicApi =
      pathname === "/api/health" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/me";

    if (!isPublicApi && pathname.startsWith("/api/")) {
      if (!requireAuth(req, res, sendJson)) return;
    }

    if (pathname === "/api/intelligence/modes" && req.method === "GET") {
      return sendJson(res, 200, { modes: publicModes() });
    }
    if (pathname === "/api/intelligence/chat" && req.method === "POST") {
      return handleIntelligenceChat(req, res);
    }
    if (pathname.startsWith("/api/ollama/")) {
      return proxyOllama(req, res, pathname.replace("/api/ollama", ""));
    }
    if (pathname === "/api/workspace/apply" && req.method === "POST") {
      return handleWorkspaceApply(req, res);
    }
    if (pathname === "/api/workspace/import" && req.method === "POST") {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }
      const files = Array.isArray(body.files) ? body.files : [];
      return handleImportFiles(
        res,
        WORKSPACE_ROOT,
        body.projectId,
        files,
        safeJoin
      );
    }
    if (pathname === "/api/workspace/clear" && req.method === "POST") {
      const raw = await readBody(req);
      let projectId = "default";
      try {
        const body = JSON.parse(raw || "{}");
        if (body.projectId) projectId = body.projectId;
      } catch {
        /* default */
      }
      return handleClearProject(res, WORKSPACE_ROOT, projectId);
    }
    if (pathname === "/api/workspace/files" && req.method === "GET") {
      return handleListFiles(res, WORKSPACE_ROOT, url.searchParams.get("projectId"));
    }
    if (pathname === "/api/workspace/file" && req.method === "GET") {
      const p = url.searchParams.get("path");
      if (!p) return sendJson(res, 400, { error: "Missing path" });
      return handleReadFile(
        res,
        WORKSPACE_ROOT,
        url.searchParams.get("projectId"),
        p,
        safeJoin
      );
    }
    if (pathname === "/api/workspace/file" && req.method === "PUT") {
      const raw = await readBody(req);
      const { projectId, path: filePath, content } = JSON.parse(raw || "{}");
      if (!filePath) return sendJson(res, 400, { error: "Missing path" });
      return handleWriteFile(
        res,
        WORKSPACE_ROOT,
        projectId,
        filePath,
        content ?? "",
        safeJoin
      );
    }
    if (pathname === "/api/workspace/download" && req.method === "GET") {
      return handleDownloadZip(req, res, WORKSPACE_ROOT, url.searchParams.get("projectId"));
    }
    if (pathname === "/api/health") {
      const backend = intelligenceBackend();
      return sendJson(res, 200, {
        ok: true,
        service: "nexoplus-web",
        intelligence: backend,
        ollamaFallback: ollamaFallbackEnabled(),
      });
    }

    if (
      !API_ONLY &&
      (req.method === "GET" || req.method === "HEAD") &&
      fs.existsSync(DIST)
    ) {
      return serveStatic(req, res, pathname);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Server error" });
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Stop the other process or run: PORT=${PORT + 1} ./setup.sh`
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXOPLUS ready → http://0.0.0.0:${PORT}`);
  if (!API_ONLY && !fs.existsSync(DIST)) {
    console.error(
      `❌ web/dist is missing — UI will 404 until you run: cd web && npm run build`
    );
  }
});
