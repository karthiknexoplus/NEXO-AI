import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFilesFromMarkdown } from "./server/extractFiles.mjs";
import {
  cloudChatRequest,
  intelligenceBackend,
  ollamaFallbackEnabled,
  resolveCloudModel,
} from "./server/cloudProvider.mjs";
import { publicModes, resolveModel } from "./server/models.mjs";
import {
  handleClearProject,
  handleDownloadZip,
  handleListFiles,
  handleReadFile,
  handleWriteFile,
  projectDir,
} from "./server/workspaceApi.mjs";

const SYSTEM_PROMPT = `You are NEXOPLUS, an expert AI software developer (NEXOPLUS Automations, Coimbatore).

When generating files, ALWAYS use fences with the file path on the first line:
\`\`\`path/to/file.ext
...full file contents...
\`\`\`

Be concise. Production-ready code. Use path fences for every file you create.`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3080);
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
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
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyOllama(req, res, urlPath) {
  const target = `${OLLAMA_HOST}${urlPath}`;
  const headers = { ...req.headers, host: new URL(OLLAMA_HOST).host };
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
      num_ctx: 8192,
      num_predict: 2048,
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
  const light = process.env.NEXO_LIGHT === "1" || process.env.NEXO_LIGHT === "true";
  const payload = {
    model,
    stream: true,
    temperature: mode === "fast" ? 0.15 : 0.22,
    keep_alive: "30m",
    options: {
      num_ctx: light
        ? mode === "deep"
          ? 4096
          : 3072
        : mode === "deep"
          ? 8192
          : mode === "fast"
            ? 4096
            : 6144,
      num_predict: mode === "fast" ? 1024 : 1536,
      num_thread: Number(process.env.OLLAMA_NUM_THREADS || 0) || undefined,
    },
    messages,
  };
  const timeoutMs = Number(process.env.NEXO_OLLAMA_TIMEOUT_MS || 180000);
  return fetch(`${OLLAMA_HOST}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function handleIntelligenceChat(req, res) {
  const raw = await readBody(req);
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
  const timeoutMs = Number(process.env.NEXO_CLOUD_TIMEOUT_MS || 120000);

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
    const streamed = await streamUpstreamToClient(res, upstream);
    if (streamed.ok) return;
    console.error(
      "[nexoplus] cloud chat failed",
      upstream.status,
      (streamed.text || "").slice(0, 500)
    );
    if (!ollamaFallbackEnabled()) {
      let hint = "Check OPENROUTER_API_KEY on the server and OpenRouter credits/limits.";
      if (upstream.status === 401) hint = "Invalid OpenRouter API key — create a new key and update cloud.conf.";
      if (upstream.status === 429) hint = "OpenRouter rate limit — wait a minute or switch to Fast mode.";
      return sendJson(res, 503, { error: `NEXOPLUS cloud unavailable. ${hint}` });
    }
    upstream = await fetchOllamaChat(mode, messages);
  } else {
    upstream = await fetchOllamaChat(mode, messages);
  }

  const streamed = await streamUpstreamToClient(res, upstream);
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
