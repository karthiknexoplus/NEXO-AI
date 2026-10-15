import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger = false, onClose, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-nexo-border bg-nexo-composer shadow-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-[15px] font-semibold text-nexo-fg">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-nexo-hover text-nexo-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[13px] text-nexo-muted mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-[12px] border border-nexo-border text-nexo-muted hover:bg-nexo-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-2 rounded-xl text-[12px] font-semibold text-white ${
              danger ? "bg-red-500 hover:bg-red-600" : "nexo-btn-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}