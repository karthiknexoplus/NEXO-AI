import * as fs from "fs";
import * as path from "path";
import type { Ignore } from "ignore";
import { isIgnoredPath } from "./ignoreFilter";

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".rb",
  ".php",
  ".swift",
  ".vue",
  ".svelte",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".md",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".css",
  ".scss",
  ".html",
]);

const MAX_FILE_BYTES = 512_000;

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  language: string;
}

export async function scanWorkspaceFiles(
  workspaceRoot: string,
  ig: Ignore
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (isIgnoredPath(ig, workspaceRoot, absolutePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) {
        continue;
      }

      try {
        const stat = await fs.promises.stat(absolutePath);
        if (stat.size > MAX_FILE_BYTES) {
          continue;
        }
      } catch {
        continue;
      }

      results.push({
        absolutePath,
        relativePath: path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/"),
        language: extToLanguage(ext),
      });
    }
  }

  await walk(workspaceRoot);
  return results;
}

function extToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".md": "markdown",
    ".json": "json",
  };
  return map[ext] ?? ext.slice(1);
}
