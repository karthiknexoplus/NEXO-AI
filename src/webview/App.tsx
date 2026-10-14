import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { SettingsDrawer } from "./components/SettingsDrawer";
import type { ChatMessage, OllamaModelsPayload, Provider, SettingsPayload } from "./vscode";
import { vscode } from "./vscode";

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [contextPreview, setContextPreview] = useState("");
  const [ollamaModels, setOllamaModels] = useState<OllamaModelsPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const streamIdRef = useRef<string | null>(null);

  const modelOptions = useMemo(() => {
    const fromServer = ollamaModels?.models ?? [];
    const merged = Array.from(new Set([...fromServer, settings?.model ?? ""].filter(Boolean)));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [ollamaModels?.models, settings?.model]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      switch (data.type) {
        case "settings":
          setSettings(data.settings as SettingsPayload);
          break;
        case "context":
          setContextPreview(data.context as string);
          break;
        case "ollamaModels":
          setOllamaModels({
            models: data.models as string[],
            online: Boolean(data.online),
            error: data.error as string | undefined,
          });
          break;
        case "streamStart":
          streamIdRef.current = data.id as string;
          setMessages((prev) => {
            const withoutPending = prev.filter((m) => !m.id.startsWith("pending-"));
            return [
              ...withoutPending,
              {
                id: data.id as string,
                role: "assistant",
                content: "",
                streaming: true,
              },
            ];
          });
          setSending(true);
          break;
        case "streamToken":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id ? { ...m, content: m.content + (data.token as string) } : m
            )
          );
          break;
        case "streamEnd":
          setMessages((prev) =>
            prev.map((m) => (m.id === data.id ? { ...m, streaming: false } : m))
          );
          setSending(false);
          streamIdRef.current = null;
          break;
        case "streamError":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id
                ? {
                    ...m,
                    content: `**Error:** ${data.error as string}`,
                    streaming: false,
                  }
                : m
            )
          );
          setSending(false);
          break;
        case "settingsSaved":
          setSaveState(data.ok ? "saved" : "error");
          window.setTimeout(() => setSaveState("idle"), 2500);
          break;
      }
    };

    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const pendingAssistant: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingAssistant]);
    setInput("");
    setSending(true);
    streamIdRef.current = pendingAssistant.id;

    vscode.postMessage({
      type: "sendMessage",
      text,
      history,
      settings: settings
        ? {
            provider: settings.provider,
            model: settings.model,
            baseUrl: settings.baseUrl,
            apiKey: apiKeyInput || undefined,
          }
        : undefined,
    });
  }, [input, messages, sending, settings, apiKeyInput]);

  const saveSettings = () => {
    if (!settings) {
      return;
    }
    vscode.postMessage({
      type: "updateSettings",
      settings: {
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        apiKey: apiKeyInput || undefined,
      },
    });
  };

  const onProviderChange = (provider: Provider) => {
    setSettings((s) => {
      if (!s) {
        return s;
      }
      const defaults: Record<Provider, { model: string; baseUrl: string }> = {
        openrouter: {
          model: s.openRouterModel || "openrouter/free",
          baseUrl: "https://openrouter.ai/api/v1",
        },
        ollama: {
          model: s.ollamaModel || "qwen2.5-coder",
          baseUrl: s.ollamaBaseUrl || "http://localhost:11434",
        },
        custom: {
          model: s.customModel || "gpt-4o-mini",
          baseUrl: s.customBaseUrl || "https://api.openai.com/v1",
        },
      };
      return { ...s, provider, ...defaults[provider] };
    });
  };

  const modelLabel = (settings?.model ?? "qwen2.5-coder").replace(":latest", "");

  return (
    <div className="app-shell relative">
      <ChatHeader
        modelLabel={modelLabel}
        ollamaOnline={Boolean(ollamaModels?.online)}
        onNewChat={() => setMessages([])}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <MessageList messages={messages} />

      <Composer
        value={input}
        onChange={setInput}
        onSend={send}
        sending={sending}
        model={settings?.model ?? "qwen2.5-coder"}
        modelOptions={modelOptions}
        onModelChange={(model) => {
          setSettings((s) => (s ? { ...s, model } : s));
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        apiKeyInput={apiKeyInput}
        ollamaModels={ollamaModels}
        contextPreview={contextPreview}
        saveState={saveState}
        onProviderChange={onProviderChange}
        onModelChange={(model) => setSettings((s) => (s ? { ...s, model } : s))}
        onBaseUrlChange={(baseUrl) => setSettings((s) => (s ? { ...s, baseUrl } : s))}
        onApiKeyChange={setApiKeyInput}
        onSave={saveSettings}
        onRefreshContext={() => vscode.postMessage({ type: "getContext" })}
      />
    </div>
  );
}
