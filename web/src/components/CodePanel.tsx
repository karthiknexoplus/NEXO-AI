import { useCallback, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileCode2, PanelRightClose, PanelRightOpen, Save } from "lucide-react";
import clsx from "clsx";
import {
  listProjectFiles,
  readProjectFile,
  saveProjectFile,
} from "../lib/workspace";
import { useChatStore } from "../store/chatStore";
import { useThemeStore } from "../store/themeStore";
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
  const workspaceVersion = useUiStore((s) => s.workspaceVersion);
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
    setFiles(list);
    setActiveFile((cur) => {
      if (cur && list.includes(cur)) return cur;
      return list[0] ?? null;
    });
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [projectId, workspaceVersion, refresh]);

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
        className="shrink-0 w-10 border-l border-nexo-border bg-nexo-sidebar flex flex-col items-center justify-center gap-1 text-nexo-muted hover:text-nexo-fg transition-colors"
        title="Open code panel"
      >
        <PanelRightOpen className="w-4 h-4" />
        <span className="text-[9px] writing-vertical">Code</span>
      </button>
    );
  }

  return (
    <aside className="w-[min(42vw,520px)] shrink-0 flex flex-col border-l border-nexo-border bg-nexo-sidebar transition-all duration-300">
      <div className="h-12 flex items-center justify-between px-3 border-b border-nexo-border">
        <div className="flex items-center gap-2 text-[12px] font-medium text-nexo-fg">
          <FileCode2 className="w-4 h-4 text-nexo-brand" />
          Project files
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!activeFile || !dirty || saving}
            onClick={() => void save()}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-nexo-brand text-white disabled:opacity-30"
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
              Files appear here when NEXOPLUS generates your project.
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
              Select a file or ask NEXOPLUS to generate your app.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
