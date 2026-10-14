import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppFooter } from "./components/AppFooter";
import { BuildWizard } from "./components/BuildWizard";
import { ChatArea } from "./components/ChatArea";
import { CodePanel } from "./components/CodePanel";
import { LandingPage } from "./components/LandingPage";
import { ProviderSettingsModal } from "./components/ProviderSettingsModal";
import { Sidebar } from "./components/Sidebar";
import { fetchAuthMe, logout, type AuthSession } from "./lib/auth";
import { fetchIntelligenceModes, type IntelligenceModeOption } from "./lib/intelligence";
import { useWorkspaceId } from "./hooks/useWorkspaceId";
import { downloadProjectZip } from "./lib/workspace";
import { applyTheme, useThemeStore } from "./store/themeStore";
import { useUiStore } from "./store/uiStore";

export default function App() {
  const [modes, setModes] = useState<IntelligenceModeOption[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const workspaceId = useWorkspaceId();
  const queuePrompt = useUiStore((s) => s.queuePrompt);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const setCodePanelOpen = useUiStore((s) => s.setCodePanelOpen);

  const signedIn = !!session?.authenticated;

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setCodePanelOpen(false);
      setSidebarOpen(false);
    }
  }, [setCodePanelOpen, setSidebarOpen]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("nexo-studio-lock", signedIn);
    return () => document.body.classList.remove("nexo-studio-lock");
  }, [signedIn]);

  useEffect(() => {
    void fetchAuthMe()
      .then((r) => {
        setSession(r.authenticated ? r : null);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void fetchIntelligenceModes().then(setModes);
  }, [signedIn]);

  const handleSignOut = async () => {
    await logout();
    setSession(null);
  };

  if (!authReady) {
    return (
      <div className="h-full flex items-center justify-center nexo-app-bg text-nexo-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <LandingPage
        onAuthenticated={(s) => setSession({ ...s, authenticated: true })}
      />
    );
  }

  return (
    <div className="h-full flex flex-col nexo-app-bg">
      {session?.isGuest && (
        <div className="shrink-0 text-center text-[11px] py-1.5 bg-nexo-brand/10 border-b border-nexo-brand/20 text-nexo-fg">
          Guest session — sign up to save settings and use your own API keys.
        </div>
      )}
      <div className="flex-1 flex min-h-0 overflow-hidden p-1 sm:p-1.5 gap-1.5 relative">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          onBuildMyApp={() => {
            setWizardOpen(true);
            setSidebarOpen(false);
          }}
          onDownloadZip={() => {
            if (workspaceId) downloadProjectZip(workspaceId);
            else window.alert("Start a chat or open an imported folder to download files.");
          }}
          onSignOut={handleSignOut}
          onOpenSettings={
            session?.canManageSettings
              ? () => {
                  setSettingsOpen(true);
                  setSidebarOpen(false);
                }
              : undefined
          }
          userEmail={session?.email}
        />
        <ChatArea
          modes={modes}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <CodePanel />
      </div>
      <AppFooter />
      <BuildWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={(prompt, autoSend) => queuePrompt(prompt, autoSend)}
      />
      <ProviderSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
