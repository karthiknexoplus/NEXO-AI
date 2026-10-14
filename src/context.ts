import * as vscode from "vscode";

export interface EditorContext {
  filePath: string;
  languageId: string;
  fullText: string;
  selectionText: string;
  selectionRange: vscode.Range | null;
  cursorLine: number;
  cursorCharacter: number;
  visibleRange?: { startLine: number; endLine: number };
}

export function getActiveEditorContext(): EditorContext | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const doc = editor.document;
  const selection = editor.selection;
  const selectionText = doc.getText(selection);
  const visible = editor.visibleRanges[0];

  return {
    filePath: doc.uri.fsPath,
    languageId: doc.languageId,
    fullText: doc.getText(),
    selectionText,
    selectionRange: selection.isEmpty ? null : selection,
    cursorLine: selection.active.line,
    cursorCharacter: selection.active.character,
    visibleRange: visible
      ? {
          startLine: visible.start.line,
          endLine: visible.end.line,
        }
      : undefined,
  };
}

export function formatContextForPrompt(ctx: EditorContext | null): string {
  if (!ctx) {
    return "No active editor.";
  }

  const parts: string[] = [
    `File: ${ctx.filePath}`,
    `Language: ${ctx.languageId}`,
    `Cursor: line ${ctx.cursorLine + 1}, column ${ctx.cursorCharacter + 1}`,
  ];

  if (ctx.selectionText.trim()) {
    parts.push(
      `Selected lines (${ctx.selectionRange!.start.line + 1}-${ctx.selectionRange!.end.line + 1}):`,
      "```",
      ctx.selectionText,
      "```"
    );
  } else {
    const lines = ctx.fullText.split("\n");
    const start = Math.max(0, ctx.cursorLine - 30);
    const end = Math.min(lines.length, ctx.cursorLine + 31);
    const snippet = lines.slice(start, end).join("\n");
    parts.push(
      `File excerpt (lines ${start + 1}-${end}):`,
      "```",
      snippet,
      "```"
    );
  }

  return parts.join("\n");
}

const IDE_SYSTEM_CORE = [
  "You are an expert AI software developer embedded in a VS Code–style IDE (Cursor Clone).",
  "You help users design, implement, debug, and refactor production-ready full-stack applications on command.",
  "Write clean, maintainable, well-typed code with sensible architecture, error handling, and tests when appropriate.",
  "Prefer minimal, correct diffs over verbose explanations unless the user asks for a walkthrough.",
  "When showing code, use fenced markdown blocks with an accurate language tag.",
].join(" ");

export function buildSystemPrompt(purpose: "chat" | "inline-edit" | "completion"): string {
  switch (purpose) {
    case "inline-edit":
      return `${IDE_SYSTEM_CORE} Apply the user's instruction to the provided selection or file context. Return only the replacement code when a direct edit is requested, unless explanation is requested.`;
    case "completion":
      return `${IDE_SYSTEM_CORE} Continue the code naturally from the cursor. Output only the completion text to insert—no markdown fences or commentary.`;
    default:
      return IDE_SYSTEM_CORE;
  }
}
