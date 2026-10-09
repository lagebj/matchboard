import type { LineupPreviewEntry } from "./fixtures";

/**
 * Shared read-only lineup rows — the SAME markup and the SAME fixture data for both the desktop
 * contextual inspector and the mobile bottom sheet, so the two responsive presentations can never
 * drift into separate sources of truth (PR #777 final A01 correction).
 */
export function LineupList({ entries }: { entries: LineupPreviewEntry[] }) {
  return (
    <ul className="flex flex-col gap-1.5" data-testid="lineup-preview-list">
      {entries.map((entry) => (
        <li
          key={`${entry.slot}-${entry.number}`}
          className="flex items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)]"
        >
          <span>
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {entry.slot}
            </span>
            {entry.name}
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">#{entry.number}</span>
        </li>
      ))}
    </ul>
  );
}
