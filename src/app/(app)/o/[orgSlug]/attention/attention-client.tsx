'use client';

import type { AttentionEntry } from '@/lib/attention/get-attention-entries';
import { TouchlinePageHeader } from '@/components/touchline';

// Was a pre-existing raw light-mode-only Tailwind outlier (bg-red-50/bg-amber-50/bg-slate-50 with
// no dark styling at all — the same pattern already documented for football-observation-
// section.tsx/observation-section.tsx and team-focus-panel.tsx's STATUS_COLORS). Token-aligned
// here since this component now renders inside a .touchline island.
const urgencyStyles: Record<string, string> = {
  HIGH: 'bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/35',
  NORMAL: 'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/35',
  LOW: 'bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border-soft)]',
};

const categoryLabels: Record<string, string> = {
  review_assigned: 'Review assigned',
  review_changes_requested: 'Changes requested',
  invitation_pending: 'Invitation pending',
  missing_post_match_report: 'Missing report',
  expiring_support_access: 'Expiring access',
  unacknowledged_handover: 'Unacknowledged handover',
  unowned_fixture: 'Unowned fixture',
};

export function AttentionPageClient({ entries }: { entries: AttentionEntry[] }) {
  if (entries.length === 0) {
    return (
      // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
      <div className="touchline space-y-6">
        <TouchlinePageHeader title="Attention" context="No items require your attention right now." />
      </div>
    );
  }

  return (
    <div className="touchline space-y-6">
      <TouchlinePageHeader
        title="Attention"
        context={`${entries.length} item${entries.length === 1 ? '' : 's'} requiring your attention.`}
      />

      <div className="space-y-3">
        {entries.map((entry) => (
          <a
            key={entry.id}
            href={entry.href}
            className={`block rounded-lg border p-4 transition-colors hover:bg-[var(--surface-hover)] ${urgencyStyles[entry.urgency] ?? 'bg-[var(--surface-muted)] border-[var(--border-soft)]'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[var(--surface-base)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]">
                    {categoryLabels[entry.category] ?? entry.category}
                  </span>
                  {entry.dueAt && (
                    <span className="text-xs text-[var(--text-muted)]">
                      Due {entry.dueAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-medium text-[var(--foreground)]">{entry.title}</p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{entry.summary}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}