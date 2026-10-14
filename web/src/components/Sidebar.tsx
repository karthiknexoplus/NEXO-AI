import {
  Download,
  FolderKanban,
  MessageSquarePlus,
  Moon,
  Rocket,
  Search,
  Sun,
} from "lucide-react";
import clsx from "clsx";
import { useChatStore } from "../store/chatStore";
import { useThemeStore } from "../store/themeStore";

interface SidebarProps {
  onBuildMyApp: () => void;
  onDownloadZip: () => void;
}

export function Sidebar({ onBuildMyApp, onDownloadZip }: SidebarProps) {
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
  const { theme, toggle } = useThemeStore();

  const projectThreads = threads.filter((t) => t.projectId === activeProjectId);

  return (
    <aside className="w-[272px] shrink-0 h-full flex flex-col bg-nexo-sidebar border-r border-nexo-border transition-colors duration-300">
      <div className="p-4 border-b border-nexo-border">
        <img
          src="/nexoplus-logo.png"
          alt="NEXOPLUS Automations"
          className="w-full rounded-lg object-contain max-h-[72px]"
        />
        <p className="text-[10px] text-center text-nexo-muted mt-2 tracking-wide uppercase">
          Intelligent AI Studio
        </p>
      </div>

      <div className="px-2 pt-2 space-y-1">
        <button
          type="button"
          onClick={() => newThread()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium bg-nexo-brand/15 text-nexo-fg hover:bg-nexo-brand/25 transition-all duration-200"
        >
          <MessageSquarePlus className="w-4 h-4 text-nexo-brand" />
          New Chat
        </button>
        <button
          type="button"
          onClick={onBuildMyApp}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border border-nexo-brand/40 text-nexo-brand hover:bg-nexo-brand/10 transition-all"
        >
          <Rocket className="w-4 h-4" />
          Build my app
        </button>
        <button
          type="button"
          onClick={onDownloadZip}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-nexo-muted hover:bg-nexo-hover transition-colors"
        >
          <Download className="w-4 h-4" />
          Download project ZIP
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-nexo-muted hover:bg-nexo-hover transition-colors opacity-60 cursor-not-allowed"
          title="Coming soon"
        >
          <Search className="w-4 h-4" />
          Search chats
        </button>
      </div>

      <div className="mt-4 px-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-nexo-muted">
            Projects
          </span>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Project name", "New Project");
              if (name?.trim()) newProject(name.trim());
            }}
            className="text-[11px] text-nexo-brand hover:underline"
          >
            + New
          </button>
        </div>
        <ul className="space-y-0.5 mb-4">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActiveProject(p.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-left transition-all duration-200",
                  p.id === activeProjectId
                    ? "bg-nexo-hover text-nexo-fg"
                    : "text-nexo-muted hover:bg-nexo-hover/70"
                )}
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <span className="text-[11px] font-semibold uppercase tracking-wider text-nexo-muted mb-2">
          Chats
        </span>
        <ul className="space-y-0.5 overflow-y-auto flex-1 pr-1">
          {projectThreads.length === 0 && (
            <li className="text-[12px] text-nexo-muted px-2 py-3">Start a new chat</li>
          )}
          {projectThreads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setActiveThread(t.id)}
                className={clsx(
                  "w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200 truncate",
                  t.id === activeThreadId
                    ? "bg-nexo-hover text-nexo-fg"
                    : "text-nexo-muted hover:bg-nexo-hover/70"
                )}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 border-t border-nexo-border flex items-center justify-between">
        <span className="text-[11px] text-nexo-muted">Theme</span>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] bg-nexo-hover hover:opacity-90 transition-all"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </aside>
  );
}
