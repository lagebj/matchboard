"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Pencil, Check, X } from "lucide-react";

type InlineEditFieldProps = {
  label: string;
  value: string | number | null;
  renderValue?: (value: string | number | null) => ReactNode;
  onSave: (nextValue: string) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
  emptyLabel?: string;
  inputType?: "text" | "number";
  className?: string;
};

export function InlineEditField({
  label,
  value,
  renderValue,
  onSave,
  onCancel,
  disabled = false,
  emptyLabel = "Not set",
  inputType = "text",
  className,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = value != null ? String(value) : emptyLabel;
  const isEmpty = value == null || value === "";

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(value != null ? String(value) : "");
    setError(null);
    setEditing(true);
  }, [disabled, value]);

  const save = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  }, [draft, onSave]);

  const cancel = useCallback(() => {
    setEditing(false);
    setError(null);
    setDraft(value != null ? String(value) : "");
    onCancel?.();
  }, [value, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            className="rounded-md border border-[var(--accent)]/50 bg-[var(--surface-base)] px-2 py-1 text-sm text-zinc-100 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 min-w-[80px]"
            aria-label={label}
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded p-1 text-[var(--accent-strong)] hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/editable flex items-baseline gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-[var(--surface-hover)]",
        disabled && "cursor-default hover:bg-transparent",
        className,
      )}
      onClick={disabled ? undefined : startEdit}
      onKeyDown={disabled ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); } }}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      aria-label={`${label}: ${displayValue}${disabled ? "" : ". Click to edit."}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] shrink-0">
        {label}
      </span>
      <span className={cn("text-sm", isEmpty ? "text-[var(--text-muted)] italic" : "text-zinc-100")}>
        {renderValue ? renderValue(value) : displayValue}
      </span>
      {!disabled && (
        <Pencil className="h-3 w-3 text-[var(--text-muted)] opacity-0 group-hover/editable:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}