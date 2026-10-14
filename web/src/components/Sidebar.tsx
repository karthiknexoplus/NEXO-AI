import { useRef, useState } from "react";
import {
  Download,
  FolderKanban,
  FolderUp,
  MessageSquarePlus,
  Moon,
  Rocket,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { importLocalFolder } from "../lib/workspace";
import { useChatStore } from "../store/chatStore";
import { useThemeStore } from "../store/themeStore";
import { useUiStore } from "../store/uiStore";

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
    deleteThread,
  } = useChatStore();
  const { theme, toggle } = useThemeStore();
  const bumpWorkspace = useUiStore((s) => s.bumpWorkspace);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [chatQuery, setChatQuery] = useState("");

  const projectThreads = threads
    .filter((t) => t.projectId === activeProjectId)
    .filter((t) =>
      chatQuery.trim()
        ? t.title.toLowerCase().includes(chatQuery.trim().toLowerCase())
        : true
    );

  const onImportFolder = async (list: FileList | null) => {
    if (!list?.length) return;
    setImporting(true);
    try {
      const written = await importLocalFolder(activeProjectId, list);
      bumpWorkspace();
      window.alert(`Imported ${written.length} file(s) into your workspace.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      window.alert(msg);
    } finally {
      setImporting(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  return (
    <aside className="w-[280px] shrink-0 h-full flex flex-col nexo-glass bg-nexo-sidebar border border-nexo-border rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
      <div className="p-5 border-b border-nexo-border">
        <div className="flex items-center gap-3">
          <img
            src="/nexoplus-logo.png"
            alt="NEXOPLUS"
            className="w-11 h-11 rounded-xl object-contain ring-1 ring-nexo-border"
          />
          <div className="min-w-0">
            <p className="font-display font-semibold text-[15px] tracking-tight text-nexo-fg leading-tight">
              NEXOPLUS
            </p>
            <p className="text-[10px] text-nexo-muted tracking-wide uppercase mt-0.5">
              AI Studio
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 space-y-1.5">
        <button
          type="button"
          onClick={() => newThread()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold nexo-btn-primary transition-all duration-200"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New chat
        </button>
        <button
          type="button"
          onClick={onBuildMyApp}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border border-nexo-border bg-nexo-composer/50 text-nexo-fg hover:bg-nexo-hover transition-all"
        >
          <Rocket className="w-4 h-4 text-nexo-brand" />
          Build my app
        </button>
        <button
          type="button"
          onClick={onDownloadZip}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download ZIP
        </button>
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error webkitdirectory for folder pick
          webkitdirectory=""
          directory=""
          onChange={(e) => void onImportFolder(e.target.files)}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => folderInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg transition-colors disabled:opacity-50"
          title="Import a folder from your computer into the workspace"
        >
          <FolderUp className="w-4 h-4" />
          {importing ? "Importing…" : "Import folder"}
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
                    ? "bg-nexo-hover text-nexo-fg ring-1 ring-nexo-border"
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
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-nexo-muted" />
          <input
            type="search"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full pl-8 pr-2 py-1.5 rounded-lg text-[12px] bg-nexo-composer/50 border border-nexo-border placeholder:text-nexo-muted focus:outline-none focus:ring-1 focus:ring-nexo-brand/40"
          />
        </div>
        <ul className="space-y-0.5 overflow-y-auto flex-1 pr-1">
          {projectThreads.length === 0 && (
            <li className="text-[12px] text-nexo-muted px-2 py-3">Start a new chat</li>
          )}
          {projectThreads.map((t) => (
            <li key={t.id} className="group flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setActiveThread(t.id)}
                className={clsx(
                  "flex-1 min-w-0 text-left px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200 truncate",
                  t.id === activeThreadId
                    ? "bg-nexo-hover text-nexo-fg ring-1 ring-nexo-border"
                    : "text-nexo-muted hover:bg-nexo-hover/70"
                )}
              >
                {t.title}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(`Delete chat "${t.title}"? This cannot be undone.`)
                  ) {
                    deleteThread(t.id);
                  }
                }}
                className="shrink-0 p-2 rounded-lg text-nexo-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-nexo-hover transition-all"
                aria-label={`Delete chat ${t.title}`}
                title="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
