import { useRef, useState } from "react";
import {
  Download,
  FolderKanban,
  FolderUp,
  MessageSquarePlus,
  Moon,
  Rocket,
  Search,
  Settings,
  Sun,
  LogOut,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { folderNameFromFileList, importLocalFolder } from "../lib/workspace";
import { resolveWorkspaceId } from "../lib/workspaceId";
import { useChatStore } from "../store/chatStore";
import { useThemeStore } from "../store/themeStore";
import { useUiStore } from "../store/uiStore";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onBuildMyApp: () => void;
  onDownloadZip: () => void;
  onSignOut: () => void;
  onOpenSettings?: () => void;
  userEmail?: string;
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
  onBuildMyApp,
  onDownloadZip,
  onSignOut,
  onOpenSettings,
  userEmail,
}: SidebarProps) {
  const {
    projects,
    threads,
    activeProjectId,
    activeThreadId,
    setActiveProject,
    newThread,
    newThreadInProject,
    setActiveThread,
    newProject,
    newImportedProject,
    deleteThread,
  } = useChatStore();
  const { theme, toggle } = useThemeStore();
  const bumpWorkspace = useUiStore((s) => s.bumpWorkspace);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const chatImportRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [chatQuery, setChatQuery] = useState("");

  const defaultProjects = projects.filter((p) => p.kind !== "imported");
  const importedProjects = projects.filter((p) => p.kind === "imported");

  const workspaceId = resolveWorkspaceId(projects, activeProjectId, activeThreadId);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const canImportToChat =
    activeProject?.kind !== "imported" && !!activeThreadId && !!workspaceId;

  const projectThreads = threads
    .filter((t) => t.projectId === activeProjectId)
    .filter((t) =>
      chatQuery.trim()
        ? t.title.toLowerCase().includes(chatQuery.trim().toLowerCase())
        : true
    );

  const onImportAsNewFolder = async (list: FileList | null) => {
    if (!list?.length) return;
    setImporting(true);
    try {
      const name = folderNameFromFileList(list);
      const projectId = newImportedProject(name);
      const written = await importLocalFolder(projectId, list);
      newThreadInProject(projectId);
      bumpWorkspace();
      window.alert(`Imported ${written.length} file(s) into folder "${name}". Start chatting to modify it.`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const pickThread = (id: string) => {
    setActiveThread(id);
    onMobileClose();
  };

  const pickProject = (id: string) => {
    setActiveProject(id);
    onMobileClose();
  };

  const onImportToCurrentChat = async (list: FileList | null) => {
    if (!list?.length || !workspaceId) return;
    setImporting(true);
    try {
      const written = await importLocalFolder(workspaceId, list);
      bumpWorkspace();
      window.alert(`Imported ${written.length} file(s) into this chat's workspace.`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (chatImportRef.current) chatImportRef.current.value = "";
    }
  };

  return (
    <aside
      className={clsx(
        "shrink-0 h-full flex flex-col nexo-glass bg-nexo-sidebar border border-nexo-border rounded-2xl overflow-hidden shadow-sm transition-transform duration-300 ease-out",
        "w-[min(100vw-1rem,280px)] max-lg:fixed max-lg:left-2 max-lg:top-2 max-lg:bottom-2 max-lg:z-40 max-lg:h-auto",
        mobileOpen
          ? "max-lg:translate-x-0 max-lg:pointer-events-auto"
          : "max-lg:-translate-x-[110%] max-lg:pointer-events-none",
        "lg:relative lg:w-[280px] lg:translate-x-0 lg:pointer-events-auto"
      )}
    >
      <div className="p-5 border-b border-nexo-border">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-nexo-border bg-nexo-composer/50 flex items-center justify-center p-1.5 overflow-hidden">
            <img
              src="/nexoplus-logo.png"
              alt="NEXOPLUS"
              className="max-h-full max-w-full w-auto h-auto object-contain"
            />
          </div>
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
          onClick={() => {
            newThread();
            onMobileClose();
          }}
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
          onChange={(e) => void onImportAsNewFolder(e.target.files)}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => folderInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg transition-colors disabled:opacity-50"
          title="Import a folder as its own workspace"
        >
          <FolderUp className="w-4 h-4" />
          {importing ? "Importing…" : "Import folder (new workspace)"}
        </button>
        {canImportToChat && (
          <>
            <input
              ref={chatImportRef}
              type="file"
              className="hidden"
              multiple
              // @ts-expect-error webkitdirectory
              webkitdirectory=""
              directory=""
              onChange={(e) => void onImportToCurrentChat(e.target.files)}
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => chatImportRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-nexo-muted hover:bg-nexo-hover hover:text-nexo-fg transition-colors disabled:opacity-50"
            >
              <FolderUp className="w-3.5 h-3.5" />
              Import into this chat
            </button>
          </>
        )}
      </div>

      <div className="mt-4 px-3 flex-1 min-h-0 flex flex-col overflow-y-auto">
        {importedProjects.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-nexo-muted">
                Imported folders
              </span>
            </div>
            <ul className="space-y-0.5 mb-4">
              {importedProjects.map((p) => (
                <li key={p.id} className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => pickProject(p.id)}
                    className={clsx(
                      "flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-left transition-all duration-200",
                      p.id === activeProjectId
                        ? "bg-nexo-brand/15 text-nexo-fg ring-1 ring-nexo-brand/30"
                        : "text-nexo-muted hover:bg-nexo-hover/70"
                    )}
                  >
                    <FolderUp className="w-3.5 h-3.5 shrink-0 text-nexo-brand" />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button
                    type="button"
                    title="New chat in this folder"
                    onClick={() => {
                      newThreadInProject(p.id);
                      onMobileClose();
                    }}
                    className="shrink-0 px-2 rounded-lg text-nexo-muted hover:bg-nexo-hover hover:text-nexo-brand"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

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
          {defaultProjects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pickProject(p.id)}
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
          {activeProject?.kind === "imported" ? ` · ${activeProject.name}` : ""}
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
        <ul className="space-y-0.5 flex-1 pr-1 pb-2">
          {projectThreads.length === 0 && (
            <li className="text-[12px] text-nexo-muted px-2 py-3">
              {activeProject?.kind === "imported"
                ? "Start a chat to ask about this folder."
                : "Each chat has its own files."}
            </li>
          )}
          {projectThreads.map((t) => (
            <li key={t.id} className="group flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => pickThread(t.id)}
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

      <div className="p-3 border-t border-nexo-border space-y-2">
        {userEmail && (
          <p className="text-[10px] text-nexo-muted truncate px-1" title={userEmail}>
            {userEmail}
          </p>
        )}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            Studio settings
          </button>
        )}
        <div className="flex items-center justify-between">
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
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
