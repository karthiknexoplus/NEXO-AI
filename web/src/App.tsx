import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppFooter } from "./components/AppFooter";
import { BuildWizard } from "./components/BuildWizard";
import { ChatArea } from "./components/ChatArea";
import { CodePanel } from "./components/CodePanel";
import { LoginPage } from "./components/LoginPage";
import { Sidebar } from "./components/Sidebar";
import { fetchAuthMe, logout } from "./lib/auth";
import { fetchIntelligenceModes, type IntelligenceModeOption } from "./lib/intelligence";
import { useWorkspaceId } from "./hooks/useWorkspaceId";
import { downloadProjectZip } from "./lib/workspace";
import { applyTheme, useThemeStore } from "./store/themeStore";
import { useUiStore } from "./store/uiStore";

export default function App() {
  const [modes, setModes] = useState<IntelligenceModeOption[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const workspaceId = useWorkspaceId();
  const queuePrompt = useUiStore((s) => s.queuePrompt);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void fetchAuthMe().then((r) => {
      setSignedIn(!!r.authenticated);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void fetchIntelligenceModes().then(setModes);
  }, [signedIn]);

  const handleSignOut = async () => {
    await logout();
    setSignedIn(false);
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
    return <LoginPage onEnterStudio={() => setSignedIn(true)} />;
  }

  return (
    <div className="h-full flex flex-col nexo-app-bg">
      <div className="flex-1 flex min-h-0 overflow-hidden p-1.5 gap-1.5">
        <Sidebar
          onBuildMyApp={() => setWizardOpen(true)}
          onDownloadZip={() => {
            if (workspaceId) downloadProjectZip(workspaceId);
            else window.alert("Start a chat or open an imported folder to download files.");
          }}
          onSignOut={handleSignOut}
        />
        <ChatArea modes={modes} />
        <CodePanel />
      </div>
      <AppFooter />
      <BuildWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={(prompt, autoSend) => queuePrompt(prompt, autoSend)}
      />
    </div>
  );
}
