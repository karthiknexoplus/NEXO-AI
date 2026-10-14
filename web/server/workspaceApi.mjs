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
