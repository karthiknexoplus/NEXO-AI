import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

export function projectDir(root, projectId) {
  const id = projectId || "default";
  return path.join(root, id === "default" ? "project-default" : `project-${id}`);
}

function walkFiles(dir, base = "") {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(abs, rel));
    } else {
      files.push(rel);
    }
  }
  return files.sort();
}

export function handleClearProject(res, root, projectId) {
  const dir = projectDir(root, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  return sendJson(res, 200, { ok: true, cleared: true });
}

export function handleListFiles(res, root, projectId) {
  const dir = projectDir(root, projectId);
  const files = walkFiles(dir);
  return sendJson(res, 200, { files, projectId: projectId || "default" });
}

export function handleReadFile(res, root, projectId, relativePath, safeJoin) {
  const dir = projectDir(root, projectId);
  const abs = safeJoin(dir, relativePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return sendJson(res, 404, { error: "File not found" });
  }
  const content = fs.readFileSync(abs, "utf8");
  return sendJson(res, 200, { path: relativePath, content });
}

export function handleWriteFile(res, root, projectId, relativePath, content, safeJoin) {
  const dir = projectDir(root, projectId);
  const abs = safeJoin(dir, relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return sendJson(res, 200, { ok: true, path: relativePath });
}

const SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
]);

function shouldSkipImportPath(relativePath) {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  return parts.some((p) => SKIP_SEGMENTS.has(p) || p === ".DS_Store");
}

export function handleImportFiles(res, root, projectId, fileEntries, safeJoin) {
  const dir = projectDir(root, projectId);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  let totalBytes = 0;
  const maxBytes = Number(process.env.NEXO_IMPORT_MAX_BYTES || 20 * 1024 * 1024);
  const maxFiles = Number(process.env.NEXO_IMPORT_MAX_FILES || 400);

  for (const entry of fileEntries.slice(0, maxFiles)) {
    const rel = (entry?.path || "").replace(/\\/g, "/").replace(/^\.\//, "");
    if (!rel || shouldSkipImportPath(rel)) continue;
    const content = entry?.content != null ? String(entry.content) : "";
    const size = Buffer.byteLength(content, "utf8");
    if (totalBytes + size > maxBytes) break;
    try {
      const abs = safeJoin(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
      written.push(rel);
      totalBytes += size;
    } catch {
      /* skip bad paths */
    }
  }

  return sendJson(res, 200, { written, count: written.length });
}

export function handleDownloadZip(req, res, root, projectId) {
  const dir = projectDir(root, projectId);
  if (!fs.existsSync(dir)) {
    return sendJson(res, 404, { error: "No project files yet" });
  }

  const name = `nexoplus-project-${projectId || "default"}.zip`;
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${name}"`,
  });

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
  });
  archive.pipe(res);
  archive.directory(dir, false);
  void archive.finalize();
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function handleDeleteFile(res, root, projectId, filePath, safeJoin) {
  try {
    const dir = projectDir(root, projectId || "default");
    const abs = safeJoin(dir, filePath);
    if (fs.existsSync(abs)) {
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        fs.rmSync(abs, { recursive: true, force: true });
      } else {
        fs.unlinkSync(abs);
      }
    }
    sendJson(res, 200, { ok: true });
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Delete failed" }));
  }
}

export function handleRenameFile(res, root, projectId, fromPath, toPath, safeJoin) {
  try {
    const dir = projectDir(root, projectId || "default");
    const absFrom = safeJoin(dir, fromPath);
    const absTo = safeJoin(dir, toPath);
    if (!fs.existsSync(absFrom)) throw new Error("Source path does not exist");
    if (fs.existsSync(absTo)) throw new Error("Target path already exists");
    fs.mkdirSync(path.dirname(absTo), { recursive: true });
    fs.renameSync(absFrom, absTo);
    sendJson(res, 200, { ok: true });
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Rename failed" }));
  }
}
