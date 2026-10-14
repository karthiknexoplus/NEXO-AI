import React, { useRef, useEffect } from "react";

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  model: string;
  modelOptions: string[];
  onModelChange: (model: string) => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  sending,
  model,
  modelOptions,
  onModelChange,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="composer-shell shrink-0 px-3 pb-3 pt-1">
      <div className="composer-box rounded-composer overflow-hidden transition-shadow">
        <textarea
          ref={ref}
          className="w-full resize-none bg-transparent text-[13px] text-nexo-fg placeholder:text-nexo-muted px-4 pt-3.5 pb-2 min-h-[52px] max-h-[140px] focus:outline-none leading-relaxed"
          placeholder="Ask, @codebase search, or describe a project to build…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={sending}
          rows={2}
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-nexo-border text-nexo-muted shrink-0">
              @codebase
            </span>
            <select
              className="text-[11px] font-mono bg-nexo-input/80 border border-nexo-border rounded-md px-2 py-1 text-nexo-fg max-w-[140px] truncate focus:outline-none focus:ring-1 focus:ring-nexo-accent"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              title="Model"
            >
              {modelOptions.length === 0 && <option value={model}>{model}</option>}
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m.replace(":latest", "")}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !value.trim()}
            className="shrink-0 w-8 h-8 rounded-lg bg-nexo-accent text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 transition-opacity"
            title="Send (Enter)"
            aria-label="Send"
          >
            {sending ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" transform="rotate(-90 12 12)" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-center text-nexo-muted mt-2 px-2">
        Enter to send · Shift+Enter for newline · First Ollama reply may take 1–2 min on CPU
      </p>
    </div>
  );
}
