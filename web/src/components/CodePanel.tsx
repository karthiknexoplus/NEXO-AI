import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Bug,
  FileCode2,
  FilePlus,
  FolderUp,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Save,
} from "lucide-react";
import clsx from "clsx";
import {
  deleteProjectFile,
  importLocalFolder,
  listProjectFiles,
  readProjectFile,
  renameProjectFile,
  saveProjectFile,
} from "../lib/workspace";
import { useThemeStore } from "../store/themeStore";
import { labelForPhase } from "../lib/generationStatus";
import { useUiStore } from "../store/uiStore";
import { useWorkspaceId, useWorkspaceLabel } from "../hooks/useWorkspaceId";
import { GitHubPanel } from "./GitHubPanel";
import { PromptModal } from "./PromptModal";
import { ConfirmModal } from "./ConfirmModal";

function languageForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    py: "python",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

export function CodePanel() {
  const workspaceId = useWorkspaceId();
  const workspaceLabelText = useWorkspaceLabel();
  const workspaceVersion = useUiStore((s) => s.workspaceVersion);
  const generationPhase = useUiStore((s) => s.generationPhase);
  const generationDetail = useUiStore((s) => s.generationDetail);
  const openFilePath = useUiStore((s) => s.openFilePath);
  const setOpenFilePath = useUiStore((s) => s.setOpenFilePath);
  const codePanelOpen = useUiStore((s) => s.codePanelOpen);
  const setCodePanelOpen = useUiStore((s) => s.setCodePanelOpen);
  const queuePrompt = useUiStore((s) => s.queuePrompt);
  const showToast = useUiStore((s) => s.showToast);
  const bumpWorkspace = useUiStore((s) => s.bumpWorkspace);
  const theme = useThemeStore((s) => s.theme);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setFiles([]);
      setActiveFile(null);
      setContent("");
      setDirty(false);
      return;
    }
    const list = await listProjectFiles(workspaceId);
    setFiles(list);
    setActiveFile((cur) => {
      if (cur && list.includes(cur)) return cur;
      return list[0] ?? null;
    });
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [workspaceId, workspaceVersion, refresh]);

  useEffect(() => {
    if (!openFilePath) return;
    if (files.includes(openFilePath)) {
      setActiveFile(openFilePath);
      setOpenFilePath(null);
    }
  }, [openFilePath, files, setOpenFilePath]);

  useEffect(() => {
    if (!activeFile || !workspaceId) {
      setContent("");
      return;
    }
    void readProjectFile(workspaceId, activeFile).then((text) => {
      setContent(text);
      setDirty(false);
    });
  }, [activeFile, workspaceId, workspaceVersion]);

  const save = async () => {
    if (!activeFile || !workspaceId) return;
    setSaving(true);
    try {
      await saveProjectFile(workspaceId, activeFile, content);
      setDirty(false);
      showToast(`Saved ${activeFile}`, "success");
      bumpWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [fileModalMode, setFileModalMode] = useState<"new" | "rename">("new");
  const [fileModalInitial, setFileModalInitial] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const newFile = () => {
    if (!workspaceId) return;
    setFileModalMode("new");
    setFileModalInitial("src/new-file.ts");
    setFileModalOpen(true);
  };

  const renameActive = () => {
    if (!activeFile || !workspaceId) return;
    setFileModalMode("rename");
    setFileModalInitial(activeFile);
    setFileModalOpen(true);
  };

  const deleteActive = () => {
    if (!activeFile || !workspaceId) return;
    setConfirmDeleteOpen(true);
  };

  const submitFileModal = (value: string) => {
    const target = value.trim();
    if (!target || !workspaceId) {
      setFileModalOpen(false);
      return;
    }
    if (fileModalMode === "new") {
      void (async () => {
        try {
          await saveProjectFile(workspaceId, target, "");
          bumpWorkspace();
          setActiveFile(target);
          showToast(`Created ${target}`, "success");
        } catch (e) {
          showToast(e instanceof Error ? e.message : "Could not create file", "error");
        }
      })();
    } else if (activeFile) {
      const from = activeFile;
      void (async () => {
        try {
          await renameProjectFile(workspaceId, from, target);
          bumpWorkspace();
          setActiveFile(target);
          showToast(`Renamed to ${target}`, "success");
        } catch (e) {
          showToast(e instanceof Error ? e.message : "Could not rename file", "error");
        }
      })();
    }
    setFileModalOpen(false);
  };

  const confirmDelete = () => {
    if (!activeFile || !workspaceId) {
      setConfirmDeleteOpen(false);
      return;
    }
    const target = activeFile;
    void (async () => {
      try {
        await deleteProjectFile(workspaceId, target);
        bumpWorkspace();
        setActiveFile(null);
        showToast(`Deleted ${target}`, "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Could not delete file", "error");
      }
      setConfirmDeleteOpen(false);
    })();
  };

  const askAboutFile = () => {
    if (!activeFile) return;
    const snippet = content.length > 12000 ? `${content.slice(0, 12000)}\n…` : content;
    queuePrompt(
      `In workspace file \`${activeFile}\`, please modify or explain as needed:\n\n\`\`\`\n${snippet}\n\`\`\`\n\nWhat I want:`,
      false
    );
  };

  const fixActiveFile = () => {
    if (!activeFile) return;
    queuePrompt(`Fix bugs, edge cases, and TypeScript/runtime issues in \`${activeFile}\`. Keep changes minimal and preserve existing behavior. Output the updated file in a path fence.`, false);
  };
  const refactorActiveFile = () => {
    if (!activeFile) return;
    queuePrompt(`Refactor \`${activeFile}\` for clarity and maintainability without changing behavior. Output the updated file in a path fence.`, false);
  };
  const testActiveFile = () => {
    if (!activeFile) return;
    queuePrompt(`Create or improve tests for \`${activeFile}\` and related code. Output test files in path fences.`, false);
  };

  const onImportToWorkspace = async (list: FileList | null) => {
    if (!list?.length || !workspaceId) return;
    setImporting(true);
    try {
      const written = await importLocalFolder(workspaceId, list);
      bumpWorkspace();
      showToast(`Imported ${written.length} file(s) into ${workspaceLabelText}.`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  if (!codePanelOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => setCodePanelOpen(true)}
          className="hidden lg:flex shrink-0 w-11 rounded-2xl border border-nexo-border nexo-glass bg-nexo-sidebar flex-col items-center justify-center gap-1 text-nexo-muted hover:text-nexo-fg hover:border-nexo-brand/25 transition-colors"
          title="Open code panel"
        >
          <PanelRightOpen className="w-4 h-4" />
          <span className="text-[9px] writing-vertical">Code</span>
        </button>
        <button
          type="button"
          onClick={() => setCodePanelOpen(true)}
          className="lg:hidden fixed bottom-[4.5rem] right-3 z-20 w-12 h-12 rounded-full nexo-btn-primary shadow-lg flex items-center justify-center"
          aria-label="Open project files"
        >
          <FileCode2 className="w-5 h-5" />
        </button>
      </>
    );
  }

  return (
    <aside
      className={clsx(
        "shrink-0 flex flex-col border border-nexo-border nexo-glass bg-nexo-sidebar overflow-hidden transition-all duration-300",
        "max-lg:fixed max-lg:inset-2 max-lg:z-50 max-lg:rounded-2xl max-lg:shadow-2xl",
        "lg:relative lg:rounded-2xl lg:w-[min(42vw,520px)]"
      )}
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-nexo-border gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-semibold font-display text-nexo-fg">
            <FileCode2 className="w-4 h-4 text-nexo-brand shrink-0" />
            Project files
          </div>
          <p className="text-[10px] text-nexo-muted truncate">{workspaceLabelText}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={importInputRef}
            type="file"
            className="hidden"
            multiple
            // @ts-expect-error webkitdirectory
            webkitdirectory=""
            directory=""
            onChange={(e) => void onImportToWorkspace(e.target.files)}
          />
          <button
            type="button"
            disabled={!workspaceId}
            onClick={() => void newFile()}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted disabled:opacity-30"
            title="New file"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!workspaceId || importing}
            onClick={() => importInputRef.current?.click()}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted disabled:opacity-30"
            title="Import folder into this workspace"
          >
            <FolderUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!activeFile}
            onClick={askAboutFile}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted disabled:opacity-30"
            title="Ask NEXOPLUS to change this file"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!activeFile}
            onClick={fixActiveFile}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted disabled:opacity-30"
            title="Fix this file"
          >
            <Bug className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!activeFile}
            onClick={renameActive}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted disabled:opacity-30"
            title="Rename file"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!activeFile}
            onClick={() => void deleteActive()}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-red-400 disabled:opacity-30"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!activeFile || !dirty || saving}
            onClick={() => void save()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium nexo-btn-primary disabled:opacity-30"
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setCodePanelOpen(false)}
            className="p-1.5 rounded-md hover:bg-nexo-hover text-nexo-muted"
            title="Collapse panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col min-h-0">
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
          <ul className="w-full sm:w-[140px] max-h-[28vh] sm:max-h-none shrink-0 overflow-y-auto border-b sm:border-b-0 sm:border-r border-nexo-border py-2 text-[11px] flex sm:block flex-row sm:flex-col gap-1 px-2 sm:px-0 overflow-x-auto sm:overflow-x-visible">
            {files.length === 0 && (
              <li className="px-3 py-4 text-nexo-muted leading-snug">
                {generationPhase ? (
                  <span className="flex items-start gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-nexo-brand" />
                    {labelForPhase(generationPhase, generationDetail)}
                  </span>
                ) : workspaceId
                  ? "Files appear here when NEXOPLUS generates or you import a folder."
                  : "Start a new chat — each chat has its own file workspace."}
              </li>
            )}
            {files.map((f) => (
              <li key={f} className="shrink-0 sm:shrink sm:w-full">
                <button
                  type="button"
                  onClick={() => setActiveFile(f)}
                  className={clsx(
                    "text-left px-2 py-1.5 truncate font-mono transition-colors rounded-lg sm:rounded-none sm:w-full whitespace-nowrap max-w-[140px] sm:max-w-none",
                    activeFile === f
                      ? "bg-nexo-brand/20 text-nexo-fg"
                      : "text-nexo-muted hover:bg-nexo-hover"
                  )}
                  title={f}
                >
                  {f.split("/").pop()}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {activeFile ? (
              <>
                <div className="px-3 py-1.5 text-[10px] font-mono text-nexo-muted border-b border-nexo-border truncate">
                  {activeFile}
                  {dirty ? " · unsaved" : ""}
                </div>
                <div className="px-3 py-1.5 flex flex-wrap gap-1.5 border-b border-nexo-border">
                  {[
                    { label: "Fix", onClick: fixActiveFile },
                    { label: "Refactor", onClick: refactorActiveFile },
                    { label: "Tests", onClick: testActiveFile },
                    { label: "Chat", onClick: askAboutFile },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      className="text-[10px] px-2 py-1 rounded-md border border-nexo-border bg-nexo-composer text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language={languageForPath(activeFile)}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    value={content}
                    onChange={(v) => {
                      setContent(v ?? "");
                      setDirty(true);
                    }}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      padding: { top: 12 },
                      smoothScrolling: true,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[12px] text-nexo-muted p-6 text-center">
                {generationPhase ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-nexo-brand" />
                    {labelForPhase(generationPhase, generationDetail)}
                  </span>
                ) : workspaceId
                  ? "Select a file or ask NEXOPLUS to generate your app."
                  : "No chat selected — start a new chat."}
              </div>
            )}
          </div>
        </div>
        <GitHubPanel workspaceId={workspaceId} />
        <PromptModal
          open={fileModalOpen}
          title={fileModalMode === "new" ? "New file" : "Rename file"}
          label={fileModalMode === "new" ? "File path" : "New path"}
          initialValue={fileModalInitial}
          submitLabel={fileModalMode === "new" ? "Create" : "Rename"}
          onClose={() => setFileModalOpen(false)}
          onSubmit={submitFileModal}
        />
        <ConfirmModal
          open={confirmDeleteOpen}
          title="Delete file"
          message={`Delete ${activeFile}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={confirmDelete}
        />
      </div>
    </aside>
  );
}
