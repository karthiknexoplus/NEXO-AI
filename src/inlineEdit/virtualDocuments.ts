import * as vscode from "vscode";

export const INLINE_EDIT_SCHEME = "cursor-clone-inline";

export class InlineEditVirtualDocumentProvider
  implements vscode.TextDocumentContentProvider
{
  private readonly contents = new Map<string, string>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "";
  }

  setContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  delete(uri: vscode.Uri): void {
    this.contents.delete(uri.toString());
  }
}

export function createInlineEditUri(
  sessionId: string,
  side: "original" | "modified"
): vscode.Uri {
  return vscode.Uri.from({
    scheme: INLINE_EDIT_SCHEME,
    path: `/${side}/${sessionId}.txt`,
  });
}
