import { useEffect } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useUiStore } from "../store/uiStore";

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => clearToast(), 3500);
    return () => window.clearTimeout(id);
  }, [toast, clearToast]);

  if (!toast) return null;

  const Icon =
    toast.type === "success" ? CheckCircle2 : toast.type === "error" ? XCircle : Info;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] sm:max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-nexo-border bg-nexo-composer/95 backdrop-blur px-3 py-2.5 shadow-2xl text-[13px] text-nexo-fg">
        <Icon className="w-4 h-4 shrink-0 text-nexo-brand" />
        <span className="min-w-0 break-words">{toast.message}</span>
        <button type="button" onClick={clearToast} className="shrink-0 p-1 rounded hover:bg-nexo-hover text-nexo-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}