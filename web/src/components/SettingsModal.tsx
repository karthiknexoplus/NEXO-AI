import { X } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cursor-border bg-cursor-sidebar shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-cursor-hover">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-[13px] text-cursor-muted">
          <p>
            <strong className="text-cursor-fg">Ollama</strong> runs on your machine. The web app
            proxies to <code className="text-[12px] bg-white/10 px-1 rounded">localhost:11434</code>.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[12px]">
            <li>
              <code>ollama serve</code>
            </li>
            <li>
              <code>ollama pull qwen2.5-coder</code>
            </li>
            <li>
              <code>cd web && npm run dev</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
