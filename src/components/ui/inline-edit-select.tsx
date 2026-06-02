"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Pencil, Check, X } from "lucide-react";

type SelectOption = { label: string; value: string };

type InlineEditSelectProps = {
  label: string;
  value: string | null;
  options: readonly SelectOption[] | SelectOption[];
  onSave: (nextValue: string) => Promise<void> | void;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function InlineEditSelect({
  label,
  value,
  options,
  onSave,
  disabled = false,
  emptyLabel = "Not set",
  className,
}: InlineEditSelectProps) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? emptyLabel;
  const isEmpty = value == null || value === "";

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(value ?? "");
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
  }, []);

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
          <select
            ref={selectRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            className="rounded-md border border-[var(--accent)]/50 bg-[var(--surface-base)] px-2 py-1 text-sm text-zinc-100 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 min-w-[120px]"
            aria-label={label}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
        {displayValue}
      </span>
      {!disabled && (
        <Pencil className="h-3 w-3 text-[var(--text-muted)] opacity-0 group-hover/editable:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}