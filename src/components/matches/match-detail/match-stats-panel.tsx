import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";

/**
 * "Stats" tab — supported aggregates only (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md`: "This tab can
 * be sparse. A sparse truthful tab is better than invented metrics."). Deliberately does not add
 * possession/shots/corners — no repository-backed source exists for them.
 */
export function MatchStatsPanel({ data }: { data: MatchDetailAfterData }) {
  const hasAnything =
    data.goalScorers.scorers.length > 0 || data.assistProviders.scorers.length > 0 || data.attendanceSummary.totalCount > 0;

  if (!hasAnything) {
    return <EmptyState title="No stats recorded yet." description="Stats populate once the post-match report has goals, assists or attendance." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Surface padding="md">
        <SectionHeader title="Goal scorers" />
        <AggregateList rows={data.goalScorers.scorers} unattributedCount={data.goalScorers.unattributedCount} suffix="goal" />
      </Surface>
      <Surface padding="md">
        <SectionHeader title="Assist providers" />
        <AggregateList rows={data.assistProviders.scorers} unattributedCount={data.assistProviders.unattributedCount} suffix="assist" />
      </Surface>
      <Surface padding="md">
        <SectionHeader title="Attendance" />
        <dl className="mt-2 flex flex-col gap-1.5 text-[13px]">
          <Row label="Present" value={String(data.attendanceSummary.presentCount)} />
          <Row label="No-show" value={String(data.attendanceSummary.noShowCount)} />
        </dl>
      </Surface>
      <Surface padding="md">
        <SectionHeader title="Observations" />
        <dl className="mt-2 flex flex-col gap-1.5 text-[13px]">
          <Row label="Football observations" value={String(data.footballObservations.length)} />
        </dl>
      </Surface>
    </div>
  );
}

function AggregateList({
  rows,
  unattributedCount,
  suffix,
}: {
  rows: { participantKey: string; playerName: string; count: number }[];
  unattributedCount: number;
  suffix: string;
}) {
  if (rows.length === 0 && unattributedCount === 0) {
    return <p className="mt-2 text-[13px] text-[var(--text-muted)]">None recorded.</p>;
  }
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.participantKey} className="flex items-center justify-between text-[13px]">
          <span className="text-[var(--foreground)]">{r.playerName}</span>
          <span className="text-[var(--text-muted)]">{r.count}</span>
        </li>
      ))}
      {unattributedCount > 0 && (
        <li className="flex items-center justify-between text-[13px] text-[var(--text-muted)]">
          <span>Unattributed</span>
          <span>{unattributedCount} {suffix}{unattributedCount === 1 ? "" : "s"}</span>
        </li>
      )}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
