import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  buildSystemPrompt,
  formatContextForPrompt,
  getActiveEditorContext,
} from "./context";
import {
  getLlmConfigFromWorkspace,
  listOllamaModels,
  LlmClientError,
  LlmProvider,
  SUGGESTED_OLLAMA_MODELS,
  streamChatCompletion,
} from "./llmClient";
import { getCodebaseIndexer } from "./rag/indexer";

type WebviewMessage =
  | { type: "ready" }
  | {
      type: "sendMessage";
      text: string;
      history: { role: string; content: string }[];
      settings?: {
        provider: LlmProvider;
        model: string;
        baseUrl?: string;
        apiKey?: string;
      };
    }
  | {
      type: "updateSettings";
      settings: {
        provider: LlmProvider;
        model: string;
        baseUrl?: string;
        apiKey?: string;
      };
    }
  | { type: "applyCode"; code: string; language?: string }
  | { type: "getContext" }
  | { type: "fetchOllamaModels"; baseUrl?: string };

type ExtensionMessage =
  | { type: "settings"; settings: ReturnType<typeof readSettingsForWebview> }
  | { type: "context"; context: string }
  | { type: "streamStart"; id: string }
  | { type: "streamToken"; id: string; token: string }
  | { type: "streamEnd"; id: string }
  | { type: "streamError"; id: string; error: string }
  | {
      type: "ollamaModels";
      models: string[];
      error?: string;
      online: boolean;
    }
  | { type: "settingsSaved"; ok: boolean; message?: string };

function readSettingsForWebview() {
  const config = vscode.workspace.getConfiguration("cursor-clone");
  const llm = getLlmConfigFromWorkspace();
  return {
    provider: llm.provider,
    model: llm.model,
    baseUrl: llm.baseUrl,
    hasApiKey: Boolean(llm.apiKey),
    openRouterModel: config.get<string>("openRouterModel"),
    ollamaBaseUrl: config.get<string>("ollamaBaseUrl"),
    ollamaModel: config.get<string>("ollamaModel"),
    customBaseUrl: config.get<string>("customBaseUrl"),
    customModel: config.get<string>("customModel"),
  };
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursor-clone.chatView";

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly extensionContext: vscode.ExtensionContext
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready":
        case "getContext":
          this.post({ type: "settings", settings: readSettingsForWebview() });
          this.post({
            type: "context",
            context: formatContextForPrompt(getActiveEditorContext()),
          });
          await this.sendOllamaModels();
          break;
        case "updateSettings":
          try {
            await this.persistSettings(msg.settings);
            this.post({ type: "settings", settings: readSettingsForWebview() });
            this.post({ type: "settingsSaved", ok: true, message: "Settings saved" });
            void vscode.window.showInformationMessage(
              `Cursor Clone: using Ollama model "${msg.settings.model}"`
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save settings";
            this.post({ type: "settingsSaved", ok: false, message });
          }
          break;
        case "sendMessage":
          await this.handleChat(msg.text, msg.history, msg.settings);
          break;
        case "applyCode":
          await this.applyCodeToEditor(msg.code);
          break;
        case "fetchOllamaModels":
          await this.sendOllamaModels(msg.baseUrl);
          break;
      }
    });
  }

  private async sendOllamaModels(baseUrl?: string): Promise<void> {
    const config = getLlmConfigFromWorkspace();
    const url = baseUrl ?? config.baseUrl;
    try {
      const models = await listOllamaModels(url);
      this.post({
        type: "ollamaModels",
        online: true,
        models: models.map((m) => m.name),
      });
    } catch (err) {
      const message =
        err instanceof LlmClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to list Ollama models.";
      this.post({
        type: "ollamaModels",
        online: false,
        models: [...SUGGESTED_OLLAMA_MODELS],
        error: message,
      });
    }
  }

  public focus(): void {
    if (this.view) {
      this.view.show?.(true);
    } else {
      void vscode.commands.executeCommand("cursor-clone.chatView.focus");
    }
  }

  private post(message: ExtensionMessage | { type: "settings"; settings: unknown }) {
    void this.view?.webview.postMessage(message);
  }

  private async persistSettings(settings: {
    provider: LlmProvider;
    model: string;
    baseUrl?: string;
    apiKey?: string;
  }) {
    const config = vscode.workspace.getConfiguration("cursor-clone");
    await config.update("provider", settings.provider, vscode.ConfigurationTarget.Global);

    switch (settings.provider) {
      case "openrouter":
        await config.update("openRouterModel", settings.model, vscode.ConfigurationTarget.Global);
        if (settings.apiKey) {
          await config.update(
            "openRouterApiKey",
            settings.apiKey,
            vscode.ConfigurationTarget.Global
          );
        }
        break;
      case "ollama":
        if (settings.baseUrl) {
          await config.update("ollamaBaseUrl", settings.baseUrl, vscode.ConfigurationTarget.Global);
        }
        await config.update("ollamaModel", settings.model, vscode.ConfigurationTarget.Global);
        break;
      case "custom":
        if (settings.baseUrl) {
          await config.update("customBaseUrl", settings.baseUrl, vscode.ConfigurationTarget.Global);
        }
        await config.update("customModel", settings.model, vscode.ConfigurationTarget.Global);
        if (settings.apiKey) {
          await config.update("customApiKey", settings.apiKey, vscode.ConfigurationTarget.Global);
        }
        break;
    }
  }

  private async handleChat(
    userText: string,
    history: { role: string; content: string }[],
    liveSettings?: {
      provider: LlmProvider;
      model: string;
      baseUrl?: string;
      apiKey?: string;
    }
  ) {
    const id = `msg-${Date.now()}`;
    this.post({ type: "streamStart", id });

    try {
    const ctx = formatContextForPrompt(getActiveEditorContext());
    const config = getLlmConfigFromWorkspace(
      liveSettings
        ? {
            provider: liveSettings.provider,
            model: liveSettings.model,
            baseUrl: liveSettings.baseUrl,
            apiKey: liveSettings.apiKey,
          }
        : undefined
    );

    let systemExtras = `Current editor context:\n${ctx}`;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot && userText.includes("@codebase")) {
      const indexer = getCodebaseIndexer(this.extensionContext);
      const ragContext = await indexer.buildCodebaseContext(workspaceRoot, userText);
      if (ragContext) {
        systemExtras += `\n\n---\n${ragContext}`;
      }
    }

    const messages = [
      {
        role: "system" as const,
        content: `${buildSystemPrompt("chat")}\n\n${systemExtras}`,
      },
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user" as const, content: userText },
    ];

    await streamChatCompletion(messages, config, {
      onToken: (token) => {
        this.post({ type: "streamToken", id, token });
      },
      onDone: () => {
        this.post({ type: "streamEnd", id });
      },
      onError: (err) => {
        this.post({ type: "streamError", id, error: err.message });
      },
    });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.post({ type: "streamError", id, error: message });
    }
  }

  private async applyCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("No active editor to apply code.");
      return;
    }

    const selection = editor.selection;
    await editor.edit((eb) => {
      if (!selection.isEmpty) {
        eb.replace(selection, code);
      } else {
        eb.insert(selection.active, code);
      }
    });
    void vscode.window.showInformationMessage("Applied code to active editor.");
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js")
    );
    const cspSource = webview.cspSource;

    const htmlPath = path.join(this.extensionUri.fsPath, "src", "webview", "index.html");
    let template = fs.readFileSync(htmlPath, "utf8");
    template = template.replace(/\{\{SCRIPT_URI\}\}/g, scriptUri.toString());
    template = template.replace(/\{\{CSP_SOURCE\}\}/g, cspSource);
    return template;
  }
}
