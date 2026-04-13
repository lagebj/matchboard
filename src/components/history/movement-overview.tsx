import Link from "next/link";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatSelectionRole } from "@/lib/match-utils";

export type MovementOverviewRow = {
  coreTeamName: string;
  draftMovementCount: number;
  finalizedMovementCount: number;
  movementCount: number;
  movements: Array<{
    explanation: string;
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

function getStatusClassName(status: SelectionStatus) {
  if (status === SelectionStatus.FINALIZED) {
    return "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]";
  }

  return "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]";
}

export function MovementOverview({ rows }: { rows: MovementOverviewRow[] }) {
  const totalMovementEvents = rows.reduce((sum, row) => sum + row.movementCount, 0);
  const draftMovementEvents = rows.reduce((sum, row) => sum + row.draftMovementCount, 0);
  const finalizedMovementEvents = rows.reduce((sum, row) => sum + row.finalizedMovementCount, 0);

  return (
    <section className="app-panel rounded-[1.75rem] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Movement Overview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Saved movement at a glance</h2>
          <p className="mt-2 max-w-3xl text-sm app-copy-soft">
            Read player movement totals first, then check the week, match, and status trail under each player.
          </p>
        </div>
        <div className="text-sm app-copy-soft">
          {rows.length} player{rows.length === 1 ? "" : "s"} with saved movement
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Total Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{totalMovementEvents}</p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Draft Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftMovementEvents}</p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Finalized Moves
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{finalizedMovementEvents}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {rows.length > 0 ? (
          rows.map((row) => (
            <article
              key={row.playerId}
              className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold text-zinc-50">{row.playerName}</p>
                    <Link
                      className="inline-flex h-8 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                      href={`/players/${row.playerId}`}
                    >
                      Open player
                    </Link>
                  </div>
                  <p className="mt-1 text-sm app-copy-soft">{row.coreTeamName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs text-zinc-100">
                    {row.movementCount} move{row.movementCount === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs app-copy-soft">
                    {row.draftMovementCount} draft
                  </span>
                  <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs app-copy-soft">
                    {row.finalizedMovementCount} finalized
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {row.movements.map((movement) => (
                  <div
                    key={`${movement.matchId}:${movement.status}:${movement.roleType}:${movement.startsAt.toISOString()}`}
                    className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getStatusClassName(movement.status)}`}
                      >
                        {movement.status === SelectionStatus.FINALIZED ? "Finalized" : "Draft"}
                      </span>
                      <span className="rounded-full border app-hairline px-3 py-1 text-[11px] uppercase tracking-[0.18em] app-copy-soft">
                        {formatSelectionRole(movement.roleType)}
                      </span>
                      <span className="text-xs uppercase tracking-[0.18em] app-copy-muted">
                        {formatIsoWeekLabel(movement.startsAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-100">
                      {movement.sourceTeamName} to {movement.targetTeamName}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      {movement.matchLabel} · {formatDate(movement.startsAt)}
                    </p>
                    <p className="mt-2 text-sm leading-6 app-copy-soft">{movement.explanation}</p>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            No saved movement yet. Once draft or finalized selections include support, development,
            or other floating work, it will show here.
          </div>
        )}
      </div>
    </section>
  );
}
