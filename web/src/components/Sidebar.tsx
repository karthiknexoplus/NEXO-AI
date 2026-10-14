import {
  FolderKanban,
  MessageSquarePlus,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useChatStore } from "../store/chatStore";

interface SidebarProps {
  onOpenSettings: () => void;
  modelsOnline: boolean;
}

export function Sidebar({ onOpenSettings, modelsOnline }: SidebarProps) {
  const {
    projects,
    threads,
    activeProjectId,
    activeThreadId,
    setActiveProject,
    newThread,
    setActiveThread,
    newProject,
  } = useChatStore();

  const projectThreads = threads.filter((t) => t.projectId === activeProjectId);

  return (
    <aside className="w-[260px] shrink-0 h-full flex flex-col bg-cursor-sidebar border-r border-cursor-border">
      <div className="p-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cursor-accent/80 to-cursor-accent/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">NEXO</p>
          <p className="text-[10px] text-cursor-muted flex items-center gap-1">
            <span
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                modelsOnline ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            {modelsOnline ? "Ollama local" : "Ollama offline"}
          </p>
        </div>
      </div>

      <div className="px-2 space-y-1">
        <button
          type="button"
          onClick={() => newThread()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium bg-cursor-hover hover:bg-white/10 transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4 text-cursor-muted" />
          New Chat
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-cursor-muted hover:bg-cursor-hover transition-colors"
        >
          <Search className="w-4 h-4" />
          Search chats
        </button>
      </div>

      <div className="mt-4 px-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-cursor-muted">
            Projects
          </span>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Project name", "New Project");
              if (name?.trim()) newProject(name.trim());
            }}
            className="text-[11px] text-cursor-accent hover:underline"
          >
            + New
          </button>
        </div>
        <ul className="space-y-0.5">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActiveProject(p.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-left transition-colors",
                  p.id === activeProjectId
                    ? "bg-cursor-hover text-cursor-fg"
                    : "text-cursor-muted hover:bg-cursor-hover/60"
                )}
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 px-3 flex-1 min-h-0 flex flex-col">
        <span className="text-[11px] font-medium uppercase tracking-wider text-cursor-muted mb-2">
          Chats
        </span>
        <ul className="space-y-0.5 overflow-y-auto flex-1 pr-1">
          {projectThreads.length === 0 && (
            <li className="text-[12px] text-cursor-muted px-2 py-4">No chats yet</li>
          )}
          {projectThreads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setActiveThread(t.id)}
                className={clsx(
                  "w-full text-left px-2.5 py-2 rounded-md text-[13px] transition-colors truncate",
                  t.id === activeThreadId
                    ? "bg-cursor-hover text-cursor-fg"
                    : "text-cursor-muted hover:bg-cursor-hover/60"
                )}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-2 border-t border-cursor-border">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-cursor-muted hover:bg-cursor-hover"
        >
          <Settings2 className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
