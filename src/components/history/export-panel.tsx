"use client";

import { useState } from "react";
import { TouchlineButton } from "@/components/touchline";

type ExportFormat = "csv" | "json" | "txt" | "md";
type VisibilityMode = "coach" | "parent";

export function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [visibility, setVisibility] = useState<VisibilityMode>("coach");

  const buildUrl = () => {
    const params = new URLSearchParams({ format, visibility });
    return `/api/exports/finalized-selections?${params.toString()}`;
  };

  return (
    <div className="rounded-[var(--tl-c-radius-overlay)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
        Export Finalised Selections
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Download history</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[var(--text-soft)] mb-2">Format</p>
          <div className="flex flex-wrap gap-2">
            {(["csv", "json", "txt", "md"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                  format === f
                    ? "border-[var(--accent)]/40 bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                    : "border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-soft)] mb-2">Visibility</p>
          <div className="flex gap-2">
            {(["coach", "parent"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                  visibility === v
                    ? "border-[var(--accent)]/40 bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                    : "border border-[var(--border-soft)] text-[var(--text-soft)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {visibility === "parent"
              ? "Hides internal planning tags, roles, warnings, override reasons"
              : "Includes roles, warnings, movement paths, explanations, override reasons"}
          </p>
        </div>
      </div>

      <TouchlineButton as="a" href={buildUrl()} download variant="primary" className="mt-4">
        Download {format.toUpperCase()} ({visibility})
      </TouchlineButton>
    </div>
  );
}