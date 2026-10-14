import * as fs from "fs";
import * as path from "path";
import ignore, { type Ignore } from "ignore";

const DEFAULT_IGNORE = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  "coverage/",
  "*.min.js",
  "*.map",
  ".vscode-test/",
  "*.vsix",
];

export function createWorkspaceIgnore(workspaceRoot: string): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE);

  const gitignorePath = path.join(workspaceRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      ig.add(fs.readFileSync(gitignorePath, "utf8"));
    } catch {
      // ignore unreadable .gitignore
    }
  }

  return ig;
}

export function isIgnoredPath(ig: Ignore, workspaceRoot: string, absolutePath: string): boolean {
  const relative = path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
  if (!relative || relative.startsWith("..")) {
    return true;
  }
  return ig.ignores(relative);
}
