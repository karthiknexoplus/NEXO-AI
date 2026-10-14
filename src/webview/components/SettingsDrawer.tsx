import React from "react";
import { ModelSelector } from "./ModelSelector";
import type { OllamaModelsPayload, Provider, SettingsPayload } from "../vscode";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: SettingsPayload | null;
  apiKeyInput: string;
  ollamaModels: OllamaModelsPayload | null;
  contextPreview: string;
  saveState: "idle" | "saved" | "error";
  onProviderChange: (p: Provider) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onSave: () => void;
  onRefreshContext: () => void;
}

export function SettingsDrawer({
  open,
  onClose,
  settings,
  apiKeyInput,
  ollamaModels,
  contextPreview,
  saveState,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onApiKeyChange,
  onSave,
  onRefreshContext,
}: SettingsDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-nexo-bg/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-nexo-border">
        <span className="text-sm font-medium">Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-2 py-1 rounded-md hover:bg-white/5 text-nexo-muted"
        >
          Done
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ModelSelector
          variant="drawer"
          settings={settings}
          apiKeyInput={apiKeyInput}
          ollamaModels={ollamaModels}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          onBaseUrlChange={onBaseUrlChange}
          onApiKeyChange={onApiKeyChange}
          onSave={onSave}
          saveState={saveState}
        />
        {contextPreview && (
          <details className="px-3 py-2 text-xs text-nexo-muted border-t border-nexo-border">
            <summary className="cursor-pointer py-1">Editor context</summary>
            <pre className="whitespace-pre-wrap max-h-32 overflow-y-auto text-[10px] pb-2 mt-1 font-mono">
              {contextPreview}
            </pre>
            <button
              type="button"
              onClick={onRefreshContext}
              className="text-[11px] text-nexo-accent hover:underline"
            >
              Refresh context
            </button>
          </details>
        )}
      </div>
    </div>
  );
}
