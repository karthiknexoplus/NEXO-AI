import { useEffect, useState } from "react";
import { ChatArea } from "./components/ChatArea";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { listModels } from "./lib/ollama";
import { useChatStore } from "./store/chatStore";

export default function App() {
  const [models, setModels] = useState<string[]>([]);
  const [modelsOnline, setModelsOnline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setModel = useChatStore((s) => s.setModel);
  const model = useChatStore((s) => s.model);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await listModels();
        setModels(list);
        setModelsOnline(true);
        if (list.length && !list.includes(model)) {
          const match = list.find((m) => m.startsWith("qwen2.5-coder")) ?? list[0];
          setModel(match);
        }
      } catch {
        setModelsOnline(false);
      }
    };
    void load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [model, setModel]);

  return (
    <div className="h-full flex">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} modelsOnline={modelsOnline} />
      <ChatArea models={models} modelsOnline={modelsOnline} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
