import React from "react";

interface ChatHeaderProps {
  modelLabel: string;
  ollamaOnline: boolean;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function ChatHeader({
  modelLabel,
  ollamaOnline,
  onNewChat,
  onOpenSettings,
}: ChatHeaderProps) {
  return (
    <header className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-nexo-border/80">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-nexo-accent/15 border border-nexo-border flex items-center justify-center text-[11px] font-bold text-nexo-accent">
          N
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-nexo-fg leading-tight truncate">NEXO Chat</p>
          <p className="text-[10px] text-nexo-muted truncate flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                ollamaOnline ? "bg-emerald-400 status-dot-live" : "bg-amber-400"
              }`}
            />
            {ollamaOnline ? "Local" : "Offline"} · {modelLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNewChat}
          className="text-[11px] px-2 py-1 rounded-md text-nexo-muted hover:text-nexo-fg hover:bg-white/5 transition-colors"
        >
          New chat
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-7 h-7 rounded-md text-nexo-muted hover:text-nexo-fg hover:bg-white/5 transition-colors flex items-center justify-center"
          title="Settings"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>
  );
}
