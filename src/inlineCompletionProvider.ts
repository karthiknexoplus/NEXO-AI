import * as vscode from "vscode";
import {
  buildSystemPrompt,
  formatContextForPrompt,
  getActiveEditorContext,
} from "./context";
import { completeText, getLlmConfigFromWorkspace } from "./llmClient";

const DEBOUNCE_MS = 400;

export class CursorCloneInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingResolve:
    | ((items: vscode.InlineCompletionItem[]) => void)
    | undefined;

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.InlineCompletionItem[] | vscode.InlineCompletionList> {
    const enabled = vscode.workspace
      .getConfiguration("cursor-clone")
      .get<boolean>("inlineCompletionEnabled", true);
    if (!enabled) {
      return [];
    }

    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.pendingResolve = resolve;

      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve([]);
          return;
        }

        try {
          const linePrefix = document
            .getText(new vscode.Range(position.line, 0, position.line, position.character))
            .trim();
          if (linePrefix.length < 2) {
            resolve([]);
            return;
          }

          const ctx = getActiveEditorContext();
          const config = getLlmConfigFromWorkspace();
          const prefix = document.getText(
            new vscode.Range(
              new vscode.Position(Math.max(0, position.line - 40), 0),
              position
            )
          );

          const messages = [
            {
              role: "system" as const,
              content: buildSystemPrompt("completion"),
            },
            {
              role: "user" as const,
              content: `${formatContextForPrompt(ctx)}\n\nComplete after this prefix:\n\`\`\`\n${prefix}\n\`\`\``,
            },
          ];

          const completion = await completeText(messages, config, {
            temperature: 0.1,
            maxTokens: 120,
          });

          if (token.isCancellationRequested || !completion) {
            resolve([]);
            return;
          }

          const item = new vscode.InlineCompletionItem(
            completion,
            new vscode.Range(position, position)
          );
          resolve([item]);
        } catch {
          resolve([]);
        }
      }, DEBOUNCE_MS);
    });
  }
}
