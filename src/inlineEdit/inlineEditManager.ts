import * as vscode from "vscode";
import { InlineEditSession, resolveInlineEditRange } from "./inlineEditSession";
import { InlineEditVirtualDocumentProvider } from "./virtualDocuments";

export class InlineEditManager {
  private static instance: InlineEditManager | undefined;

  private session: InlineEditSession | undefined;
  readonly docProvider = new InlineEditVirtualDocumentProvider();

  static getInstance(): InlineEditManager {
    if (!this.instance) {
      this.instance = new InlineEditManager();
    }
    return this.instance;
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        "cursor-clone-inline",
        this.docProvider
      )
    );
  }

  async start(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("Open a file to use inline edit.");
      return;
    }

    if (this.session) {
      this.session.reject();
      this.session = undefined;
    }

    const targetRange = resolveInlineEditRange(editor);
    const session = new InlineEditSession(editor, targetRange, this.docProvider);
    this.session = session;

    try {
      await session.start();
    } finally {
      if (this.session === session) {
        this.session = undefined;
      }
    }
  }

  async accept(): Promise<void> {
    await this.session?.accept();
    this.session = undefined;
  }

  reject(): void {
    this.session?.reject();
    this.session = undefined;
  }
}
