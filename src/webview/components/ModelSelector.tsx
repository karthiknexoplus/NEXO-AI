import React, { useEffect, useMemo, useState } from "react";
import type { OllamaModelsPayload, Provider, SettingsPayload } from "../vscode";
import { vscode } from "../vscode";

interface ModelSelectorProps {
  variant?: "drawer" | "inline";
  settings: SettingsPayload | null;
  apiKeyInput: string;
  ollamaModels: OllamaModelsPayload | null;
  onProviderChange: (p: Provider) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onSave: () => void;
  saveState?: "idle" | "saved" | "error";
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openrouter: "OpenRouter (cloud)",
  ollama: "Ollama (local · free)",
  custom: "Custom API key",
};

const CUSTOM_MODEL_VALUE = "__custom__";

export function ModelSelector({
  variant = "inline",
  settings,
  apiKeyInput,
  ollamaModels,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onApiKeyChange,
  onSave,
  saveState = "idle",
}: ModelSelectorProps) {
  const provider = settings?.provider ?? "ollama";
  const [useCustomModel, setUseCustomModel] = useState(false);

  const modelOptions = useMemo(() => {
    const fromServer = ollamaModels?.models ?? [];
    const merged = Array.from(new Set([...fromServer, settings?.model ?? ""].filter(Boolean)));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [ollamaModels?.models, settings?.model]);

  useEffect(() => {
    if (provider === "ollama") {
      vscode.postMessage({
        type: "fetchOllamaModels",
        baseUrl: settings?.baseUrl,
      });
    }
  }, [provider, settings?.baseUrl]);

  useEffect(() => {
    if (!settings?.model) {
      return;
    }
    if (provider === "ollama" && modelOptions.length > 0) {
      setUseCustomModel(!modelOptions.includes(settings.model));
    }
  }, [settings?.model, modelOptions, provider]);

  const refreshOllama = () => {
    vscode.postMessage({
      type: "fetchOllamaModels",
      baseUrl: settings?.baseUrl,
    });
  };

  const shell =
    variant === "drawer"
      ? "px-3 py-3 space-y-3"
      : "border-b border-nexo-border bg-nexo-elevated px-3 py-2 space-y-2";

  return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <label className="text-xs text-nexo-muted shrink-0">Provider</label>
        <select
          className="flex-1 bg-nexo-input border border-nexo-border rounded-md px-2 py-1.5 text-sm text-nexo-fg"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
        >
          {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {provider === "ollama" && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-nexo-muted shrink-0">Base URL</label>
            <input
              className="flex-1 bg-nexo-input border border-nexo-border rounded-md px-2 py-1.5 text-sm text-nexo-fg"
              value={settings?.baseUrl ?? "http://localhost:11434"}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
            />
            <button
              type="button"
              onClick={refreshOllama}
              className="text-xs border border-surface-border rounded px-2 py-1 hover:bg-white/5"
              title="Refresh local models"
            >
              ↻
            </button>
          </div>
          {ollamaModels?.error && (
            <p className="text-[11px] text-amber-400/90 leading-snug">{ollamaModels.error}</p>
          )}
          {ollamaModels?.online && (
            <p className="text-[11px] text-emerald-400/80">Ollama connected · {modelOptions.length} model(s)</p>
          )}
        </>
      )}

      {provider === "custom" && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-nexo-muted shrink-0">Base URL</label>
            <input
              className="flex-1 bg-nexo-input border border-nexo-border rounded-md px-2 py-1.5 text-sm text-nexo-fg"
              value={settings?.baseUrl ?? ""}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 shrink-0">API key</label>
            <input
              type="password"
              className="flex-1 bg-surface border border-surface-border rounded px-2 py-1 text-sm"
              value={apiKeyInput}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={settings?.hasApiKey ? "•••••••• (saved)" : "sk-..."}
            />
          </div>
        </>
      )}

      {provider === "openrouter" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 shrink-0">API key</label>
          <input
            type="password"
            className="flex-1 bg-surface border border-surface-border rounded px-2 py-1 text-sm"
            value={apiKeyInput}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={settings?.hasApiKey ? "•••••••• (saved)" : "OpenRouter key"}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 shrink-0">Model</label>
        {provider === "ollama" ? (
          <select
            className="flex-1 bg-surface border border-surface-border rounded px-2 py-1 text-sm font-mono"
            value={useCustomModel ? CUSTOM_MODEL_VALUE : settings?.model ?? ""}
            onChange={(e) => {
              if (e.target.value === CUSTOM_MODEL_VALUE) {
                setUseCustomModel(true);
                return;
              }
              setUseCustomModel(false);
              onModelChange(e.target.value);
            }}
          >
            {modelOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={CUSTOM_MODEL_VALUE}>Custom model name…</option>
          </select>
        ) : (
          <input
            className="flex-1 bg-surface border border-surface-border rounded px-2 py-1 text-sm font-mono"
            value={settings?.model ?? ""}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder={
              provider === "openrouter" ? "openrouter/free" : "gpt-4o-mini"
            }
          />
        )}
        <button
          type="button"
          onClick={onSave}
          className={`text-xs px-2 py-1 rounded text-white transition-colors ${
            saveState === "saved"
              ? "bg-emerald-600"
              : saveState === "error"
                ? "bg-red-600"
                : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Failed" : "Save"}
        </button>
      </div>

      {provider === "ollama" && useCustomModel && (
        <input
          className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-sm font-mono"
          value={settings?.model ?? ""}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="e.g. qwen2.5-coder or deepseek-r1"
        />
      )}
    </div>
  );
}
