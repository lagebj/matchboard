import Link from "next/link";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatSelectionRole } from "@/lib/match-utils";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";

export type MovementOverviewRow = {
  coreTeamName: string;
  draftMovementCount: number;
  finalizedMovementCount: number;
  movementCount: number;
  movements: Array<{
    explanation: string;
    key: string;
    matchId: string;
    matchLabel: string;
    roleType: SelectionRole;
    sourceTeamName: string;
    startsAt: Date;
    status: SelectionStatus;
    targetTeamName: string;
  }>;
  playerId: string;
  playerName: string;
};

function movementStatusVariant(status: SelectionStatus) {
  return status === SelectionStatus.FINALIZED ? "finalized" : "warning";
}

export function MovementOverview({ rows }: { rows: MovementOverviewRow[] }) {
  const totalMovementEvents = rows.reduce((sum, row) => sum + row.movementCount, 0);
  const draftMovementEvents = rows.reduce((sum, row) => sum + row.draftMovementCount, 0);
  const finalizedMovementEvents = rows.reduce((sum, row) => sum + row.finalizedMovementCount, 0);

  return (
    <Surface variant="default" padding="lg">
      <SectionHeader
        title="Movement Overview"
        description="Read player movement totals first, then check the week, match, and status trail from the latest saved snapshot for each match."
      />
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        {rows.length} player{rows.length === 1 ? "" : "s"} with saved movement
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <Surface variant="default" padding="md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Total Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{totalMovementEvents}</p>
        </Surface>
        <Surface variant="default" padding="md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Draft Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftMovementEvents}</p>
        </Surface>
        <Surface variant="default" padding="md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Finalised Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{finalizedMovementEvents}</p>
        </Surface>
      </div>

      <div className="mt-6 grid gap-4">
        {rows.length > 0 ? (
          rows.map((row) => (
            <Surface key={row.playerId} variant="default" padding="md">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold text-zinc-50">{row.playerName}</p>
                    <Link
                      className="inline-flex h-8 items-center rounded-md border border-[var(--border-soft)] px-3 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-zinc-50"
                      href={`/players/${row.playerId}`}
                    >
                      Open player
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{row.coreTeamName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 px-3 py-1 text-xs font-medium text-zinc-100">
                    {row.movementCount} move{row.movementCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 px-3 py-1 text-xs font-medium text-[var(--text-soft)]">
                    {row.draftMovementCount} draft
                  </span>
                  <span className="inline-flex items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 px-3 py-1 text-xs font-medium text-[var(--text-soft)]">
                    {row.finalizedMovementCount} finalised
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {row.movements.map((movement) => (
                  <Surface key={movement.key} variant="subtle" padding="md">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill variant={movementStatusVariant(movement.status)} size="sm">
                        {movement.status === SelectionStatus.FINALIZED ? "Finalised" : "Draft"}
                      </StatusPill>
                      <StatusPill variant="neutral" size="sm">
                        {formatSelectionRole(movement.roleType)}
                      </StatusPill>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {formatIsoWeekLabel(movement.startsAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-100">
                      {movement.sourceTeamName} to {movement.targetTeamName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {movement.matchLabel} · {formatDate(movement.startsAt)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{movement.explanation}</p>
                  </Surface>
                ))}
              </div>
            </Surface>
          ))
        ) : (
          <Surface variant="subtle" padding="md" className="lg:col-span-2">
            <p className="text-sm text-[var(--text-soft)]">
              No saved movement yet. Once draft or finalised selections include support, development,
              or other floating work, it will show here.
            </p>
          </Surface>
        )}
      </div>
    </Surface>
  );
}