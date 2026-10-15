import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  placeholder?: string;
  requireValue?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  danger?: boolean;
}

export function PromptModal({
  open,
  title,
  label,
  initialValue = "",
  submitLabel = "Create",
  placeholder,
  requireValue = true,
  onClose,
  onSubmit,
  danger = false,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const v = value.trim();
    if (requireValue && !v) return;
    onSubmit(v);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-nexo-border bg-nexo-composer shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-[15px] font-semibold text-nexo-fg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-nexo-hover text-nexo-muted"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-[12px] text-nexo-muted mb-3">
          {label}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="mt-1.5 w-full rounded-xl border border-nexo-border bg-nexo-panel px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--nexo-brand)_35%,transparent)]"
            placeholder={placeholder}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-[12px] border border-nexo-border text-nexo-muted hover:bg-nexo-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className={`px-3 py-2 rounded-xl text-[12px] font-semibold text-white ${
              danger ? "bg-red-500 hover:bg-red-600" : "nexo-btn-primary"
            }`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}