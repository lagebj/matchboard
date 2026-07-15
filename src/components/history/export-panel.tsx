"use client";

import { useState } from "react";

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
    <div className="rounded-[1.75rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
        Export Finalised Selections
      </p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-50">Download history</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium app-copy-soft mb-2">Format</p>
          <div className="flex flex-wrap gap-2">
            {(["csv", "json", "txt", "md"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                  format === f
                    ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.14)] text-[var(--accent-strong)]"
                    : "border app-hairline app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium app-copy-soft mb-2">Visibility</p>
          <div className="flex gap-2">
            {(["coach", "parent"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                  visibility === v
                    ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.14)] text-[var(--accent-strong)]"
                    : "border app-hairline app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs app-copy-muted">
            {visibility === "parent"
              ? "Hides internal planning tags, roles, warnings, override reasons"
              : "Includes roles, warnings, movement paths, explanations, override reasons"}
          </p>
        </div>
      </div>

      <a
        href={buildUrl()}
        download
        className="mt-4 inline-flex h-10 items-center rounded-full border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-5 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[rgba(140,167,146,0.2)]"
      >
        Download {format.toUpperCase()} ({visibility})
      </a>
    </div>
  );
}