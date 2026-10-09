import { CoverageBadge } from "./coverage-badge";
import type { SourceRecord } from "./coverage";

/**
 * Shared read-only source-record rows — the SAME markup for both the desktop inline inspector and
 * the mobile bottom sheet (`SourceInspector`), so the two responsive presentations can never drift
 * into separate sources of truth (same pattern as A01's `LineupList`).
 */
export function SourceRecordList({ sources }: { sources: readonly SourceRecord[] }) {
  return (
    <ul className="flex flex-col gap-1.5" data-testid="source-record-list">
      {sources.map((source) => (
        <li
          key={source.sourceId}
          className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[12px] text-[var(--foreground)]"
          data-testid="source-record-row"
          data-source-id={source.sourceId}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{source.fieldLabel}</span>
            <CoverageBadge status={source.coverage} />
          </div>
          <p className="mt-0.5 text-[var(--text-muted)]">
            {source.provenance} · {source.scope}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--foreground)]">{source.fieldValue}</p>
          {source.transformation ? (
            <p className="mt-0.5 text-[11px] italic text-[var(--text-muted)]">Transformation: {source.transformation}</p>
          ) : null}
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            Source ID: {source.sourceId} · {source.sourceClass}
          </p>
        </li>
      ))}
    </ul>
  );
}
