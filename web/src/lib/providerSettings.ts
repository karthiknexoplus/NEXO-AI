export type ProviderId = "openrouter" | "groq" | "opencode" | "custom" | "ollama";

export interface ProviderSettingsPublic {
  activeProvider: ProviderId;
  openrouterApiKey: string;
  groqApiKey: string;
  opencodeZenApiKey: string;
  customApiKey: string;
  customBaseUrl: string;
  ollamaHost: string;
  ollamaFallback: boolean;
  modelFast: string;
  modelSmart: string;
  modelDeep: string;
  cloudTimeoutMs: number;
  hasOpenrouterKey?: boolean;
  hasGroqKey?: boolean;
  hasOpencodeKey?: boolean;
  hasCustomKey?: boolean;
}

export type ProviderSettingsUpdate = Partial<{
  activeProvider: ProviderId;
  openrouterApiKey: string;
  groqApiKey: string;
  opencodeZenApiKey: string;
  customApiKey: string;
  customBaseUrl: string;
  ollamaHost: string;
  ollamaFallback: boolean;
  modelFast: string;
  modelSmart: string;
  modelDeep: string;
  cloudTimeoutMs: number;
}>;

const jsonOpts: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export async function fetchProviderSettings(): Promise<ProviderSettingsPublic> {
  const res = await fetch("/api/settings/providers", { credentials: "include" });
  if (!res.ok) throw new Error("Could not load settings");
  return (await res.json()) as ProviderSettingsPublic;
}

export async function saveProviderSettings(
  patch: ProviderSettingsUpdate
): Promise<ProviderSettingsPublic> {
  const res = await fetch("/api/settings/providers", {
    ...jsonOpts,
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Could not save settings");
  }
  return (await res.json()) as ProviderSettingsPublic;
}
