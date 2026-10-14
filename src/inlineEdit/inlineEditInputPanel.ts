import * as vscode from "vscode";

export interface InlineEditInputResult {
  instruction: string;
  cancelled: boolean;
}

export class InlineEditInputPanel {
  private panel: vscode.WebviewPanel | undefined;
  private resolve: ((result: InlineEditInputResult) => void) | undefined;

  show(anchor: {
    line: number;
    character: number;
    hasSelection: boolean;
    preview: string;
  }): Promise<InlineEditInputResult> {
    this.dispose();

    return new Promise((resolve) => {
      this.resolve = resolve;

      this.panel = vscode.window.createWebviewPanel(
        "cursorCloneInlineEditInput",
        "Inline Edit",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      this.panel.webview.html = this.getHtml(anchor);

      this.panel.webview.onDidReceiveMessage((msg: { type: string; text?: string }) => {
        if (msg.type === "submit" && msg.text?.trim()) {
          this.finish({ instruction: msg.text.trim(), cancelled: false });
        }
        if (msg.type === "cancel") {
          this.finish({ instruction: "", cancelled: true });
        }
      });

      this.panel.onDidDispose(() => {
        this.finish({ instruction: "", cancelled: true });
      });

      void vscode.commands.executeCommand(
        "setContext",
        "cursor-clone.inlineEditInputActive",
        true
      );
    });
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
    void vscode.commands.executeCommand(
      "setContext",
      "cursor-clone.inlineEditInputActive",
      false
    );
  }

  private finish(result: InlineEditInputResult): void {
    if (!this.resolve) {
      return;
    }
    const resolve = this.resolve;
    this.resolve = undefined;
    this.dispose();
    resolve(result);
  }

  private getHtml(anchor: {
    line: number;
    character: number;
    hasSelection: boolean;
    preview: string;
  }): string {
    const location = `Ln ${anchor.line + 1}, Col ${anchor.character + 1}`;
    const scope = anchor.hasSelection ? "selection" : "line at cursor";
    const escapedPreview = escapeHtml(anchor.preview.slice(0, 240));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 14px 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #1e1e1e;
      color: #e0e0e0;
      font-size: 13px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      color: #9a9a9a;
      font-size: 11px;
    }
    .chip {
      background: #2d2d2d;
      border: 1px solid #3c3c3c;
      border-radius: 999px;
      padding: 2px 8px;
      white-space: nowrap;
    }
    .preview {
      margin: 0 0 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #3c3c3c;
      background: #252526;
      font-family: Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1.45;
      max-height: 72px;
      overflow: hidden;
      white-space: pre-wrap;
      color: #b8b8b8;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    textarea {
      flex: 1;
      resize: vertical;
      min-height: 64px;
      max-height: 140px;
      border-radius: 8px;
      border: 1px solid #3c3c3c;
      background: #252526;
      color: #f3f3f3;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.4;
      outline: none;
    }
    textarea:focus {
      border-color: #0078d4;
      box-shadow: 0 0 0 1px #0078d4;
    }
    button {
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .primary { background: #0078d4; color: #fff; }
    .primary:hover { background: #1a86d9; }
    .ghost {
      background: transparent;
      color: #9a9a9a;
      border: 1px solid #3c3c3c;
      margin-top: 8px;
      width: 100%;
    }
    .hint {
      margin-top: 8px;
      font-size: 11px;
      color: #777;
    }
    kbd {
      background: #333;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="meta">
    <span class="chip">⌘K / Ctrl+K</span>
    <span>${location} · ${scope}</span>
  </div>
  <pre class="preview">${escapedPreview || "No code in scope"}</pre>
  <div class="row">
    <textarea id="input" placeholder="Describe the edit… e.g. refactor to async/await"></textarea>
    <button class="primary" id="go">Generate</button>
  </div>
  <button class="ghost" id="cancel">Cancel (Esc)</button>
  <p class="hint">After generation: <kbd>⌘</kbd>+<kbd>Enter</kbd> accept · <kbd>Esc</kbd> reject</p>
  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('input');
    const go = document.getElementById('go');
    const cancel = document.getElementById('cancel');
    input.focus();
    function submit() {
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ type: 'submit', text });
    }
    go.addEventListener('click', submit);
    cancel.addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        vscode.postMessage({ type: 'cancel' });
      }
    });
  </script>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
