import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import { RepairDropoutForm } from "@/components/matchday/repair-dropout-form";
import { LockToggleForm } from "@/components/matchday/lock-toggle-form";
import { AcceptReducedSquadForm } from "@/components/matchday/accept-reduced-squad-form";

export const dynamic = "force-dynamic";

type MatchdayPageProps = {
  searchParams: Promise<{
    error?: string;
    repaired?: string;
    repairFailed?: string;
    repairMatchId?: string;
    repairMessage?: string;
    repairPlayerId?: string;
  }>;
};

export default async function MatchdayPage({ searchParams }: MatchdayPageProps) {
  const { error, repaired, repairFailed, repairMatchId, repairMessage, repairPlayerId } = await searchParams;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const matches = await db.match.findMany({
    where: {
      startsAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    include: {
      team: { select: { id: true, name: true } },
      selections: {
        where: { status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } },
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              supportInstruction: true,
              nonRotatable: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  const recentMatches = matches.length > 0
    ? matches
    : await db.match.findMany({
        include: {
          team: { select: { id: true, name: true } },
          selections: {
            where: { status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } },
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryPosition: true,
                  supportInstruction: true,
                  nonRotatable: true,
                  coreTeam: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: [{ role: "asc" }],
          },
        },
        orderBy: [{ startsAt: "desc" }],
        take: 4,
      });

  const allMatchRoundIds = recentMatches.map((m) => m.matchRoundId);
  const playerLocks = allMatchRoundIds.length > 0
    ? await db.playerLock.findMany({
        where: {
          matchRoundId: { in: allMatchRoundIds },
        },
        select: {
          id: true,
          lockType: true,
          matchRoundId: true,
          playerId: true,
          reason: true,
        },
      })
    : [];

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Matchday
          </span>
          <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
            Execution, not planning
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
          Matchday Mode
        </h1>
        <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
          Stripped view for match day. Squads, support instructions, attendance check, and late-dropout repair. No rule editing.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            href="/"
          >
            Back to Desk
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
            href="/availability"
          >
            Check availability
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[#f0cbc5]">
          {error}
        </div>
      ) : null}

      {repaired === "1" && repairMessage ? (
        <div className="rounded-2xl border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {repairMessage}
        </div>
      ) : null}

      {repairFailed === "1" && repairMessage ? (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.14)] px-4 py-3">
          <p className="text-sm text-[#f0cbc5]">{repairMessage}</p>
          {repairMatchId && repairPlayerId && (
            <div className="mt-3">
              <AcceptReducedSquadForm matchId={repairMatchId} playerId={repairPlayerId} />
            </div>
          )}
        </div>
      ) : null}

      {recentMatches.length > 0 ? (
        recentMatches.map((match) => {
          const selectionByRole = new Map<string, typeof match.selections>();
          for (const sel of match.selections) {
            const role = formatSelectionRole(sel.role);
            const existing = selectionByRole.get(role) ?? [];
            existing.push(sel);
            selectionByRole.set(role, existing);
          }

          const matchLocks = playerLocks.filter(
            (lock) => lock.matchRoundId === match.matchRoundId,
          );

          return (
            <section key={match.id} className="app-panel rounded-[1.75rem] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                    Match
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-50">
                    {match.team.name} vs. {match.opponent}
                  </h2>
                  <p className="mt-1 text-sm app-copy-soft">
                    {formatDate(match.startsAt)} &middot; {formatMatchVenue(match.homeAway)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                    href={`/selection/${match.id}`}
                  >
                    Open selection
                  </Link>
                </div>
              </div>

              {matchLocks.length > 0 && (
                <div className="mt-4 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                    Player locks ({matchLocks.length})
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    {matchLocks.map((lock) => {
                      const lockedPlayer = match.selections.find(
                        (sel) => sel.playerId === lock.playerId,
                      );
                      const lockedPlayerName = lockedPlayer
                        ? formatPlayerName(lockedPlayer.player)
                        : lock.playerId;
                      return (
                        <div key={lock.id} className="flex items-center justify-between gap-3 text-sm">
                          <span>
                            <span className="font-medium text-zinc-100">{lockedPlayerName}</span>
                            <span className="ml-2 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                              {lock.lockType === "LOCKED_IN" ? "Locked in" : "Locked out"}
                            </span>
                            {lock.reason && (
                              <span className="ml-2 text-xs app-copy-soft">
                                &mdash; {lock.reason}
                              </span>
                            )}
                          </span>
                          <LockToggleForm
                            lockId={lock.id}
                            matchRoundId={match.matchRoundId}
                            playerId={lock.playerId}
                            currentLockType={lock.lockType as "LOCKED_IN" | "LOCKED_OUT"}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {Array.from(selectionByRole.entries()).map(([role, selections]) => (
                  <div key={role} className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                      {role} ({selections.length})
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {selections.map((sel) => {
                        const player = sel.player;
                        const playerLock = matchLocks.find(
                          (lock) => lock.playerId === player.id,
                        );
                        return (
                          <div key={sel.id} className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.12)] px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <Link
                                className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
                                href={`/players/${player.id}`}
                              >
                                {formatPlayerName(player)}
                              </Link>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                                  {player.primaryPosition}
                                </span>
                                {playerLock && (
                                  <span className="rounded-full bg-[rgba(140,167,146,0.2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                                    {playerLock.lockType === "LOCKED_IN" ? "In" : "Out"}
                                  </span>
                                )}
                              </div>
                            </div>
                            {player.supportInstruction && (
                              <p className="mt-1 text-xs app-copy-soft">
                                Instruction: {player.supportInstruction}
                              </p>
                            )}
                            <div className="mt-1.5 flex justify-end">
                              <RepairDropoutForm
                                matchId={match.id}
                                playerId={player.id}
                                playerName={formatPlayerName(player)}
                                selectionStatus={sel.status}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {match.selections.length === 0 && (
                <p className="mt-4 text-sm app-copy-soft">No selections for this match yet.</p>
              )}
            </section>
          );
        })
      ) : (
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-sm app-copy-soft">No matches found for today. Showing most recent matches instead, or no matches exist yet.</p>
        </section>
      )}
    </main>
  );
}