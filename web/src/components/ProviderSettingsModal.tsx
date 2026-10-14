import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  fetchProviderSettings,
  saveProviderSettings,
  type ProviderId,
  type ProviderSettingsPublic,
} from "../lib/providerSettings";
import { fetchGithubSettings, saveGithubSettings } from "../lib/git";

type SettingsTab = "providers" | "github" | "google";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "groq", label: "Groq" },
  { id: "opencode", label: "OpenCode Zen" },
  { id: "custom", label: "Custom OpenAI URL" },
  { id: "ollama", label: "Ollama (local)" },
];

interface ProviderSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProviderSettingsModal({ open, onClose }: ProviderSettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("providers");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProviderSettingsPublic | null>(null);

  const [form, setForm] = useState({
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
    ghUser: "",
    ghToken: "",
    googleClientId: "",
    googleClientSecret: "",
  });

  useEffect(() => {
    if (!open) return;
    void fetchProviderSettings().then((s) => {
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
    });
    void fetchGithubSettings().then((g) => {
      setForm((f) => ({ ...f, ghUser: g.username }));
    });
    void fetch("/api/settings/oauth", { credentials: "include" })
      .then((r) => r.json())
      .then((o: { googleClientId?: string }) => {
        setForm((f) => ({ ...f, googleClientId: o.googleClientId || "" }));
      })
      .catch(() => {});
  }, [open]);

  const saveProviders = async () => {
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
      setSettings(await saveProviderSettings(patch));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveGithub = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch: { username?: string; token?: string } = { username: form.ghUser };
      if (form.ghToken && !form.ghToken.includes("••••")) patch.token = form.ghToken;
      await saveGithubSettings(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveGoogle = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = { googleClientId: form.googleClientId };
      if (form.googleClientSecret && !form.googleClientSecret.includes("••••")) {
        body.googleClientSecret = form.googleClientSecret;
      }
      const res = await fetch("/api/settings/oauth", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Could not save Google OAuth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto nexo-glass bg-nexo-sidebar border border-nexo-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-nexo-border bg-nexo-sidebar/95">
          <h2 className="font-display font-semibold text-lg">Studio settings</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-nexo-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-3 border-b border-nexo-border">
          {(
            [
              ["providers", "Intelligence"],
              ["github", "GitHub"],
              ["google", "Google sign-in"],
            ] as [SettingsTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium ${
                tab === id ? "nexo-pill-active" : "text-nexo-muted hover:bg-nexo-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === "providers" && (
            <>
              <p className="text-[11px] text-nexo-muted">
                Keys are stored on your server only. Leave blank to keep saved values.
              </p>
              <label className="block text-[12px] text-nexo-muted">
                Active provider
                <select
                  value={form.activeProvider}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activeProvider: e.target.value as ProviderId }))
                  }
                  className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm"
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
                  placeholder={settings?.hasOpenrouterKey ? "Saved" : "sk-or-v1-…"}
                  value={form.openrouterApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, openrouterApiKey: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["modelFast", "modelSmart", "modelDeep"] as const).map((key, i) => (
                  <label key={key} className="block text-[11px] text-nexo-muted">
                    {["Fast", "Smart", "Deep"][i]}
                    <input
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-nexo-border bg-nexo-composer px-2 py-1.5 text-[11px] font-mono"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveProviders()}
                className="w-full py-2.5 rounded-xl nexo-btn-primary text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save intelligence settings"}
              </button>
            </>
          )}

          {tab === "github" && (
            <>
              <p className="text-[11px] text-nexo-muted">For commit / push from the code panel.</p>
              <input
                value={form.ghUser}
                onChange={(e) => setForm((f) => ({ ...f, ghUser: e.target.value }))}
                placeholder="GitHub username"
                className="w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={form.ghToken}
                onChange={(e) => setForm((f) => ({ ...f, ghToken: e.target.value }))}
                placeholder="Personal access token"
                className="w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveGithub()}
                className="w-full py-2.5 rounded-xl border border-nexo-border text-sm font-semibold hover:bg-nexo-hover"
              >
                Save GitHub token
              </button>
            </>
          )}

          {tab === "google" && (
            <>
              <p className="text-[11px] text-nexo-muted leading-relaxed">
                Create OAuth credentials in Google Cloud Console. Authorized redirect URI:{" "}
                <code className="text-[10px] bg-nexo-composer px-1 rounded">
                  https://ai.nexoplus.in/api/auth/google/callback
                </code>
              </p>
              <input
                value={form.googleClientId}
                onChange={(e) => setForm((f) => ({ ...f, googleClientId: e.target.value }))}
                placeholder="Google Client ID"
                className="w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              />
              <input
                type="password"
                value={form.googleClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, googleClientSecret: e.target.value }))}
                placeholder="Google Client Secret"
                className="w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveGoogle()}
                className="w-full py-2.5 rounded-xl border border-nexo-border text-sm font-semibold hover:bg-nexo-hover"
              >
                Save Google OAuth
              </button>
            </>
          )}

          {error && <p className="text-[12px] text-red-500">{error}</p>}
          {saving && (
            <p className="text-[11px] text-nexo-muted flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
