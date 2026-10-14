import { useCallback, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileCode2, Loader2, PanelRightClose, PanelRightOpen, Save } from "lucide-react";
import clsx from "clsx";
import {
  listProjectFiles,
  readProjectFile,
  saveProjectFile,
} from "../lib/workspace";
import { useChatStore } from "../store/chatStore";
import { useThemeStore } from "../store/themeStore";
import { labelForPhase } from "../lib/generationStatus";
import { useUiStore } from "../store/uiStore";

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
  const projectId = useChatStore((s) => s.activeProjectId);
  const hasChatsInProject = useChatStore(
    (s) => s.threads.some((t) => t.projectId === s.activeProjectId)
  );
  const workspaceVersion = useUiStore((s) => s.workspaceVersion);
  const generationPhase = useUiStore((s) => s.generationPhase);
  const generationDetail = useUiStore((s) => s.generationDetail);
  const codePanelOpen = useUiStore((s) => s.codePanelOpen);
  const setCodePanelOpen = useUiStore((s) => s.setCodePanelOpen);
  const theme = useThemeStore((s) => s.theme);

  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listProjectFiles(projectId);
    if (list.length === 0 && !hasChatsInProject) {
      setFiles([]);
      setActiveFile(null);
      setContent("");
      setDirty(false);
      return;
    }
    setFiles(list);
    setActiveFile((cur) => {
      if (cur && list.includes(cur)) return cur;
      return list[0] ?? null;
    });
  }, [projectId, hasChatsInProject]);

  useEffect(() => {
    void refresh();
  }, [projectId, workspaceVersion, hasChatsInProject, refresh]);

  useEffect(() => {
    if (!activeFile) {
      setContent("");
      return;
    }
    void readProjectFile(projectId, activeFile).then((text) => {
      setContent(text);
      setDirty(false);
    });
  }, [activeFile, projectId, workspaceVersion]);

  const save = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      await saveProjectFile(projectId, activeFile, content);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (!codePanelOpen) {
    return (
      <button
        type="button"
        onClick={() => setCodePanelOpen(true)}
        className="shrink-0 w-11 rounded-2xl border border-nexo-border nexo-glass bg-nexo-sidebar flex flex-col items-center justify-center gap-1 text-nexo-muted hover:text-nexo-fg hover:border-nexo-brand/25 transition-colors"
        title="Open code panel"
      >
        <PanelRightOpen className="w-4 h-4" />
        <span className="text-[9px] writing-vertical">Code</span>
      </button>
    );
  }

  return (
    <aside className="w-[min(42vw,520px)] shrink-0 flex flex-col border border-nexo-border nexo-glass bg-nexo-sidebar rounded-2xl overflow-hidden transition-all duration-300">
      <div className="h-14 flex items-center justify-between px-4 border-b border-nexo-border">
        <div className="flex items-center gap-2 text-[12px] font-semibold font-display text-nexo-fg">
          <FileCode2 className="w-4 h-4 text-nexo-brand" />
          Project files
        </div>
        <div className="flex items-center gap-1">
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

      <div className="flex flex-1 min-h-0">
        <ul className="w-[140px] shrink-0 overflow-y-auto border-r border-nexo-border py-2 text-[11px]">
          {files.length === 0 && (
            <li className="px-3 py-4 text-nexo-muted leading-snug">
              {generationPhase ? (
                <span className="flex items-start gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-nexo-brand" />
                  {labelForPhase(generationPhase, generationDetail)}
                </span>
              ) : hasChatsInProject
                ? "Files appear here when NEXOPLUS generates your project."
                : "Start a new chat to generate project files."}
            </li>
          )}
          {files.map((f) => (
            <li key={f}>
              <button
                type="button"
                onClick={() => setActiveFile(f)}
                className={clsx(
                  "w-full text-left px-2 py-1.5 truncate font-mono transition-colors",
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
              ) : hasChatsInProject
                ? "Select a file or ask NEXOPLUS to generate your app."
                : "No chat selected — start a new chat."}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
