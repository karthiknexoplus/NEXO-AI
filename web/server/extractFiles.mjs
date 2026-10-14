/**
 * Extract file paths + contents from assistant markdown.
 * Supported fences:
 *   ```path/to/file.ts
 *   ```ts file: src/foo.ts
 *   ### `package.json` followed by ``` block
 */

const FENCE =
  /```([^\n`]*)\n([\s\S]*?)```/g;

export function extractFilesFromMarkdown(text) {
  const files = new Map();

  let match;
  while ((match = FENCE.exec(text)) !== null) {
    const header = (match[1] || "").trim();
    const body = match[2].replace(/\n$/, "");
    if (!body.trim()) continue;

    const path = parsePathHeader(header);
    if (path) {
      files.set(normalizeRel(path), body);
    }
  }

  // `path` on its own line before fence (already in header usually)
  return [...files.entries()].map(([relativePath, content]) => ({
    relativePath,
    content,
  }));
}

function parsePathHeader(header) {
  if (!header) return null;

  const fileColon = header.match(/(?:file:\s*)?([^\s]+\.[a-zA-Z0-9]+)/i);
  if (fileColon) return fileColon[1];

  const looksLikePath =
    /^(?:\.{0,2}\/)?[\w@./-]+\.[a-z0-9]+$/i.test(header) ||
    /^[\w-]+\/[\w@./-]+\.[a-z0-9]+$/i.test(header);
  if (looksLikePath) return header.split(/\s+/)[0];

  const langOnly = /^(javascript|typescript|tsx|jsx|json|html|css|python|bash|sh|md|yaml|yml)$/i;
  if (langOnly.test(header)) return null;

  if (header.includes("/") || header.includes(".")) {
    return header.split(/\s+/)[0];
  }

  return null;
}

function normalizeRel(p) {
  return p.replace(/^\.?\//, "").replace(/\\/g, "/");
}
