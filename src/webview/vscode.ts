declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

export const vscode = acquireVsCodeApi();

export type Provider = "openrouter" | "ollama" | "custom";

export interface SettingsPayload {
  provider: Provider;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  openRouterModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  customBaseUrl?: string;
  customModel?: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
}

export interface OllamaModelsPayload {
  models: string[];
  online: boolean;
  error?: string;
}
