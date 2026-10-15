import { useState } from "react";
import { Loader2, Play, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useUiStore } from "../store/uiStore";

interface Props {
  workspaceId: string | null;
}

interface LogEntry {
  command?: string;
  output?: string;
  error?: boolean;
  code?: number;
}

export function TerminalPanel({ workspaceId }: Props) {
  const showToast = useUiStore((s) => s.showToast);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const run = async (cmd?: string) => {
    const toRun = (cmd ?? command).trim();
    if (!toRun || !workspaceId || running) return;
    setRunning(true);
    setLog((prev) => [...prev, { command: toRun }]);
    try {
      const res = await fetch("/api/terminal/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: workspaceId, command: toRun }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Command failed");
      }
      const data = (await res.json()) as { stdout: string; stderr: string; code: number };
      const text = [data.stdout, data.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      setLog((prev) => [...prev, { output: text, error: (data.code ?? 0) !== 0, code: data.code ?? 0 }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Command failed";
      setLog((prev) => [...prev, { output: msg, error: true, code: 1 }]);
      showToast(msg, "error");
    } finally {
      setRunning(false);
      if (!cmd) setCommand("");
    }
  };

  return (
    <div className="border-t border-nexo-border bg-nexo-composer/60 shrink-0 h-44 flex flex-col">
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-nexo-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <TerminalIcon className="w-3.5 h-3.5" /> Terminal
        </span>
        <button
          type="button"
          onClick={() => setLog([])}
          className="p-1 rounded hover:bg-nexo-hover"
          title="Clear output"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1 font-mono text-[11px] text-nexo-fg space-y-1">
        {log.length === 0 && (
          <p className="text-nexo-muted">Run commands in the active workspace (admin only). AI can suggest commands here.</p>
        )}
        {log.map((entry, i) => (
          <div key={i}>
            {entry.command && (
              <div className="text-nexo-brand">
                $ {entry.command}
              </div>
            )}
            {entry.output && (
              <pre className={`whitespace-pre-wrap break-words ${entry.error ? "text-red-400" : "text-nexo-fg"}`}>
                {entry.output}
                {typeof entry.code === "number" ? `\n[exit ${entry.code}]` : ""}
              </pre>
            )}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-1.5 text-nexo-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…
          </div>
        )}
      </div>
      <form
        className="flex items-center gap-2 px-3 py-1.5 border-t border-nexo-border"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <span className="text-nexo-brand text-[11px] font-mono">$</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={!workspaceId || running}
          className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-nexo-fg focus:outline-none"
          placeholder={workspaceId ? "npm install, node index.js, ..." : "Start a chat first"}
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={!workspaceId || running || !command.trim()}
          className="p-1.5 rounded-md nexo-btn-primary disabled:opacity-30"
          title="Run"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </form>
    </div>
  );
}