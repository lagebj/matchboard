import { requireCoachAccess } from '@/lib/auth';
import { resolveOrgFilterForUser } from '@/lib/tenancy/resolve-org-filter';
import { getAttentionEntries } from '@/lib/attention/get-attention-entries';

export default async function AttentionPage() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  if (orgFilter.type !== 'org') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Attention</h1>
        <p className="text-muted-foreground">No organisation selected.</p>
      </div>
    );
  }

  const entries = await getAttentionEntries();

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Attention</h1>
        <p className="text-muted-foreground">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Attention</h1>
      <p className="text-sm text-muted-foreground">Items that need your review or action.</p>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const urgencyLabel = entry.urgency === 'HIGH' ? 'Urgent' : entry.urgency === 'NORMAL' ? 'Normal' : 'Low';
          const urgencyClass = entry.urgency === 'HIGH' ? 'text-[var(--danger)]' : entry.urgency === 'NORMAL' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]';
          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-zinc-100">{entry.title}</span>
                {entry.summary && <span className="text-xs text-[var(--text-muted)] line-clamp-2">{entry.summary}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${urgencyClass}`}>{urgencyLabel}</span>
                <a href={entry.href} className="text-xs text-[var(--text-muted)] hover:text-zinc-100 underline">Go to</a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}