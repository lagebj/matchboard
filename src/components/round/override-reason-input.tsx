"use client";

import { useState } from "react";
import { OVERRIDE_REASON_CATEGORIES, type OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORY_LABELS } from "@/lib/match-utils";

type OverrideReasonInputProps = {
  hasBlockingWarnings: boolean;
  value: { category: string; detail: string };
  onChange: (value: { category: string; detail: string }) => void;
  minDetailLength?: number;
};

export function OverrideReasonInput({
  hasBlockingWarnings,
  value,
  onChange,
  minDetailLength = 10,
}: OverrideReasonInputProps) {
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  if (!hasBlockingWarnings) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-100" htmlFor="override-reason-category">
          Override reason <span className="text-[var(--danger)]">*</span>
        </label>
        {!showCategorySelector ? (
          <button
            type="button"
            onClick={() => setShowCategorySelector(true)}
            className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
              value.category
                ? "border-[var(--border-soft)] bg-[var(--surface-muted)]/50 text-zinc-100"
                : "border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/30 text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text-soft)]"
            }`}
          >
            {value.category
              ? OVERRIDE_REASON_CATEGORY_LABELS[value.category] ?? value.category
              : "Select override reason category…"}
          </button>
        ) : (
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-1">
            {OVERRIDE_REASON_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange({ ...value, category: cat });
                  setShowCategorySelector(false);
                }}
                className={`rounded px-3 py-1.5 text-left text-sm transition-colors ${
                  value.category === cat
                    ? "bg-[var(--accent-subtle)] text-zinc-50"
                    : "text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50"
                }`}
              >
                {OVERRIDE_REASON_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}
      </div>
      {value.category && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-100" htmlFor="override-reason-detail">
            Details <span className="text-[var(--text-muted)]">(min {minDetailLength} characters)</span>
          </label>
          <textarea
            id="override-reason-detail"
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/45 resize-none"
            rows={2}
            placeholder="Explain why you are overriding this condition…"
            value={value.detail}
            onChange={(e) => onChange({ ...value, detail: e.target.value })}
          />
          {value.detail.length > 0 && value.detail.trim().length < minDetailLength && (
            <p className="text-xs text-[var(--warning)]">
              Override detail must be at least {minDetailLength} characters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function getOverrideFormFields(value: { category: string; detail: string }): {
  category: OverrideReasonCategory | undefined;
  detail: string | undefined;
  isValid: boolean;
  minDetailLength: number;
} {
  const MIN_DETAIL_LENGTH = 10;
  const category = (OVERRIDE_REASON_CATEGORIES.includes(value.category as OverrideReasonCategory)
    ? value.category as OverrideReasonCategory
    : undefined);
  const detail = value.detail?.trim() || undefined;
  const isValid = !!category && !!detail && detail.length >= MIN_DETAIL_LENGTH;
  return { category, detail, isValid, minDetailLength: MIN_DETAIL_LENGTH };
}