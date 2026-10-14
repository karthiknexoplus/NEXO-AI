import { useState } from "react";
import { Loader2 } from "lucide-react";
import { login } from "../lib/auth";
import {
  fetchProviderSettings,
  saveProviderSettings,
  type ProviderId,
  type ProviderSettingsPublic,
} from "../lib/providerSettings";

interface LoginPageProps {
  onEnterStudio: () => void;
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "groq", label: "Groq" },
  { id: "opencode", label: "OpenCode Zen" },
  { id: "custom", label: "Custom OpenAI URL" },
  { id: "ollama", label: "Ollama (local)" },
];

async function loadSettingsIntoForm(
  setSettings: (s: ProviderSettingsPublic) => void,
  setForm: React.Dispatch<React.SetStateAction<typeof defaultForm>>
) {
  const s = await fetchProviderSettings();
  setSettings(s);
  setForm((f) => ({
    ...f,
    activeProvider: s.activeProvider,
    ollamaHost: s.ollamaHost,
    ollamaFallback: s.ollamaFallback,
    modelFast: s.modelFast,
    modelSmart: s.modelSmart,
    modelDeep: s.modelDeep,
    cloudTimeoutMs: s.cloudTimeoutMs,
    customBaseUrl: s.customBaseUrl,
  }));
}

const defaultForm = {
  activeProvider: "openrouter" as ProviderId,
  openrouterApiKey: "",
  groqApiKey: "",
  opencodeZenApiKey: "",
  customApiKey: "",
  customBaseUrl: "",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaFallback: true,
  modelFast: "openrouter/free",
  modelSmart: "openrouter/free",
  modelDeep: "openrouter/free",
  cloudTimeoutMs: 300000,
};

export function LoginPage({ onEnterStudio }: LoginPageProps) {
  const [email, setEmail] = useState("karthik@nexoplus.in");
  const [password, setPassword] = useState("Nexoplus@1234");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProviderSettingsPublic | null>(null);
  const [saving, setSaving] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [form, setForm] = useState(defaultForm);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      await login(email, password);
      setAuthed(true);
      await loadSettingsIntoForm(setSettings, setForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      setError("Sign in first to save intelligence settings.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {
        activeProvider: form.activeProvider,
        ollamaHost: form.ollamaHost,
        ollamaFallback: form.ollamaFallback,
        modelFast: form.modelFast,
        modelSmart: form.modelSmart,
        modelDeep: form.modelDeep,
        cloudTimeoutMs: form.cloudTimeoutMs,
        customBaseUrl: form.customBaseUrl,
      };
      if (form.openrouterApiKey && !form.openrouterApiKey.includes("••••"))
        patch.openrouterApiKey = form.openrouterApiKey;
      if (form.groqApiKey && !form.groqApiKey.includes("••••"))
        patch.groqApiKey = form.groqApiKey;
      if (form.opencodeZenApiKey && !form.opencodeZenApiKey.includes("••••"))
        patch.opencodeZenApiKey = form.opencodeZenApiKey;
      if (form.customApiKey && !form.customApiKey.includes("••••"))
        patch.customApiKey = form.customApiKey;

      const saved = await saveProviderSettings(patch);
      setSettings(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto nexo-app-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <img src="/nexoplus-logo.png" alt="" className="w-14 h-14 mx-auto rounded-xl mb-3" />
          <h1 className="font-display text-2xl font-bold tracking-tight">NEXOPLUS Studio</h1>
          <p className="text-nexo-muted text-sm mt-1">Sign in and configure intelligence providers</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="nexo-glass bg-nexo-sidebar border border-nexo-border rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-semibold text-[15px]">Sign in</h2>
          <label className="block text-[12px] text-nexo-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm"
              autoComplete="username"
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm"
              autoComplete="current-password"
            />
          </label>
          {error && !authed && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={signingIn}
            className="w-full py-2.5 rounded-xl nexo-btn-primary font-semibold text-sm disabled:opacity-50"
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
          {authed && (
            <button
              type="button"
              onClick={() => onEnterStudio()}
              className="w-full py-2.5 rounded-xl border border-nexo-border font-semibold text-sm hover:bg-nexo-hover"
            >
              Continue to studio
            </button>
          )}
        </form>

        <form
          onSubmit={handleSaveSettings}
          className="nexo-glass bg-nexo-sidebar border border-nexo-border rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-semibold text-[15px]">Intelligence providers</h2>
          <p className="text-[11px] text-nexo-muted leading-relaxed">
            API keys are stored on your server only (data file). UI still shows NEXOPLUS Fast /
            Smart / Deep to users. Leave a key blank to keep the existing saved value.
          </p>

          <label className="block text-[12px] text-nexo-muted">
            Active provider
            <select
              value={form.activeProvider}
              onChange={(e) =>
                setForm((f) => ({ ...f, activeProvider: e.target.value as ProviderId }))
              }
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm"
              disabled={!authed}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] text-nexo-muted">
            OpenRouter API key
            <input
              type="password"
              placeholder={settings?.hasOpenrouterKey ? "Saved (enter to replace)" : "sk-or-v1-…"}
              value={form.openrouterApiKey}
              onChange={(e) => setForm((f) => ({ ...f, openrouterApiKey: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            Groq API key
            <input
              type="password"
              placeholder={settings?.hasGroqKey ? "Saved" : "gsk_…"}
              value={form.groqApiKey}
              onChange={(e) => setForm((f) => ({ ...f, groqApiKey: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            OpenCode Zen API key
            <input
              type="password"
              placeholder={settings?.hasOpencodeKey ? "Saved" : "Zen key"}
              value={form.opencodeZenApiKey}
              onChange={(e) => setForm((f) => ({ ...f, opencodeZenApiKey: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            Custom base URL
            <input
              value={form.customBaseUrl}
              onChange={(e) => setForm((f) => ({ ...f, customBaseUrl: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            Custom API key
            <input
              type="password"
              value={form.customApiKey}
              onChange={(e) => setForm((f) => ({ ...f, customApiKey: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="block text-[12px] text-nexo-muted">
            Ollama host
            <input
              value={form.ollamaHost}
              onChange={(e) => setForm((f) => ({ ...f, ollamaHost: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              disabled={!authed}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-nexo-muted">
            <input
              type="checkbox"
              checked={form.ollamaFallback}
              onChange={(e) => setForm((f) => ({ ...f, ollamaFallback: e.target.checked }))}
              disabled={!authed}
            />
            Fall back to Ollama if cloud fails
          </label>

          <div className="grid grid-cols-3 gap-2">
            {(["modelFast", "modelSmart", "modelDeep"] as const).map((key, i) => (
              <label key={key} className="block text-[11px] text-nexo-muted">
                {["Fast", "Smart", "Deep"][i]} model
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1.5 text-[11px] font-mono"
                  disabled={!authed}
                />
              </label>
            ))}
          </div>

          {error && authed && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!authed || saving}
            className="w-full py-2.5 rounded-xl border border-nexo-border font-semibold text-sm hover:bg-nexo-hover disabled:opacity-40"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : (
              "Save provider settings"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
