import * as vscode from "vscode";
import {
  buildSystemPrompt,
  formatContextForPrompt,
  getActiveEditorContext,
} from "../context";
import { getLlmConfigFromWorkspace, streamChatCompletion } from "../llmClient";
import { InlineEditInputPanel } from "./inlineEditInputPanel";
import { stripMarkdownFences } from "./stripCode";
import {
  createInlineEditUri,
  InlineEditVirtualDocumentProvider,
} from "./virtualDocuments";

export class InlineEditSession {
  readonly id = `session-${Date.now()}`;

  private readonly editor: vscode.TextEditor;
  private readonly targetRange: vscode.Range;
  private readonly originalText: string;
  private readonly docProvider: InlineEditVirtualDocumentProvider;

  private proposedRaw = "";
  private proposedText = "";
  private instruction = "";
  private disposed = false;
  private streaming = false;
  private diffOpened = false;

  private readonly originalUri = createInlineEditUri(this.id, "original");
  private readonly modifiedUri = createInlineEditUri(this.id, "modified");

  private selectionDecoration: vscode.TextEditorDecorationType | undefined;
  private ghostDecoration: vscode.TextEditorDecorationType | undefined;
  private inputPanel: InlineEditInputPanel | undefined;
  private statusItem: vscode.StatusBarItem | undefined;
  private inlayProvider: vscode.Disposable | undefined;

  constructor(
    editor: vscode.TextEditor,
    targetRange: vscode.Range,
    docProvider: InlineEditVirtualDocumentProvider
  ) {
    this.editor = editor;
    this.targetRange = targetRange;
    this.originalText = editor.document.getText(targetRange);
    this.docProvider = docProvider;

    this.docProvider.setContent(this.originalUri, this.originalText);
    this.docProvider.setContent(this.modifiedUri, "");
  }

  async start(): Promise<void> {
    this.applySelectionHighlight();
    await this.editor.revealRange(this.targetRange, vscode.TextEditorRevealType.InCenter);

    this.inputPanel = new InlineEditInputPanel();
    const result = await this.inputPanel.show({
      line: this.targetRange.start.line,
      character: this.targetRange.start.character,
      hasSelection: !this.editor.selection.isEmpty,
      preview: this.originalText,
    });

    if (result.cancelled || !result.instruction) {
      this.reject();
      return;
    }

    this.instruction = result.instruction;
    await this.runStream();
  }

  async accept(): Promise<void> {
    if (this.disposed || !this.proposedText.trim()) {
      if (!this.disposed && !this.proposedText.trim()) {
        void vscode.window.showWarningMessage("Nothing to apply yet — wait for generation to finish.");
      }
      return;
    }

    await this.closeDiffEditors();

    const editor = vscode.window.activeTextEditor ?? this.editor;
    if (editor.document.uri.toString() !== this.editor.document.uri.toString()) {
      const doc = await vscode.workspace.openTextDocument(this.editor.document.uri);
      const opened = await vscode.window.showTextDocument(doc, { viewColumn: this.editor.viewColumn });
      await opened.edit((eb) => eb.replace(this.targetRange, this.proposedText));
    } else {
      await editor.edit((eb) => eb.replace(this.targetRange, this.proposedText));
    }

    void vscode.window.showInformationMessage("Inline edit applied.");
    this.dispose();
  }

  reject(): void {
    if (this.disposed) {
      return;
    }
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.inputPanel?.dispose();
    this.selectionDecoration?.dispose();
    this.ghostDecoration?.dispose();
    this.inlayProvider?.dispose();
    this.statusItem?.dispose();

    void this.closeDiffEditors();
    void vscode.commands.executeCommand("setContext", "cursor-clone.inlineEditPreviewActive", false);

    this.docProvider.delete(this.originalUri);
    this.docProvider.delete(this.modifiedUri);
  }

  private async runStream(): Promise<void> {
    this.streaming = true;
    this.createGhostDecoration();
    this.registerInlayPreview();
    this.showPreviewStatus();

    void vscode.commands.executeCommand(
      "setContext",
      "cursor-clone.inlineEditPreviewActive",
      true
    );

    await this.openDiffPreview();

    const ctx = getActiveEditorContext();
    const config = getLlmConfigFromWorkspace();

    await streamChatCompletion(
      [
        { role: "system", content: buildSystemPrompt("inline-edit") },
        {
          role: "user",
          content: [
            formatContextForPrompt(ctx),
            "",
            `Instruction: ${this.instruction}`,
            "",
            "Code to edit:",
            "```",
            this.originalText,
            "```",
            "",
            "Return only the updated code for the snippet above (no explanation).",
          ].join("\n"),
        },
      ],
      config,
      {
        onToken: (token) => {
          this.proposedRaw += token;
          this.proposedText = stripMarkdownFences(this.proposedRaw);
          this.docProvider.setContent(this.modifiedUri, this.proposedText);
          this.refreshGhostDecorations();
        },
        onDone: () => {
          this.streaming = false;
          this.proposedText = stripMarkdownFences(this.proposedRaw);
          this.docProvider.setContent(this.modifiedUri, this.proposedText);
          this.refreshGhostDecorations();
          this.showPreviewStatus();
        },
        onError: (err) => {
          this.streaming = false;
          void vscode.window.showErrorMessage(`Inline edit failed: ${err.message}`);
          this.reject();
        },
      },
      { temperature: 0.15, maxTokens: 4096 }
    );
  }

  private applySelectionHighlight(): void {
    this.selectionDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("editor.selectionHighlightBackground"),
      border: "1px solid",
      borderColor: new vscode.ThemeColor("focusBorder"),
      isWholeLine: false,
    });

    this.editor.setDecorations(this.selectionDecoration, [this.targetRange]);
  }

  private createGhostDecoration(): void {
    this.ghostDecoration = vscode.window.createTextEditorDecorationType({
      textDecoration: "none; opacity: 0.45",
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  private registerInlayPreview(): void {
    this.inlayProvider = vscode.languages.registerInlayHintsProvider(
      { scheme: this.editor.document.uri.scheme },
      {
        provideInlayHints: (document, range, _token) => {
          if (document.uri.toString() !== this.editor.document.uri.toString()) {
            return [];
          }
          if (this.disposed || !this.proposedText) {
            return [];
          }
          if (!range.intersection(this.targetRange)) {
            return [];
          }

          const hints: vscode.InlayHint[] = [];
          const lines = this.proposedText.split("\n");
          const previewLines = lines.slice(0, 12);

          previewLines.forEach((line, index) => {
            const lineNumber = this.targetRange.start.line + index;
            if (lineNumber > document.lineCount - 1) {
              return;
            }
            const position = new vscode.Position(
              lineNumber,
              index === 0 ? this.targetRange.end.character : document.lineAt(lineNumber).text.length
            );
            hints.push(
              new vscode.InlayHint(
                position,
                [{ value: index === 0 ? ` → ${line}` : line }],
                vscode.InlayHintKind.Parameter
              )
            );
          });

          return hints;
        },
      }
    );
  }

  private refreshGhostDecorations(): void {
    if (!this.ghostDecoration || !this.proposedText) {
      return;
    }

    const lines = this.proposedText.split("\n");
    const decorations: vscode.DecorationOptions[] = lines.map((line, index) => {
      const lineIndex = this.targetRange.start.line + index;
      const lineText = this.editor.document.lineAt(
        Math.min(lineIndex, this.editor.document.lineCount - 1)
      ).text;
      const startChar = index === 0 ? this.targetRange.start.character : 0;
      const endChar = index === 0 ? this.targetRange.end.character : lineText.length;

      return {
        range: new vscode.Range(lineIndex, startChar, lineIndex, endChar),
        renderOptions: {
          after: {
            contentText: index === 0 ? "" : ` ${line}`,
            color: new vscode.ThemeColor("editorGhostText.foreground"),
            fontStyle: "italic",
            margin: "0 0 0 1em",
          },
        },
      };
    });

    this.editor.setDecorations(this.ghostDecoration, decorations);
  }

  private async openDiffPreview(): Promise<void> {
    if (this.diffOpened) {
      return;
    }
    this.diffOpened = true;

    const title = `Inline Edit: ${vscode.workspace.asRelativePath(this.editor.document.uri)}`;
    await vscode.commands.executeCommand(
      "vscode.diff",
      this.originalUri,
      this.modifiedUri,
      title,
      { preview: false, preserveFocus: true }
    );
  }

  private async closeDiffEditors(): Promise<void> {
    const tabsToClose: vscode.Tab[] = [];

    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputTextDiff) {
          const original = tab.input.original.toString();
          const modified = tab.input.modified.toString();
          if (
            original.startsWith("cursor-clone-inline:") ||
            modified.startsWith("cursor-clone-inline:")
          ) {
            tabsToClose.push(tab);
          }
        }
      }
    }

    if (tabsToClose.length > 0) {
      await vscode.window.tabGroups.close(tabsToClose);
    }
  }

  private showPreviewStatus(): void {
    if (!this.statusItem) {
      this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }
    const state = this.streaming ? "Generating…" : "Ready";
    this.statusItem.text = `$(sparkle) Inline Edit: ${state} · ⌘Enter accept · Esc reject`;
    this.statusItem.show();
  }
}

export function resolveInlineEditRange(editor: vscode.TextEditor): vscode.Range {
  const selection = editor.selection;
  if (!selection.isEmpty) {
    return selection;
  }

  const line = selection.active.line;
  const lineText = editor.document.lineAt(line).text;
  return new vscode.Range(line, 0, line, lineText.length);
}
