import { useState } from "react";
import { AppFooter } from "./components/AppFooter";
import { BuildWizard } from "./components/BuildWizard";
import { ChatArea } from "./components/ChatArea";
import { CodePanel } from "./components/CodePanel";
import { Sidebar } from "./components/Sidebar";
import { fetchIntelligenceModes, type IntelligenceModeOption } from "./lib/intelligence";
import { downloadProjectZip } from "./lib/workspace";
import { useChatStore } from "./store/chatStore";
import { applyTheme, useThemeStore } from "./store/themeStore";
import { useUiStore } from "./store/uiStore";
import { useEffect } from "react";

export default function App() {
  const [modes, setModes] = useState<IntelligenceModeOption[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const queuePrompt = useUiStore((s) => s.queuePrompt);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void fetchIntelligenceModes().then(setModes);
  }, []);

  return (
    <div className="h-full flex flex-col nexo-app-bg">
      <div className="flex-1 flex min-h-0 overflow-hidden p-1.5 gap-1.5">
        <Sidebar
          onBuildMyApp={() => setWizardOpen(true)}
          onDownloadZip={() => downloadProjectZip(activeProjectId)}
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
