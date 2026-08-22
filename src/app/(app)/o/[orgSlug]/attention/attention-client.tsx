'use client';

import type { AttentionEntry } from '@/lib/attention/get-attention-entries';

const urgencyStyles: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  NORMAL: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attention</h1>
          <p className="text-[var(--text-muted)] mt-1">No items require your attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attention</h1>
        <p className="text-[var(--text-muted)] mt-1">
          {entries.length} item{entries.length === 1 ? '' : 's'} requiring your attention.
        </p>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <a
            key={entry.id}
            href={entry.href}
            className={`block rounded-lg border p-4 transition-colors hover:bg-accent ${urgencyStyles[entry.urgency] ?? 'bg-slate-50 border-slate-200'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-xs font-medium">
                    {categoryLabels[entry.category] ?? entry.category}
                  </span>
                  {entry.dueAt && (
                    <span className="text-xs text-[var(--text-muted)]">
                      Due {entry.dueAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-medium">{entry.title}</p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{entry.summary}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}