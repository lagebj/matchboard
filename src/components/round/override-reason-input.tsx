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
        <label className="text-sm font-medium text-zinc-200" htmlFor="override-reason-category">
          Override reason <span className="text-red-400">*</span>
        </label>
        {!showCategorySelector ? (
          <button
            type="button"
            onClick={() => setShowCategorySelector(true)}
            className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
              value.category
                ? "border-[var(--border-soft)] bg-[var(--surface-muted)] text-zinc-100"
                : "border-dashed border-zinc-600 bg-zinc-800/30 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
            }`}
          >
            {value.category
              ? OVERRIDE_REASON_CATEGORY_LABELS[value.category] ?? value.category
              : "Select override reason category…"}
          </button>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-1">
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
                    ? "bg-[var(--accent-subtle)] text-zinc-100"
                    : "text-zinc-300 hover:bg-[var(--surface-hover)] hover:text-zinc-100"
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
          <label className="text-sm font-medium text-zinc-200" htmlFor="override-reason-detail">
            Details <span className="text-[var(--text-muted)]">(min {minDetailLength} characters)</span>
          </label>
          <textarea
            id="override-reason-detail"
            className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            rows={2}
            placeholder="Explain why you are overriding this condition..."
            value={value.detail}
            onChange={(e) => onChange({ ...value, detail: e.target.value })}
          />
          {value.detail.length > 0 && value.detail.trim().length < minDetailLength && (
            <p className="text-xs text-amber-300">
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