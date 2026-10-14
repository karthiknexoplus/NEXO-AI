import { listProjectFiles, readProjectFile } from "./workspace";

const MAX_CONTEXT_CHARS = 48_000;
const MAX_FILES = 24;

/** Attach workspace files so the model can edit specific paths (Cursor-style context). */
export async function buildWorkspaceContext(
  projectId: string,
  userMessage: string
): Promise<string> {
  const files = await listProjectFiles(projectId);
  if (files.length === 0) return "";

  const lower = userMessage.toLowerCase();
  const mentioned = files.filter((f) => {
    const base = f.split("/").pop() ?? f;
    return lower.includes(f.toLowerCase()) || lower.includes(base.toLowerCase());
  });

  const ordered = [...new Set([...mentioned, ...files])].slice(0, MAX_FILES);

  let block =
    "=== NEXOPLUS workspace (on disk — update these paths when the user asks to change a file) ===\n";
  let used = block.length;

  for (const path of ordered) {
    try {
      const content = await readProjectFile(projectId, path);
      const chunk = `\n\`\`\`${path}\n${content}\n\`\`\`\n`;
      if (used + chunk.length > MAX_CONTEXT_CHARS) {
        block += `\n(workspace truncated — ${ordered.length - ordered.indexOf(path)} more files on disk)\n`;
        break;
      }
      block += chunk;
      used += chunk.length;
    } catch {
      /* skip unreadable */
    }
  }

  return block;
}

export function isMultiFileBuildRequest(text: string): boolean {
  return /\b(scaffold|build|create|generate|landing|app|api|full project|all files)\b/i.test(
    text
  );
}

export function formatNetworkError(message: string): string {
  if (/load failed|failed to fetch|network error|networkconnection/i.test(message)) {
    return "NEXOPLUS lost the connection while generating (often a timeout on long replies). Your partial answer may be saved — say “continue” or try NEXOPLUS Fast for smaller chunks.";
  }
  return message;
}
