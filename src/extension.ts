import * as vscode from "vscode";
import { ChatViewProvider } from "./ChatViewProvider";
import { CursorCloneInlineCompletionProvider } from "./inlineCompletionProvider";
import { acceptInlineEdit, rejectInlineEdit, runInlineEdit } from "./inlineEdit";
import { InlineEditManager } from "./inlineEdit/inlineEditManager";
import { getCodebaseIndexer, runIndexCodebaseCommand } from "./rag/indexer";

export function activate(context: vscode.ExtensionContext): void {
  InlineEditManager.getInstance().register(context);

  const chatProvider = new ChatViewProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursor-clone.openChat", () => {
      chatProvider.focus();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursor-clone.indexCodebase", () => {
      void runIndexCodebaseCommand(context);
    })
  );

  const autoIndex = vscode.workspace
    .getConfiguration("cursor-clone")
    .get<boolean>("ragAutoIndex", false);
  if (autoIndex && vscode.workspace.workspaceFolders?.[0]) {
    const indexer = getCodebaseIndexer(context);
    void indexer.indexWorkspace(vscode.workspace.workspaceFolders[0].uri.fsPath);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("cursor-clone.inlineEdit", () => {
      void runInlineEdit();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursor-clone.inlineEdit.accept", () => {
      void acceptInlineEdit();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursor-clone.inlineEdit.reject", () => {
      rejectInlineEdit();
    })
  );

  const inlineProvider = new CursorCloneInlineCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      inlineProvider
    )
  );

  console.log("Cursor Clone extension activated");
}

export function deactivate(): void {
  // no-op
}
